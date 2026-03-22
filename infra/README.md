# NearPrice API 인프라 가이드

AWS Terraform을 이용한 NearPrice API 인프라 구성 및 배포 안내서입니다.

**목차**
- [1. 전체 아키텍처](#1-전체-아키텍처)
- [2. Terraform 설정](#2-terraform-설정)
- [3. CI/CD 파이프라인](#3-cicd-파이프라인)
- [4. 배포 절차](#4-배포-절차)
- [5. 모니터링 및 로그](#5-모니터링-및-로그)
- [6. 롤백 절차](#6-롤백-절차)
- [7. 트러블슈팅](#7-트러블슈팅)

---

## 1. 전체 아키텍처

### AWS 인프라 구성

```
┌─────────────────────────────────────────────────────────┐
│                    Internet / Cloudflare                │
└────────────────────────┬────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────┐
│                  AWS VPC (ap-northeast-2)               │
│  CIDR: 10.0.0.0/16                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Public Subnets (2개, 각 AZ)           │   │
│  │  • 10.0.1.0/24 (ap-northeast-2a)               │   │
│  │  • 10.0.2.0/24 (ap-northeast-2c)               │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  EC2 인스턴스 (t3.small)                │   │   │
│  │  │  • Node.js API Server                   │   │   │
│  │  │  • PM2로 프로세스 관리                   │   │   │
│  │  │  • Elastic IP 할당                      │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │         Private Subnets (2개, 각 AZ)            │   │
│  │  • 10.0.11.0/24 (ap-northeast-2a)              │   │
│  │  • 10.0.12.0/24 (ap-northeast-2c)              │   │
│  │                                                 │   │
│  │  ┌─────────────────────────────────────────┐   │   │
│  │  │  RDS PostgreSQL (db.t3.micro)           │   │   │
│  │  │  • Multi-AZ: 비활성화 (MVP)            │   │   │
│  │  │  • 자동 백업: 7일 보관                  │   │   │
│  │  │  • 암호화: 활성화                       │   │   │
│  │  └─────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘

추가 서비스
├─ S3: 이미지 업로드 저장소
├─ CloudWatch: 로그 및 모니터링
├─ IAM: 권한 관리
└─ Secrets Manager: 환경 변수 저장소
```

---

## 2. Terraform 설정

### 2.1 필수 도구 설치

```bash
# Terraform 설치 (macOS)
brew install terraform

# Terraform 설치 (Linux/Ubuntu)
wget https://releases.hashicorp.com/terraform/1.5.0/terraform_1.5.0_linux_amd64.zip
unzip terraform_1.5.0_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# AWS CLI 설치
brew install awscli  # macOS
# 또는
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# 버전 확인
terraform --version
aws --version
```

### 2.2 AWS 계정 설정

```bash
# AWS IAM 사용자 생성 및 액세스 키 생성
# AWS 콘솔에서:
# 1. IAM > 사용자 > 사용자 생성
# 2. 권한: AdministratorAccess (또는 필요한 권한만)
# 3. 액세스 키 생성

# AWS CLI 설정
aws configure
# 다음 정보 입력:
# AWS Access Key ID: [IAM 액세스 키]
# AWS Secret Access Key: [IAM 시크릿 키]
# Default region name: ap-northeast-2
# Default output format: json

# 설정 확인
aws sts get-caller-identity
```

### 2.3 Terraform 초기화

```bash
cd infra/terraform

# 변수 파일 생성
cp terraform.tfvars.example terraform.tfvars

# terraform.tfvars 파일 편집 (실제 값으로 변경)
nano terraform.tfvars
# 또는
vi terraform.tfvars

# 필수 수정 항목:
# - aws_region: ap-northeast-2
# - key_pair_name: EC2 접속용 키 페어 이름
# - db_password: 안전한 데이터베이스 비밀번호
# - allowed_ssh_cidrs: 관리자 IP (보안)

# Terraform 초기화
terraform init

# 형식 검증
terraform fmt -recursive

# 구문 검증
terraform validate

# 보안 검사 (옵션)
tfsec .
```

### 2.4 EC2 키 페어 생성

```bash
# AWS 콘솔 또는 CLI로 생성
aws ec2 create-key-pair \
  --key-name near-price-key \
  --region ap-northeast-2 \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/near-price-key.pem

# 권한 설정
chmod 600 ~/.ssh/near-price-key.pem

# SSH 설정에 추가 (선택사항)
# ~/.ssh/config에 다음 추가:
# Host near-price-api
#   HostName <EC2_PUBLIC_IP>
#   User ec2-user
#   IdentityFile ~/.ssh/near-price-key.pem
#   StrictHostKeyChecking accept-new
```

---

## 3. CI/CD 파이프라인

### 3.1 GitHub Actions 시크릿 설정

GitHub 저장소 설정에서 다음 시크릿을 추가합니다:

**API 배포 관련 시크릿**
```
EC2_HOST          = EC2 Elastic IP 주소
EC2_USER          = ec2-user
EC2_SSH_KEY       = 개인 SSH 키 내용 (~/.ssh/near-price-key.pem)
```

**Android 빌드 관련 시크릿**
```
KEYSTORE_BASE64   = Base64로 인코딩된 keystore 파일
KEYSTORE_PASSWORD = Keystore 비밀번호
KEY_ALIAS         = 서명 키 별칭
KEY_PASSWORD      = 서명 키 비밀번호
API_BASE_URL      = API 엔드포인트 (예: https://api.nearprice.dev)
CLOUDFLARE_DOMAIN = Cloudflare 도메인
SLACK_WEBHOOK     = Slack 웹훅 URL (선택사항)
```

**환경 변수 시크릿**
```
SENTRY_DSN        = Sentry 프로젝트 DSN
FIREBASE_PROJECT_ID = Firebase 프로젝트 ID
FIREBASE_APP_ID   = Firebase 앱 ID
FIREBASE_API_KEY  = Firebase API 키
```

### 3.2 SSH 키 설정 (GitHub Actions)

```bash
# 개인 SSH 키 조회
cat ~/.ssh/near-price-key.pem

# GitHub 리포지토리 설정:
# 1. Settings > Secrets and variables > Actions
# 2. New repository secret
# 3. Name: EC2_SSH_KEY
# 4. Value: 위에서 복사한 키 전체 내용
```

### 3.3 배포 파이프라인 자동화

**메인 브랜치 푸시 시 자동 배포**
```bash
git push origin main
# → GitHub Actions 자동 실행
# → .github/workflows/deploy.yml 실행
# → API 서버 자동 배포
```

**수동 배포**
```
GitHub 저장소 > Actions > API 배포 파이프라인 > Run workflow
```

---

## 4. 배포 절차

### 4.1 첫 번째 배포 (인프라 생성)

```bash
cd infra/terraform

# 1. 배포 계획 확인
terraform plan -var-file=terraform.tfvars

# 2. 인프라 생성 (15~20분 소요)
terraform apply -var-file=terraform.tfvars

# 3. 출력값 확인
terraform output

# 4. 출력값 저장 (나중에 참조용)
terraform output -json > outputs.json
```

### 4.2 애플리케이션 배포

**방법 1: GitHub Actions를 통한 자동 배포**
```bash
git push origin main
# GitHub Actions가 자동으로 배포를 시작합니다
```

**방법 2: 수동 배포 스크립트**
```bash
cd deploy

# 배포 실행
chmod +x deploy.sh
./deploy.sh prod deploy

# 또는 staging 환경
./deploy.sh staging deploy
```

**방법 3: EC2에 직접 배포**
```bash
# EC2 접속
ssh -i ~/.ssh/near-price-key.pem ec2-user@<ELASTIC_IP>

# 애플리케이션 디렉토리로 이동
cd ~/near-price-api

# 최신 코드 가져오기
git pull origin main

# 의존성 설치
npm ci --production

# 빌드
npm run build

# 데이터베이스 마이그레이션
npm run typeorm:migration:run

# PM2로 시작
pm2 start ecosystem.config.js
pm2 save
```

### 4.3 데이터베이스 마이그레이션

```bash
# 마이그레이션 상태 확인
npm run typeorm:migration:show

# 마이그레이션 실행
npm run typeorm:migration:run

# 또는 스크립트 사용
chmod +x deploy/migrate.sh
./deploy/migrate.sh run

# Dry-run 모드 (실제 실행하지 않음)
./deploy/migrate.sh run --dry-run
```

---

## 5. 모니터링 및 로그

### 5.1 CloudWatch 로그

```bash
# API 로그 확인
aws logs tail /aws/ec2/near-price-api --follow

# RDS 로그 확인
aws logs tail /aws/rds/instance/near-price-db/postgresql --follow
```

### 5.2 PM2 모니터링

```bash
# EC2 접속 후
ssh -i ~/.ssh/near-price-key.pem ec2-user@<ELASTIC_IP>

# 프로세스 상태 확인
pm2 status

# 실시간 모니터링
pm2 monit

# 로그 확인
pm2 logs near-price

# 상세 정보
pm2 show near-price
```

### 5.3 RDS 모니터링

```bash
# AWS 콘솔에서:
# 1. RDS > 데이터베이스 > near-price-db
# 2. 모니터링 탭에서 CloudWatch 메트릭 확인

# CLI로 확인
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=near-price-db \
  --start-time $(date -d '1 hour ago' -u +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300 \
  --statistics Average
```

### 5.4 알람 설정

```bash
# CloudWatch 알람은 Terraform에서 자동으로 생성됩니다:
# - RDS CPU 사용률 > 80%
# - RDS 여유 저장소 < 2GB
# - RDS 연결 수 > 80

# AWS 콘솔에서 알람 확인:
# CloudWatch > 알람 > 모든 알람
```

---

## 6. 롤백 절차

### 6.1 애플리케이션 롤백

```bash
# 배포 스크립트로 롤백
cd deploy
./deploy.sh prod rollback

# 또는 EC2에서 PM2로 직접 롤백
ssh -i ~/.ssh/near-price-key.pem ec2-user@<ELASTIC_IP>

# PM2 프로세스 목록 확인
pm2 list

# 이전 버전으로 재시작
pm2 restart near-price

# 또는 git으로 이전 커밋으로 돌아가기
cd ~/near-price-api
git log --oneline  # 이전 커밋 확인
git checkout <COMMIT_HASH>
npm install --production
npm run build
pm2 restart near-price
```

### 6.2 데이터베이스 롤백

```bash
# 마이그레이션 되돌리기
./deploy/migrate.sh revert

# 또는 특정 마이그레이션으로 롤백
npm run typeorm:migration:show
npm run typeorm:migration:revert
```

### 6.3 인프라 롤백

```bash
# Terraform 상태 확인
terraform state list
terraform state show aws_db_instance.postgres

# 특정 리소스 제거 (주의!)
terraform destroy -target=aws_instance.api_server

# 또는 전체 인프라 제거
terraform destroy -var-file=terraform.tfvars
```

---

## 7. 트러블슈팅

### 7.1 EC2 SSH 접속 오류

```bash
# "Permission denied" 오류
chmod 600 ~/.ssh/near-price-key.pem

# "Connection timeout" 오류
# → 보안 그룹 확인
aws ec2 describe-security-groups \
  --group-ids sg-xxxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions'

# IP 화이트리스트 추가
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 22 \
  --cidr YOUR_IP/32
```

### 7.2 RDS 연결 오류

```bash
# RDS 엔드포인트 확인
terraform output rds_endpoint

# 보안 그룹 확인
aws ec2 describe-security-groups \
  --filters "Name=group-name,Values=near-price-rds-sg" \
  --query 'SecurityGroups[0].IpPermissions'

# EC2에서 RDS 연결 테스트
ssh -i ~/.ssh/near-price-key.pem ec2-user@<ELASTIC_IP>
psql -h <RDS_ENDPOINT> -U admin -d nearprice
```

### 7.3 배포 실패

```bash
# PM2 로그 확인
pm2 logs near-price --err

# PM2 프로세스 상태 확인
pm2 status
pm2 show near-price

# 애플리케이션 로그 확인
tail -f /var/log/near-price/out.log
tail -f /var/log/near-price/error.log

# 빌드 오류 확인
npm run build --verbose
```

### 7.4 저장소 부족

```bash
# EC2 디스크 사용량 확인
df -h

# 오래된 로그 정리
rm -f /var/log/near-price/*.log.*

# npm 캐시 정리
npm cache clean --force
rm -rf node_modules package-lock.json
npm ci --production

# 이전 빌드 정리
rm -rf dist
npm run build
```

### 7.5 메모리 부족

```bash
# 현재 메모리 사용량 확인
free -h

# PM2 프로세스별 메모리 사용량
pm2 show near-price | grep Memory

# Node.js 힙 크기 조정 (ecosystem.config.js 수정)
# max_old_space_size 값 조정
pm2 restart near-price --update-env
```

---

## 8. 비용 최적화

### 8.1 프리 티어 활용

- **EC2**: t3.small (프리 티어 아님, 약 $0.022/시간)
- **RDS**: db.t3.micro (프리 티어: 월 750시간 무료)
- **S3**: 월 5GB 무료

### 8.2 비용 절감 방법

```bash
# 사용하지 않는 리소스 삭제
terraform destroy -var-file=terraform.tfvars

# 특정 시간에만 EC2 실행
# → EC2 Auto Scaling Group 사용
# → AWS EventBridge로 자동 시작/중지

# RDS 백업 보관 기간 단축
terraform apply -var="db_backup_retention_days=3"

# NAT Gateway 제거 (비용: $0.32/시간)
# → Private Subnet의 아웃바운드는 이미 제외됨
```

---

## 9. 보안

### 9.1 SSH 액세스 제한

```bash
# terraform.tfvars 수정
allowed_ssh_cidrs = ["YOUR_IP/32"]  # 본인 IP만 허용

terraform apply -var-file=terraform.tfvars
```

### 9.2 데이터베이스 보안

```bash
# 강력한 비밀번호 설정
# - 최소 16자
# - 대문자, 소문자, 숫자, 특수문자 포함

# AWS Secrets Manager에 저장
aws secretsmanager create-secret \
  --name near-price/db-password \
  --secret-string "YourSecurePassword123!@#"

# EC2에서 조회
aws secretsmanager get-secret-value \
  --secret-id near-price/db-password
```

### 9.3 IAM 권한 최소화

```bash
# 현재 IAM 정책 검토
aws iam list-user-policies --user-name terraform-user

# 필요한 권한만 부여 (AdministratorAccess 대신)
# - EC2: describe, run, terminate, create-security-group
# - RDS: create, modify, delete
# - VPC: create, delete
# - S3: create, put-object, get-object
# - IAM: create-role, put-role-policy
```

---

## 10. 추가 리소스

- [AWS Terraform Provider 문서](https://registry.terraform.io/providers/hashicorp/aws/latest)
- [Terraform 공식 문서](https://www.terraform.io/docs)
- [AWS VPC 설명서](https://docs.aws.amazon.com/vpc/)
- [RDS PostgreSQL 가이드](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_PostgreSQL.html)
- [GitHub Actions 문서](https://docs.github.com/en/actions)

---

## 11. 지원

문제가 발생하면:

1. 로그 파일 확인
2. 문서의 트러블슈팅 섹션 참고
3. AWS 지원팀에 문의
4. GitHub Issues에 질문 등록

마지막 업데이트: 2026년 3월 20일
