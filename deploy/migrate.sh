#!/bin/bash
# NearPrice API 데이터베이스 마이그레이션 스크립트
# 사용법: ./migrate.sh [action] [--dry-run]
# 예: ./migrate.sh run
# 예: ./migrate.sh show --dry-run
# 예: ./migrate.sh revert

set -e

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 변수
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ACTION="${1:-show}"
DRY_RUN="${2:-}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_FILE="${PROJECT_ROOT}/logs/migration_${TIMESTAMP}.log"

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

  # npm 확인
  if ! command -v npm &> /dev/null; then
    error "npm이 설치되지 않았습니다"
    exit 1
  fi

  # 로그 디렉토리 생성
  mkdir -p "$(dirname "$LOG_FILE")"

  success "사전 확인 완료"
}

# 마이그레이션 파일 확인
check_migrations() {
  log "마이그레이션 파일 확인 중..."

  MIGRATION_DIR="$PROJECT_ROOT/src/database/migrations"

  if [ ! -d "$MIGRATION_DIR" ]; then
    error "마이그레이션 디렉토리를 찾을 수 없습니다: $MIGRATION_DIR"
    exit 1
  fi

  MIGRATION_COUNT=$(find "$MIGRATION_DIR" -name "*.ts" | wc -l)
  success "발견된 마이그레이션: $MIGRATION_COUNT개"

  if [ "$MIGRATION_COUNT" -eq 0 ]; then
    warning "마이그레이션 파일이 없습니다"
  fi
}

# 마이그레이션 상태 확인
show_migrations() {
  log "마이그레이션 상태 확인 중..."
  cd "$PROJECT_ROOT"

  npm run typeorm:migration:show || {
    warning "마이그레이션 상태 확인 실패"
    return 1
  }
}

# 마이그레이션 생성
create_migration() {
  local migration_name="$1"

  if [ -z "$migration_name" ]; then
    error "마이그레이션 이름이 필요합니다"
    echo "사용법: ./migrate.sh create [migration_name]"
    exit 1
  fi

  log "마이그레이션 생성 중: $migration_name"
  cd "$PROJECT_ROOT"

  npm run typeorm:migration:create -- -n "$migration_name" || {
    error "마이그레이션 생성 실패"
    exit 1
  }

  success "마이그레이션 생성 완료"
  log "생성된 파일: src/database/migrations/${migration_name}.ts"
}

# 마이그레이션 실행
run_migrations() {
  log "마이그레이션 실행 중..."

  # 환경 변수 확인
  if [ -z "$DATABASE_URL" ]; then
    warning "DATABASE_URL 환경 변수가 설정되지 않았습니다"
    if [ -f "$PROJECT_ROOT/.env" ]; then
      log ".env 파일에서 환경 변수 로드 중..."
      set -a
      source "$PROJECT_ROOT/.env"
      set +a
    fi
  fi

  if [ -z "$DATABASE_URL" ]; then
    error "DATABASE_URL을 설정해주세요"
    exit 1
  fi

  log "데이터베이스 연결 확인 중..."
  cd "$PROJECT_ROOT"

  # Dry-run 모드 확인
  if [ "$DRY_RUN" = "--dry-run" ]; then
    log "[DRY-RUN 모드] 마이그레이션을 실행하지 않고 계획만 표시합니다"
    npm run typeorm:migration:show || {
      error "마이그레이션 계획 실패"
      exit 1
    }
    success "[DRY-RUN] 마이그레이션 계획 완료"
  else
    # 마이그레이션 실행
    log "마이그레이션 실행 중..."
    npm run typeorm:migration:run || {
      error "마이그레이션 실행 실패"
      exit 1
    }
    success "마이그레이션 완료"
  fi
}

# 마이그레이션 되돌리기
revert_migrations() {
  log "마지막 마이그레이션 되돌리는 중..."

  # 확인 메시지
  warning "마지막 마이그레이션이 되돌려집니다. 이를 취소할 수 없습니다."
  read -p "계속 진행하시겠습니까? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    log "작업 취소됨"
    exit 0
  fi

  cd "$PROJECT_ROOT"

  npm run typeorm:migration:revert || {
    error "마이그레이션 되돌리기 실패"
    exit 1
  }

  success "마이그레이션 되돌리기 완료"
}

# 마이그레이션 생성 (자동 감지)
generate_migrations() {
  log "엔티티 변경사항 감지하여 마이그레이션 생성 중..."

  # 타임스탐프로 마이그레이션 이름 생성
  local migration_name="Migration_$(date +%s)"

  cd "$PROJECT_ROOT"

  npm run typeorm:migration:generate -- -n "$migration_name" || {
    error "마이그레이션 생성 실패"
    exit 1
  }

  success "마이그레이션 생성 완료"
  log "생성된 파일: src/database/migrations/${migration_name}.ts"
}

# 마이그레이션 요약 출력
print_summary() {
  log "========================================"
  success "마이그레이션 작업 완료!"
  log "========================================"
  log "작업: $ACTION"
  if [ "$DRY_RUN" = "--dry-run" ]; then
    log "모드: DRY-RUN (실행하지 않음)"
  fi
  log "타임스탐프: $TIMESTAMP"
  log "로그 파일: $LOG_FILE"
  log ""
  log "다음 단계:"
  log "  1. 마이그레이션 상태 확인: npm run typeorm:migration:show"
  log "  2. 앱 재시작: pm2 restart near-price"
  log "  3. 로그 확인: pm2 logs near-price"
  log "========================================"
}

# 메인 실행
main() {
  log "데이터베이스 마이그레이션 스크립트 시작"
  log "작업: $ACTION"

  check_prerequisites
  check_migrations

  case $ACTION in
    show)
      show_migrations
      ;;
    run)
      run_migrations
      ;;
    revert)
      revert_migrations
      ;;
    generate)
      generate_migrations
      ;;
    create)
      create_migration "$2"
      ;;
    *)
      error "올바르지 않은 작업: $ACTION"
      echo ""
      echo "사용 가능한 작업:"
      echo "  show      - 마이그레이션 상태 확인"
      echo "  run       - 마이그레이션 실행"
      echo "  revert    - 마지막 마이그레이션 되돌리기"
      echo "  generate  - 엔티티 변경사항으로부터 마이그레이션 자동 생성"
      echo "  create    - 새로운 마이그레이션 파일 생성"
      echo ""
      echo "옵션:"
      echo "  --dry-run - 실제로 실행하지 않고 계획만 표시"
      exit 1
      ;;
  esac

  print_summary
}

# 스크립트 실행
main
