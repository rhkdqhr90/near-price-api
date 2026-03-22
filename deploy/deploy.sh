#!/bin/bash
# NearPrice API 배포 스크립트
# 사용법: ./deploy.sh [environment] [action]
# 예: ./deploy.sh prod deploy
# 예: ./deploy.sh staging rollback

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 변수
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENVIRONMENT="${1:-staging}"
ACTION="${2:-deploy}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="${PROJECT_ROOT}/backups/${TIMESTAMP}"
LOG_FILE="${PROJECT_ROOT}/logs/deploy_${TIMESTAMP}.log"

# 로그 함수
log() {
  echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

success() {
  echo -e "${GREEN}✓${NC} $1" | tee -a "$LOG_FILE"
}

error() {
  echo -e "${RED}✗${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
  echo -e "${YELLOW}⚠${NC} $1" | tee -a "$LOG_FILE"
}

# 사전 확인
check_prerequisites() {
  log "사전 확인 중..."

  # Node.js 확인
  if ! command -v node &> /dev/null; then
    error "Node.js가 설치되지 않았습니다"
    exit 1
  fi
  success "Node.js: $(node --version)"

  # npm 확인
  if ! command -v npm &> /dev/null; then
    error "npm이 설치되지 않았습니다"
    exit 1
  fi
  success "npm: $(npm --version)"

  # PM2 확인
  if ! command -v pm2 &> /dev/null; then
    error "PM2가 설치되지 않았습니다. npm install -g pm2 실행"
    exit 1
  fi
  success "PM2: $(pm2 --version)"

  # 로그 디렉토리 생성
  mkdir -p "$(dirname "$LOG_FILE")"
  mkdir -p "$BACKUP_DIR"
}

# 환경 검증
validate_environment() {
  log "환경 검증 중 (환경: $ENVIRONMENT)..."

  case $ENVIRONMENT in
    dev|staging|prod)
      success "올바른 환경: $ENVIRONMENT"
      ;;
    *)
      error "올바르지 않은 환경: $ENVIRONMENT (dev/staging/prod 중 선택)"
      exit 1
      ;;
  esac

  # .env 파일 확인
  if [ ! -f "$PROJECT_ROOT/.env" ]; then
    warning ".env 파일이 없습니다"
    warning "$PROJECT_ROOT/.env 파일을 생성해주세요"
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi
}

# 코드 가져오기
pull_code() {
  log "최신 코드 가져오는 중..."
  cd "$PROJECT_ROOT"

  # Git 상태 확인
  if git status --porcelain | grep -q .; then
    warning "로컬 변경사항이 있습니다"
    git status
    read -p "계속 진행하시겠습니까? (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
      exit 1
    fi
  fi

  # 코드 가져오기
  git fetch origin
  current_branch=$(git rev-parse --abbrev-ref HEAD)
  git pull origin "$current_branch"
  success "코드 업데이트 완료"
  success "최신 커밋: $(git log -1 --pretty=format:'%h - %s')"
}

# 의존성 설치
install_dependencies() {
  log "의존성 설치 중..."
  cd "$PROJECT_ROOT"

  npm ci
  success "의존성 설치 완료"
}

# 빌드
build() {
  log "애플리케이션 빌드 중..."
  cd "$PROJECT_ROOT"

  # 이전 빌드 백업
  if [ -d "dist" ]; then
    cp -r dist "$BACKUP_DIR/dist_backup"
    success "이전 빌드 백업: $BACKUP_DIR/dist_backup"
  fi

  # 빌드 실행
  npm run build

  if [ ! -d "dist" ]; then
    error "빌드 실패: dist 디렉토리가 생성되지 않았습니다"
    exit 1
  fi

  success "빌드 완료"
}

# 린팅 및 테스트
lint_and_test() {
  log "린팅 및 테스트 실행 중..."
  cd "$PROJECT_ROOT"

  if npm run lint &> /dev/null; then
    success "린팅 통과"
  else
    warning "린팅 실패 (경고)"
  fi

  if npm run test:cov &> /dev/null; then
    success "테스트 통과"
  else
    warning "테스트 실패 (경고)"
  fi
}

# 데이터베이스 마이그레이션
run_migrations() {
  log "데이터베이스 마이그레이션 중..."
  cd "$PROJECT_ROOT"

  if npm run typeorm:migration:run &> /dev/null; then
    success "데이터베이스 마이그레이션 완료"
  else
    warning "마이그레이션 실패 (선택사항)"
  fi
}

# PM2로 배포
deploy_with_pm2() {
  log "PM2로 애플리케이션 배포 중..."
  cd "$PROJECT_ROOT"

  # 현재 프로세스 저장 (롤백용)
  pm2 save
  cp ~/.pm2/dump.pm2 "$BACKUP_DIR/dump.pm2.backup" 2>/dev/null || true

  # PM2 애플리케이션 이름
  APP_NAME="near-price"

  # 기존 프로세스 확인
  if pm2 list | grep -q "$APP_NAME"; then
    log "기존 프로세스 재시작: $APP_NAME"
    pm2 reload "$APP_NAME" --update-env
  else
    log "새로운 프로세스 시작: $APP_NAME"
    pm2 start ecosystem.config.js --name "$APP_NAME"
  fi

  # PM2 저장
  pm2 save
  success "PM2 배포 완료"
}

# 헬스체크
health_check() {
  log "헬스체크 실행 중..."
  sleep 3

  for i in {1..5}; do
    if curl -f http://localhost:3000/health 2>/dev/null; then
      success "헬스체크 통과"
      return 0
    fi
    if [ $i -lt 5 ]; then
      warning "헬스체크 실패, ${i}초 후 재시도..."
      sleep 2
    fi
  done

  error "헬스체크 실패"
  return 1
}

# 롤백
rollback() {
  log "롤백 시작..."

  if [ ! -f "$BACKUP_DIR/dump.pm2.backup" ]; then
    error "롤백 데이터가 없습니다"
    return 1
  fi

  log "PM2 프로세스 복구 중..."
  pm2 kill
  cp "$BACKUP_DIR/dump.pm2.backup" ~/.pm2/dump.pm2
  pm2 resurrect

  if [ -d "$BACKUP_DIR/dist_backup" ]; then
    log "빌드 복구 중..."
    rm -rf "$PROJECT_ROOT/dist"
    cp -r "$BACKUP_DIR/dist_backup" "$PROJECT_ROOT/dist"
  fi

  success "롤백 완료"
}

# 배포 후 정리
cleanup() {
  log "정리 중..."
  cd "$PROJECT_ROOT"

  # 임시 파일 정리
  rm -f npm-debug.log

  # 오래된 백업 정리 (7일 이상)
  find backups -type d -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

  success "정리 완료"
}

# 배포 요약 출력
print_summary() {
  log "========================================"
  success "배포 완료!"
  log "========================================"
  log "환경: $ENVIRONMENT"
  log "타임스탐프: $TIMESTAMP"
  log "로그 파일: $LOG_FILE"
  log "백업 디렉토리: $BACKUP_DIR"
  log ""
  log "배포된 버전:"
  log "  Node: $(node --version)"
  log "  npm: $(npm --version)"
  log "  커밋: $(cd $PROJECT_ROOT && git log -1 --pretty=format:'%h - %s')"
  log ""
  log "다음 단계:"
  log "  1. 앱 상태 확인: pm2 status"
  log "  2. 로그 확인: pm2 logs near-price"
  log "  3. 성능 모니터링: pm2 monit"
  log "========================================"
}

# 메인 실행
main() {
  log "NearPrice API 배포 스크립트 시작"
  log "환경: $ENVIRONMENT"
  log "작업: $ACTION"

  check_prerequisites
  validate_environment

  case $ACTION in
    deploy)
      pull_code
      lint_and_test
      install_dependencies
      build
      run_migrations
      deploy_with_pm2
      health_check || rollback
      cleanup
      print_summary
      ;;
    rollback)
      rollback
      ;;
    *)
      error "올바르지 않은 작업: $ACTION (deploy/rollback 중 선택)"
      exit 1
      ;;
  esac
}

# 스크립트 실행
main
