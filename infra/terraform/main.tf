# NearPrice API - AWS 인프라 Terraform 코드
# AWS 프로바이더 설정 (서울 리전: ap-northeast-2)

terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # 원격 백엔드 설정
  # 먼저 수동으로 생성 후 활성화:
  #   aws s3 mb s3://nearprice-terraform-state --region ap-northeast-2
  #   aws dynamodb create-table --table-name nearprice-terraform-locks \
  #     --attribute-definitions AttributeName=LockID,AttributeType=S \
  #     --key-schema AttributeName=LockID,KeyType=HASH \
  #     --billing-mode PAY_PER_REQUEST --region ap-northeast-2
  # 그 다음: terraform init -migrate-state
  # backend "s3" {
  #   bucket         = "nearprice-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-northeast-2"
  #   dynamodb_table = "nearprice-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      CreatedAt   = timestamp()
      ManagedBy   = "Terraform"
    }
  }
}

# 데이터 소스: 현재 AWS 계정 정보 조회
data "aws_caller_identity" "current" {}

# 데이터 소스: 가용 AZ 정보 조회
data "aws_availability_zones" "available" {
  state = "available"
}

# 로컬 변수
locals {
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
    Terraform   = "true"
  }

  # 사용할 가용 영역 (2개)
  azs = slice(data.aws_availability_zones.available.names, 0, 2)
}

# 출력: 계정 정보
output "aws_account_id" {
  description = "현재 AWS 계정 ID"
  value       = data.aws_caller_identity.current.account_id
}

output "aws_region" {
  description = "AWS 리전"
  value       = var.aws_region
}
