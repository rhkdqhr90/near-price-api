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

  # 원격 백엔드 설정 (초기 사용 시 주석 해제)
  # backend "s3" {
  #   bucket         = "near-price-terraform-state"
  #   key            = "prod/terraform.tfstate"
  #   region         = "ap-northeast-2"
  #   encrypt        = true
  #   dynamodb_table = "terraform-lock"
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
