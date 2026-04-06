# 통합 Outputs

# ─────────────────────────────────────────────
# 배포 정보
# ─────────────────────────────────────────────
output "deployment_info" {
  description = "배포 정보 요약"
  value = {
    project_name = var.project_name
    environment  = var.environment
    region       = var.aws_region
    account_id   = data.aws_caller_identity.current.account_id
  }
}

# ─────────────────────────────────────────────
# EC2 배포 정보
# ─────────────────────────────────────────────
output "ec2_deployment_info" {
  description = "EC2 배포 정보"
  value = {
    instance_count = var.ec2_instance_count
    instance_type  = var.instance_type
    public_ips     = aws_eip.api_server[*].public_ip
    private_ips    = aws_instance.api_server[*].private_ip
    security_group = aws_security_group.api_server.id
  }
  sensitive = false
}

# SSH 접속 명령어
output "ssh_connection_commands" {
  description = "SSH 접속 명령어 (키 페어 필요)"
  value = [
    for ip in aws_eip.api_server[*].public_ip :
    "ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@${ip}"
  ]
}

# ─────────────────────────────────────────────
# ALB (로드밸런서) 정보
# ─────────────────────────────────────────────
output "alb_deployment_info" {
  description = "ALB 배포 정보"
  value = var.enable_alb ? {
    dns_name         = aws_lb.main[0].dns_name
    zone_id          = aws_lb.main[0].zone_id
    arn              = aws_lb.main[0].arn
    target_group_arn = aws_lb_target_group.api[0].arn
  } : null
}

# ─────────────────────────────────────────────
# RDS 배포 정보
# ─────────────────────────────────────────────
output "rds_deployment_info" {
  description = "RDS 배포 정보"
  value = {
    endpoint       = aws_db_instance.postgres.endpoint
    address        = aws_db_instance.postgres.address
    port           = aws_db_instance.postgres.port
    database       = aws_db_instance.postgres.db_name
    username       = aws_db_instance.postgres.username
    engine_version = aws_db_instance.postgres.engine_version
    storage_size   = aws_db_instance.postgres.allocated_storage
  }
  sensitive = true
}

# ─────────────────────────────────────────────
# ElastiCache Redis 정보
# ─────────────────────────────────────────────
output "redis_deployment_info" {
  description = "Redis 배포 정보"
  value = var.enable_elasticache ? {
    primary_endpoint = aws_elasticache_replication_group.redis[0].primary_endpoint_address
    reader_endpoint  = aws_elasticache_replication_group.redis[0].reader_endpoint_address
    port             = aws_elasticache_replication_group.redis[0].port
    node_type        = var.redis_node_type
    num_nodes        = var.redis_num_nodes
  } : null
  sensitive = false
}

# ─────────────────────────────────────────────
# VPC 정보
# ─────────────────────────────────────────────
output "vpc_deployment_info" {
  description = "VPC 배포 정보"
  value = {
    vpc_id             = aws_vpc.main.id
    vpc_cidr           = aws_vpc.main.cidr_block
    public_subnets     = aws_subnet.public[*].id
    private_subnets    = aws_subnet.private[*].id
    availability_zones = local.azs
    nat_gateway_enabled = var.enable_nat_gateway
  }
}

# ─────────────────────────────────────────────
# CloudFront CDN 정보
# ─────────────────────────────────────────────
output "cloudfront_domain" {
  description = "이미지 CDN 도메인 — .env CLOUDFRONT_DOMAIN에 설정"
  value       = aws_cloudfront_distribution.uploads.domain_name
}

output "cloudfront_distribution_id" {
  description = "CloudFront Distribution ID (캐시 무효화에 필요)"
  value       = aws_cloudfront_distribution.uploads.id
}

# ─────────────────────────────────────────────
# S3 정보
# ─────────────────────────────────────────────
output "s3_deployment_info" {
  description = "S3 버킷 정보"
  value = {
    bucket_name = aws_s3_bucket.app_uploads.id
    bucket_arn  = aws_s3_bucket.app_uploads.arn
    region      = aws_s3_bucket.app_uploads.region
  }
}

# ─────────────────────────────────────────────
# ACM 인증서 정보
# ─────────────────────────────────────────────
output "acm_deployment_info" {
  description = "ACM 인증서 정보"
  value = var.enable_alb ? {
    certificate_arn    = aws_acm_certificate.api[0].arn
    certificate_status = aws_acm_certificate.api[0].status
    domain_name        = var.domain_name
  } : null
}

output "acm_dns_validation_records" {
  description = "ACM DNS 검증 레코드 (도메인 업체에 추가 필요)"
  value = var.enable_alb ? {
    for dvo in aws_acm_certificate.api[0].domain_validation_options :
    dvo.domain_name => {
      type  = dvo.resource_record_type
      name  = dvo.resource_record_name
      value = dvo.resource_record_value
    }
  } : {}
}

# ─────────────────────────────────────────────
# 보안 그룹 정보
# ─────────────────────────────────────────────
output "security_groups_info" {
  description = "보안 그룹 정보"
  value = {
    api_sg_id   = aws_security_group.api_server.id
    rds_sg_id   = aws_security_group.rds_postgres.id
    alb_sg_id   = var.enable_alb ? aws_security_group.alb[0].id : null
    redis_sg_id = var.enable_elasticache ? aws_security_group.elasticache_redis[0].id : null
  }
}

# ─────────────────────────────────────────────
# .env 파일 템플릿 (EC2 환경 변수 설정 참고용)
# ─────────────────────────────────────────────
output "env_file_template" {
  description = ".env 파일 설정 참고 (민감 정보 포함)"
  value = {
    # DB
    DATABASE_URL = "postgresql://${aws_db_instance.postgres.username}:DB_PASSWORD@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${aws_db_instance.postgres.db_name}"
    DB_HOST      = aws_db_instance.postgres.address
    DB_PORT      = aws_db_instance.postgres.port
    DB_NAME      = aws_db_instance.postgres.db_name
    DB_USER      = aws_db_instance.postgres.username
    # Redis
    REDIS_HOST   = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : ""
    REDIS_PORT   = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].port : ""
    # S3 / CloudFront
    S3_BUCKET         = aws_s3_bucket.app_uploads.id
    S3_REGION         = var.aws_region
    CLOUDFRONT_DOMAIN = aws_cloudfront_distribution.uploads.domain_name
    # App
    NODE_ENV = var.environment
    PORT     = "3000"
    API_URL  = "https://${var.domain_name}"
  }
  sensitive = true
}

# ─────────────────────────────────────────────
# 다음 단계 안내
# ─────────────────────────────────────────────
output "next_steps" {
  description = "다음 단계"
  value       = <<-EOT
    ╔══════════════════════════════════════════════════╗
    ║          NearPrice 인프라 배포 가이드            ║
    ╚══════════════════════════════════════════════════╝

    1. (enable_alb=true인 경우) ACM 인증서 DNS 검증 완료
       terraform output acm_dns_validation_records

    2. Terraform 계획 확인:
       terraform plan -var-file=terraform.tfvars

    3. 인프라 배포:
       terraform apply -var-file=terraform.tfvars

    4. (enable_alb=true) ALB DNS 이름 → 도메인 CNAME 연결:
       terraform output alb_dns_name
       (enable_alb=false) EC2 Public IP를 DNS A 레코드로 연결

    5. EC2 SSH 접속:
       ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@<PUBLIC_IP>

    6. EC2에 .env 설정:
       terraform output -json env_file_template

    7. Docker Compose로 애플리케이션 시작:
       docker-compose -f deploy/docker-compose.yml up -d

    8. 데이터베이스 마이그레이션:
       npm run typeorm migration:run

    ※ Redis AUTH 토큰은 enable_elasticache=true 일 때만 필요
    ※ DB 비밀번호: terraform.tfvars의 db_password 값과 동일
  EOT
}
