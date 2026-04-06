# 마실앱(near-price-api) Terraform 배포 가이드

> 최종 업데이트: 2026-04
> 인프라: AWS ap-northeast-2 (서울)
> 스택: NestJS 11 + PostgreSQL 16 + Redis 7 + S3/CloudFront + ALB + ACM

## Free Tier 우선 배포 프로필 (권장)

아래 값을 `terraform.tfvars`에 적용하면 비용을 크게 줄일 수 있습니다.

```hcl
instance_type             = "t3.micro"
db_instance_class         = "db.t3.micro"
enable_alb                = false
enable_direct_ec2_ingress = true
enable_elasticache        = false
enable_vpc_flow_logs      = false
enable_nat_gateway        = false
```

- `enable_alb=false` 인 경우: DNS는 `api.<도메인>`을 EC2 Public IP(A 레코드)로 연결합니다.
- `enable_elasticache=false` 인 경우: Redis는 앱의 fallback 동작(무효화 보안 약화)을 감수합니다.
- S3/CloudFront는 유지되어 이미지 업로드 + CDN 경로는 동일하게 사용 가능합니다.

---

## 아키텍처 개요

```
인터넷
  │
  ▼
ALB (80→443 리다이렉트, HTTPS 종단)
  │
  ▼  ACM 인증서 (*.masil.kr)
EC2 t3.small — NestJS :3000  [Public Subnet]
  │         │
  │         ├─▶ RDS PostgreSQL 16   [Private Subnet]
  │         └─▶ ElastiCache Redis 7 [Private Subnet]
  │
  ▼
S3 ◀── CloudFront (이미지 CDN)
```

**주요 설계 원칙**
- RDS·Redis는 Private Subnet에만 배치 → 외부 직접 접근 불가
- NestJS 포트(3000)는 ALB SG에서만 허용 → 직접 노출 차단
- SSH는 `allowed_ssh_cidrs`에 지정된 관리자 IP만 허용
- S3는 CloudFront OAC를 통해서만 접근 가능

---

## 사전 준비

### 1. 도구 설치

```bash
# Terraform 1.0+
brew install terraform   # Mac
# or: https://developer.hashicorp.com/terraform/downloads

# AWS CLI v2
brew install awscli
aws configure   # Access Key, Secret, Region(ap-northeast-2) 입력

# 설치 확인
terraform version   # >= 1.0
aws sts get-caller-identity
```

### 2. AWS 사전 작업 (Terraform 외부에서 1회만 실행)

```bash
# ① EC2 접속용 키 페어 생성 (terraform.tfvars의 key_pair_name과 동일하게)
aws ec2 create-key-pair \
  --key-name near-price-key \
  --query 'KeyMaterial' \
  --output text > ~/.ssh/near-price-key.pem
chmod 400 ~/.ssh/near-price-key.pem

# ② (선택) Terraform 상태 원격 저장용 S3 버킷 생성
# main.tf의 backend "s3" 블록 주석 해제 후 사용
aws s3 mb s3://nearprice-terraform-state --region ap-northeast-2
aws dynamodb create-table \
  --table-name nearprice-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-northeast-2
```

---

## 단계별 배포 절차

### STEP 1 — 환경 변수 파일 작성

```bash
cd near-price-api/infra/terraform

cp terraform.tfvars.example terraform.tfvars
```

`terraform.tfvars`에서 반드시 변경해야 하는 항목:

```hcl
# 도메인 (예: masil.kr)
domain_name = "masil.kr"

# EC2 키 페어 이름 (위에서 생성한 이름)
key_pair_name = "near-price-key"

# RDS 비밀번호 (8자 이상, 특수문자 포함)
db_password = "YourStrongPassword!2024"

# Redis AUTH 토큰 (최소 16자, 영문+숫자+특수문자)
redis_auth_token = "YourRedisToken!2024Secret"

# SSH 허용 IP (관리자 본인 IP/32)
# curl ifconfig.me 로 현재 IP 확인
allowed_ssh_cidrs = ["YOUR_IP/32"]
```

### STEP 2 — Terraform 초기화

```bash
terraform init
```

Remote backend(S3)를 사용하려면 `main.tf`의 `backend "s3"` 블록 주석을 해제하고:

```bash
terraform init -migrate-state
```

### STEP 3 — ACM 인증서 생성 및 DNS 검증 (enable_alb=true 일 때만)

`enable_alb=true`인 경우에만 필요합니다. ACM 인증서는 DNS 검증이 완료되어야 ALB에 연결할 수 있습니다.
`terraform apply`를 한 번에 실행하면 검증 대기 중 30분 타임아웃이 발생할 수 있으므로, **2단계로 나눠서** 진행합니다.

**3-1. 인증서만 먼저 생성:**

```bash
# 인증서 리소스만 먼저 apply
terraform apply -target=aws_acm_certificate.api
```

**3-2. DNS 검증 레코드 확인:**

```bash
terraform output acm_dns_validation_records
```

출력 예시:
```
{
  "masil.kr" = {
    name  = "_abc123.masil.kr."
    type  = "CNAME"
    value = "_xyz456.acm-validations.aws."
  }
}
```

이 CNAME 레코드를 도메인 등록 업체(가비아, 후이즈, AWS Route53 등)에 추가합니다.

**3-3. 검증 완료 확인:**

```bash
# 상태가 ISSUED가 되면 완료 (보통 5~10분 소요)
terraform output acm_certificate_status
```

### STEP 4 — 전체 인프라 배포

```bash
# 배포 계획 확인 (실제 변경 없음)
terraform plan -var-file=terraform.tfvars

# 인프라 생성 (약 10~20분 소요)
terraform apply -var-file=terraform.tfvars
```

주요 생성 리소스:
- VPC + Subnets (Public/Private)
- EC2 t3.small (Amazon Linux 2)
- RDS PostgreSQL 16 (db.t3.micro, Private Subnet)
- ElastiCache Redis 7 (cache.t3.micro, Private Subnet)
- ALB (Application Load Balancer)
- S3 버킷 + CloudFront Distribution
- 각종 Security Group, IAM Role

### STEP 5 — 도메인 연결

`enable_alb=true`면 ALB DNS를 연결하고, `enable_alb=false`면 EC2 Public IP를 A 레코드로 연결합니다.

```bash
terraform output alb_dns_name
# 예: near-price-alb-1234567890.ap-northeast-2.elb.amazonaws.com
```

도메인 등록 업체에서 아래 설정(`enable_alb=true`):
```
api.masil.kr  →  CNAME  →  near-price-alb-1234567890.ap-northeast-2.elb.amazonaws.com
```

Route53을 사용하는 경우 Alias 레코드 사용 (CNAME 대신):
```bash
terraform output alb_zone_id   # Alias Target Zone ID

`enable_alb=false`인 경우 예시:
```
api.masil.kr  →  A  →  <EC2_PUBLIC_IP>
```
```

### STEP 6 — EC2 접속 및 앱 배포

```bash
# SSH 접속
terraform output ssh_connection_commands
# → ssh -i ~/.ssh/near-price-key.pem ec2-user@<IP>

# EC2 접속 후
ssh -i ~/.ssh/near-price-key.pem ec2-user@<PUBLIC_IP>
```

EC2에서 실행할 명령어:

```bash
# .env 파일 생성 (terraform output 값 참고)
cat > /home/ec2-user/near-price-api/.env << 'EOF'
NODE_ENV=production
PORT=3000

# DB (terraform output rds_deployment_info 값 사용)
DB_HOST=<RDS_ADDRESS>
DB_PORT=5432
DB_USERNAME=admin
DB_PASSWORD=<terraform.tfvars의 db_password>
DB_DATABASE=nearprice
DB_SSL=true

# Redis (terraform output redis_deployment_info 값 사용)
REDIS_HOST=<REDIS_ENDPOINT>
REDIS_PORT=6379
REDIS_PASSWORD=<terraform.tfvars의 redis_auth_token>
REDIS_DB=0

# S3 / CloudFront
S3_BUCKET=<terraform output s3_deployment_info>
S3_REGION=ap-northeast-2
CLOUDFRONT_DOMAIN=<terraform output cloudfront_domain>

# JWT
JWT_SECRET=<openssl rand -base64 32 으로 생성>
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# Kakao OAuth
KAKAO_REST_API_KEY=<카카오 개발자 콘솔에서 발급>
BASE_URL=https://api.masil.kr

# Firebase
FIREBASE_PROJECT_ID=<Firebase 콘솔에서 확인>
FIREBASE_PRIVATE_KEY=<Firebase Admin SDK 키>
FIREBASE_CLIENT_EMAIL=<Firebase Admin SDK 이메일>
EOF

# Docker Compose로 배포
cd /home/ec2-user
git clone <your-repo-url> near-price-api
cd near-price-api/deploy

docker-compose up -d

# 로그 확인
docker-compose logs -f api

# 헬스체크
curl http://localhost:3000/health
```

또는 PM2로 배포:

```bash
cd near-price-api
npm install
npm run build
pm2 start dist/main.js --name near-price-api
pm2 startup && pm2 save
```

### STEP 7 — 데이터베이스 마이그레이션

```bash
# EC2에서 실행
cd /home/ec2-user/near-price-api
npm run typeorm migration:run
```

### STEP 8 — 최종 동작 확인

```bash
# HTTPS API 응답 확인
curl https://api.masil.kr/health

# CloudFront CDN 확인
curl https://<CloudFront_Domain>/sample-image.jpg
```

---

## 출력값 활용

배포 완료 후 중요한 output 값들:

```bash
# 모든 output 확인
terraform output

# JSON 형태로 저장 (민감 정보 포함)
terraform output -json > terraform-outputs.json

# .env 파일에 넣을 값들 한번에 확인
terraform output -json env_file_template

# ACM 검증 레코드
terraform output acm_dns_validation_records

# SSH 명령어
terraform output ssh_connection_commands
```

---

## 비용 추정 (ap-northeast-2 기준, 월)

| 서비스 | 스펙 | 예상 비용 |
|--------|------|-----------|
| EC2 t3.small | 1대 | ~$17 |
| RDS db.t3.micro | PostgreSQL 16 | ~$14 |
| ElastiCache cache.t3.micro | Redis 7 | ~$15 |
| ALB | 1개 | ~$16 + 트래픽 |
| CloudFront | 데이터 전송량에 따라 | ~$1~10 |
| S3 | 저장량에 따라 | ~$1~5 |
| EIP | 1개 | ~$4 |
| **합계** | | **~$67~80/월** |

> MVP 단계에서 비용을 줄이려면:
> - ALB 제거 → EC2 직접 Nginx로 처리 (보안 약해짐)
> - RDS → db.t3.micro 유지 (프리티어 12개월)
> - Redis → cache.t2.micro (프리티어 12개월)

---

## 트러블슈팅

### ACM 인증서가 PENDING_VALIDATION에서 안 넘어갈 때

```bash
# 검증 레코드 확인
terraform output acm_dns_validation_records

# DNS 전파 확인 (레코드가 도메인에 추가됐는지)
dig CNAME _abc123.masil.kr

# 검증 완료 강제 대기
terraform apply -target=aws_acm_certificate_validation.api
```

### RDS 접속이 안 될 때

```bash
# EC2에서 psql 접속 테스트
psql -h <RDS_ENDPOINT> -U admin -d nearprice

# 보안 그룹 확인 (EC2 SG가 rds_from_ec2 규칙에 포함되는지)
aws ec2 describe-security-groups --group-ids <rds_sg_id>
```

### Redis 접속이 안 될 때

```bash
# EC2에서 redis-cli 접속 테스트
redis-cli -h <REDIS_ENDPOINT> -p 6379 -a <REDIS_AUTH_TOKEN> ping
# → PONG이 나오면 정상
```

### ALB Health Check 실패 시

```bash
# NestJS /health 엔드포인트 확인 (EC2 내부)
curl http://localhost:3000/health
# → {"status":"ok"} 이어야 함

# ALB Target Group 상태 확인
aws elbv2 describe-target-health \
  --target-group-arn <TARGET_GROUP_ARN>
```

### EC2 IAM 권한 오류 (S3, Secrets Manager)

```bash
# IAM 역할 확인
aws sts get-caller-identity  # EC2에서 실행

# S3 접근 테스트
aws s3 ls s3://<BUCKET_NAME>
```

---

## 인프라 삭제

```bash
# 전체 삭제 (주의: 데이터 삭제됨!)
terraform destroy -var-file=terraform.tfvars

# 개별 리소스 삭제
terraform destroy -target=aws_lb.main -var-file=terraform.tfvars
```

> **주의**: `environment = "prod"`이면 RDS `deletion_protection = true`이므로
> 먼저 콘솔에서 삭제 보호를 해제하거나 `environment = "dev"`로 변경 후 실행.

---

## 보안 체크리스트

배포 전 반드시 확인:

- [ ] `allowed_ssh_cidrs`를 실제 관리자 IP로 변경 (`0.0.0.0/0` 금지)
- [ ] `db_password` 강력한 비밀번호 사용 (8자 이상, 특수문자 포함)
- [ ] `redis_auth_token` 최소 16자 이상 무작위 문자열
- [ ] `terraform.tfvars` 파일을 `.gitignore`에 추가 (민감 정보 포함)
- [ ] EC2 키 페어 `.pem` 파일 안전한 곳에 보관
- [ ] JWT_SECRET은 `openssl rand -base64 32`로 생성
- [ ] 프로덕션에서 `db_multi_az = true` 고려 (고가용성)
