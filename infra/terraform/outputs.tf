# 통합 Outputs

# 배포 정보
output "deployment_info" {
  description = "배포 정보 요약"
  value = {
    project_name = var.project_name
    environment  = var.environment
    region       = var.aws_region
    account_id   = data.aws_caller_identity.current.account_id
  }
}

# EC2 배포 정보
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

# RDS 배포 정보
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

# VPC 정보
output "vpc_deployment_info" {
  description = "VPC 배포 정보"
  value = {
    vpc_id              = aws_vpc.main.id
    vpc_cidr            = aws_vpc.main.cidr_block
    public_subnets      = aws_subnet.public[*].id
    private_subnets     = aws_subnet.private[*].id
    availability_zones  = local.azs
  }
}

# S3 정보
output "s3_deployment_info" {
  description = "S3 버킷 정보"
  value = {
    bucket_name = aws_s3_bucket.app_uploads.id
    bucket_arn  = aws_s3_bucket.app_uploads.arn
    region      = aws_s3_bucket.app_uploads.region
  }
}

# 보안 그룹 정보
output "security_groups_info" {
  description = "보안 그룹 정보"
  value = {
    api_sg_id = aws_security_group.api_server.id
    rds_sg_id = aws_security_group.rds_postgres.id
    alb_sg_id = aws_security_group.alb.id
  }
}

# SSH 접속 정보
output "ssh_connection_commands" {
  description = "SSH 접속 명령어 (키 페어 필요)"
  value = [
    for ip in aws_eip.api_server[*].public_ip :
    "ssh -i /path/to/${var.key_pair_name}.pem ec2-user@${ip}"
  ]
}

# 환경 변수 파일 생성 정보
output "env_file_template" {
  description = "EC2에 설정할 환경 변수 (.env 파일 템플릿)"
  value = {
    database_url = "postgresql://${aws_db_instance.postgres.username}:PASSWORD@${aws_db_instance.postgres.address}:${aws_db_instance.postgres.port}/${aws_db_instance.postgres.db_name}"
    db_host      = aws_db_instance.postgres.address
    db_port      = aws_db_instance.postgres.port
    db_name      = aws_db_instance.postgres.db_name
    db_user      = aws_db_instance.postgres.username
    s3_bucket    = aws_s3_bucket.app_uploads.id
    s3_region    = var.aws_region
    node_env     = var.environment
    api_url      = "https://api.nearprice.dev"  # 실제 도메인으로 변경
  }
  sensitive = true
}

# 다음 단계 안내
output "next_steps" {
  description = "다음 단계"
  value = <<-EOT
    1. Terraform 계획 확인:
       terraform plan -var-file=terraform.tfvars

    2. 인프라 배포:
       terraform apply -var-file=terraform.tfvars

    3. 출력값 저장:
       terraform output -json > outputs.json

    4. EC2 접속:
       ssh -i ~/.ssh/${var.key_pair_name}.pem ec2-user@<PUBLIC_IP>

    5. 환경 변수 설정:
       - RDS 비밀번호는 AWS Secrets Manager에 저장
       - 또는 /home/ec2-user/.env 파일 생성

    6. 애플리케이션 배포:
       - GitHub Actions로 자동 배포 설정 (CI/CD)
       - 또는 deploy.sh 스크립트 실행

    7. 데이터베이스 마이그레이션:
       npm run typeorm migration:run

    8. 애플리케이션 시작:
       pm2 start ecosystem.config.js
  EOT
}
