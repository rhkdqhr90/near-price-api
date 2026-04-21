# NearPrice API 인프라 가이드

AWS Terraform을 이용한 NearPrice API 인프라 구성 및 배포 안내서입니다.

**목차**
- [1. 전체 아키텍처](#1-전체-아키텍처)
- [2. Terraform 설정](#2-terraform-설정)
- [3. 배포 파이프라인 (SSM)](#3-배포-파이프라인-ssm)
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
│  │  │  • Docker Compose API Stack             │   │   │
│  │  │  • SSM 원격 명령 배포                    │   │   │
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

## 3. 배포 파이프라인 (SSM)

운영 배포는 **SSM 단일 경로**를 사용합니다.

- GitHub Actions push 기반 자동 배포를 사용하지 않습니다.
- 로컬에서 아카이브를 만들고 S3 `deploy/` 경로에 업로드합니다.
- SSM `send-command`로 EC2에서 배포/마이그레이션/헬스체크를 실행합니다.

### 3.1 사전 준비

```bash
# AWS 인증 확인
aws sts get-caller-identity --profile nearprice_admin --region ap-northeast-2

# Terraform 출력으로 배포 대상 확인
cd infra/terraform
terraform output ec2_deployment_info
terraform output s3_deployment_info
```

### 3.2 표준 배포 순서

1. `git archive`로 배포 아카이브 생성
2. S3 `deploy/` 업로드
3. SSM으로 EC2 배포 명령 실행
4. `docker compose --build` + `migration:run:prod`
5. `/health`, `/price/recent` 검증

### 3.3 배포 명령 예시

```bash
# 1) 아카이브 생성 + 업로드
COMMIT_SHA=$(git rev-parse --short HEAD)
git archive --format=tar.gz -o "/tmp/near-price-api-${COMMIT_SHA}.tar.gz" HEAD
aws s3 cp "/tmp/near-price-api-${COMMIT_SHA}.tar.gz" \
  "s3://<DEPLOY_BUCKET>/deploy/near-price-api-${COMMIT_SHA}.tar.gz" \
  --profile nearprice_admin --region ap-northeast-2

# 2) SSM 배포 실행
aws ssm send-command \
  --profile nearprice_admin \
  --region ap-northeast-2 \
  --instance-ids "<EC2_INSTANCE_ID>" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "set -euo pipefail",
    "aws s3 cp s3://<DEPLOY_BUCKET>/deploy/near-price-api-${COMMIT_SHA}.tar.gz /tmp/deploy.tar.gz",
    "tar --no-same-owner -xzf /tmp/deploy.tar.gz -C /home/ec2-user/near-price-api",
    "cd /home/ec2-user/near-price-api",
    "docker compose -f deploy/docker-compose.yml --env-file .env up -d --build api nginx",
    "docker exec near-price-api npm run typeorm:migration:run:prod",
    "curl -f http://localhost/health"
  ]'
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

운영 배포는 **SSM 경로만 사용**합니다.

```bash
# 1) 배포 아카이브 S3 업로드
COMMIT_SHA=$(git rev-parse --short HEAD)
git archive --format=tar.gz -o "/tmp/near-price-api-${COMMIT_SHA}.tar.gz" HEAD
aws s3 cp "/tmp/near-price-api-${COMMIT_SHA}.tar.gz" \
  "s3://<DEPLOY_BUCKET>/deploy/near-price-api-${COMMIT_SHA}.tar.gz" \
  --profile nearprice_admin --region ap-northeast-2

# 2) SSM으로 배포 실행
aws ssm send-command \
  --profile nearprice_admin \
  --region ap-northeast-2 \
  --instance-ids "<EC2_INSTANCE_ID>" \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=[
    "set -euo pipefail",
    "aws s3 cp s3://<DEPLOY_BUCKET>/deploy/near-price-api-${COMMIT_SHA}.tar.gz /tmp/deploy.tar.gz",
    "tar --no-same-owner -xzf /tmp/deploy.tar.gz -C /home/ec2-user/near-price-api",
    "cd /home/ec2-user/near-price-api",
    "docker compose -f deploy/docker-compose.yml --env-file .env up -d --build api nginx",
    "docker exec near-price-api npm run typeorm:migration:run:prod"
  ]'
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

### 5.2 Docker 컨테이너 모니터링

```bash
# EC2 접속 후
ssh -i ~/.ssh/near-price-key.pem ec2-user@<ELASTIC_IP>

# 컨테이너 상태 확인
cd /home/ec2-user/near-price-api
docker compose -f deploy/docker-compose.yml ps

# 실시간 로그
docker logs -f near-price-api

# 리소스 사용량
docker stats near-price-api near-price-nginx near-price-db near-price-redis
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
# 롤백할 커밋으로 아카이브 생성 + 업로드
ROLLBACK_SHA=<COMMIT_HASH>
git archive --format=tar.gz -o "/tmp/near-price-api-${ROLLBACK_SHA}.tar.gz" "${ROLLBACK_SHA}"
aws s3 cp "/tmp/near-price-api-${ROLLBACK_SHA}.tar.gz" \
  "s3://<DEPLOY_BUCKET>/deploy/near-price-api-${ROLLBACK_SHA}.tar.gz" \
  --profile nearprice_admin --region ap-northeast-2

# SSM으로 동일 배포 절차 실행 (아카이브 키만 롤백 SHA 사용)
# docker compose 재기동 + migration 실행 후 /health 검증
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
# API 컨테이너 로그 확인
docker logs --tail 300 near-price-api

# 컨테이너 상태 확인
cd /home/ec2-user/near-price-api
docker compose -f deploy/docker-compose.yml ps

# migration 실행 실패 확인
docker exec near-price-api npm run typeorm:migration:show

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

# 컨테이너 메모리 사용량
docker stats near-price-api near-price-nginx near-price-db near-price-redis

# API 재빌드/재기동
cd /home/ec2-user/near-price-api
docker compose -f deploy/docker-compose.yml --env-file .env up -d --build api
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
- [AWS Systems Manager Run Command](https://docs.aws.amazon.com/systems-manager/latest/userguide/run-command.html)

---

## 11. 지원

문제가 발생하면:

1. 로그 파일 확인
2. 문서의 트러블슈팅 섹션 참고
3. AWS 지원팀에 문의
4. GitHub Issues에 질문 등록

마지막 업데이트: 2026년 4월 21일
