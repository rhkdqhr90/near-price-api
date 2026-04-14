# 변수 정의

variable "aws_region" {
  description = "AWS 리전"
  type        = string
  default     = "ap-northeast-2"
}

variable "project_name" {
  description = "프로젝트 이름"
  type        = string
  default     = "near-price"
}

variable "environment" {
  description = "환경 (dev, staging, prod)"
  type        = string
  default     = "prod"
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "environment은 dev, staging, prod 중 하나여야 합니다."
  }
}

# ─────────────────────────────────────────────
# VPC 설정
# ─────────────────────────────────────────────
variable "vpc_cidr" {
  description = "VPC CIDR 블록"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidrs" {
  description = "Public Subnet CIDR 블록"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "private_subnet_cidrs" {
  description = "Private Subnet CIDR 블록"
  type        = list(string)
  default     = ["10.0.11.0/24", "10.0.12.0/24"]
}

# [신규] NAT Gateway 활성화 (Private 서브넷 인터넷 접근 필요 시)
# 비용 주의: ~$32/월 + 데이터 전송 비용 발생
variable "enable_nat_gateway" {
  description = "NAT Gateway 활성화 (프라이빗 서브넷 → 인터넷 필요 시)"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────
# EC2 설정
# ─────────────────────────────────────────────
variable "instance_type" {
  description = "EC2 인스턴스 타입"
  type        = string
  default     = "t3.micro"
}

variable "enable_alb" {
  description = "ALB/ACM 기반 HTTPS 엔드포인트 활성화"
  type        = bool
  default     = false
}

variable "enable_direct_ec2_ingress" {
  description = "ALB 없이 EC2 80/443 직접 인바운드 허용"
  type        = bool
  default     = true
}

variable "key_pair_name" {
  description = "EC2 접속용 키 페어 이름 (AWS에서 사전 생성 필요)"
  type        = string
  sensitive   = false
}

variable "ec2_instance_count" {
  description = "EC2 인스턴스 개수 (고가용성을 위해 2개 권장)"
  type        = number
  default     = 1
  validation {
    condition     = var.ec2_instance_count >= 1 && var.ec2_instance_count <= 2
    error_message = "인스턴스 개수는 1~2개여야 합니다."
  }
}

variable "enable_monitoring" {
  description = "CloudWatch 상세 모니터링 활성화"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────
# RDS 설정
# ─────────────────────────────────────────────
variable "db_allocated_storage" {
  description = "RDS 스토리지 크기 (GB)"
  type        = number
  default     = 20
}

variable "db_instance_class" {
  description = "RDS 인스턴스 클래스"
  type        = string
  default     = "db.t3.micro"
}

variable "db_engine_version" {
  description = "PostgreSQL 버전"
  type        = string
  default     = "16.13"
}

variable "db_name" {
  description = "초기 데이터베이스 이름"
  type        = string
  default     = "nearprice"
}

variable "db_username" {
  description = "데이터베이스 관리자 사용자명"
  type        = string
  default     = "nearprice_admin"
}

variable "db_password" {
  description = "데이터베이스 관리자 비밀번호 (최소 8자, 특수문자 포함 권장)"
  type        = string
  sensitive   = true
}

variable "db_backup_retention_days" {
  description = "자동 백업 보관 기간 (일)"
  type        = number
  default     = 7
  validation {
    condition     = var.db_backup_retention_days >= 1 && var.db_backup_retention_days <= 35
    error_message = "백업 보관 기간은 1~35일 범위여야 합니다."
  }
}

variable "db_backup_window" {
  description = "자동 백업 시간 (UTC, hh:mm-hh:mm 형식)"
  type        = string
  default     = "02:00-03:00"
}

variable "db_maintenance_window" {
  description = "유지보수 시간 (UTC, ddd:hh:mm-ddd:hh:mm 형식)"
  type        = string
  default     = "sun:03:00-sun:04:00"
}

variable "db_multi_az" {
  description = "Multi-AZ 배포 활성화 (프로덕션 환경에서만 권장)"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────
# [신규] ElastiCache Redis 설정
# ─────────────────────────────────────────────
variable "redis_node_type" {
  description = "ElastiCache Redis 노드 타입"
  type        = string
  default     = "cache.t2.micro"
  # 프리 티어: cache.t2.micro (12개월)
  # MVP 권장: cache.t3.micro (~$15/월)
  # 프로덕션: cache.t3.small 이상
}

variable "enable_elasticache" {
  description = "ElastiCache Redis 생성 여부"
  type        = bool
  default     = false
}

variable "redis_num_nodes" {
  description = "Redis 클러스터 노드 수 (1=단일, 2=Primary+Replica)"
  type        = number
  default     = 1
  validation {
    condition     = var.redis_num_nodes >= 1 && var.redis_num_nodes <= 3
    error_message = "Redis 노드 수는 1~3 이어야 합니다."
  }
}

variable "redis_auth_token" {
  description = "Redis AUTH 토큰 (16자 이상, transit_encryption_enabled=true 필수)"
  type        = string
  default     = ""
  sensitive   = true
  validation {
    condition     = var.enable_elasticache ? length(var.redis_auth_token) >= 16 : true
    error_message = "enable_elasticache=true 인 경우 redis_auth_token은 최소 16자 이상이어야 합니다."
  }
}

variable "enable_vpc_flow_logs" {
  description = "VPC Flow Logs 활성화"
  type        = bool
  default     = false
}

# ─────────────────────────────────────────────
# [신규] 도메인 / ACM 설정
# ─────────────────────────────────────────────
variable "domain_name" {
  description = "서비스 도메인 이름 (예: masil.kr)"
  type        = string
  default     = "masil.kr"
}

# ─────────────────────────────────────────────
# 보안 그룹 설정
# ─────────────────────────────────────────────

# [수정] 기본값을 빈 리스트로 변경 → tfvars에서 반드시 지정
variable "allowed_ssh_cidrs" {
  description = "SSH 접속 허용 CIDR 목록 (관리자 IP/32 형식으로 지정 필수, tfvars에서 반드시 설정)"
  type        = list(string)
  # 기본값 없음 → terraform.tfvars에서 반드시 지정해야 plan/apply 가능
  # 예: allowed_ssh_cidrs = ["1.2.3.4/32"]

  validation {
    condition     = length(var.allowed_ssh_cidrs) > 0
    error_message = "allowed_ssh_cidrs must be explicitly specified (e.g. [\"your-ip/32\"]). Never use 0.0.0.0/0 in production."
  }
}

variable "allowed_http_cidrs" {
  description = "HTTP 접속 허용 CIDR"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

variable "allowed_https_cidrs" {
  description = "HTTPS 접속 허용 CIDR"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# ─────────────────────────────────────────────
# 태그
# ─────────────────────────────────────────────
variable "tags" {
  description = "공통 태그"
  type        = map(string)
  default = {
    Owner = "DevOps Team"
    Slack = "@devops"
  }
}
