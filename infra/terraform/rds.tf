# RDS PostgreSQL 설정

# RDS 인스턴스
resource "aws_db_instance" "postgres" {
  identifier            = "${var.project_name}-db"
  engine               = "postgres"
  engine_version       = var.db_engine_version
  instance_class       = var.db_instance_class
  allocated_storage    = var.db_allocated_storage
  storage_type         = "gp3"
  storage_encrypted    = true

  # 데이터베이스 설정
  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  # 네트워크 설정
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds_postgres.id]
  publicly_accessible    = false

  # 백업 설정
  backup_retention_period = var.db_backup_retention_days
  backup_window          = var.db_backup_window
  maintenance_window     = var.db_maintenance_window
  copy_tags_to_snapshot  = true

  # 고가용성
  multi_az = var.db_multi_az

  # 성능 인사이트 (선택사항)
  performance_insights_enabled    = var.environment == "prod"
  performance_insights_retention_period = 7

  # 모니터링
  enabled_cloudwatch_logs_exports = ["postgresql"]
  monitoring_interval             = var.enable_monitoring ? 60 : 0
  monitoring_role_arn            = var.enable_monitoring ? aws_iam_role.rds_monitoring[0].arn : null

  # 파라미터 그룹
  parameter_group_name = aws_db_parameter_group.postgres.name

  # 기타 설정
  skip_final_snapshot       = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.project_name}-db-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null
  deletion_protection       = var.environment == "prod"

  tags = {
    Name = "${var.project_name}-postgres"
    Role = "Database"
  }

  depends_on = [
    aws_db_subnet_group.main,
    aws_security_group.rds_postgres
  ]
}

# RDS 파라미터 그룹
resource "aws_db_parameter_group" "postgres" {
  name_prefix = "${var.project_name}-postgres-"
  family      = "postgres16"
  description = "PostgreSQL 파라미터 그룹"

  # 한국어 지원 문자 인코딩
  parameter {
    name  = "server_encoding"
    value = "UTF8"
  }

  # 슬로우 쿼리 로깅
  parameter {
    name  = "log_min_duration_statement"
    value = "1000"
  }

  parameter {
    name  = "log_statement"
    value = "all"
  }

  parameter {
    name  = "log_duration"
    value = "on"
  }

  # 연결 수 설정
  parameter {
    name  = "max_connections"
    value = "100"
  }

  # 공유 메모리 설정 (t3.micro: 512MB)
  parameter {
    name  = "shared_buffers"
    value = "{DBInstanceClassMemory/32}"
  }

  # 임시 작업 메모리
  parameter {
    name  = "work_mem"
    value = "4096"
  }

  # 유지보수 작업 메모리
  parameter {
    name  = "maintenance_work_mem"
    value = "65536"
  }

  tags = {
    Name = "${var.project_name}-postgres-pg"
  }
}

# RDS 모니터링 IAM 역할 (선택사항)
resource "aws_iam_role" "rds_monitoring" {
  count       = var.enable_monitoring ? 1 : 0
  name_prefix = "${var.project_name}-rds-monitoring-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-rds-monitoring-role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_monitoring" {
  count      = var.enable_monitoring ? 1 : 0
  role       = aws_iam_role.rds_monitoring[0].name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# RDS 옵션 그룹 (선택사항)
resource "aws_db_option_group" "postgres" {
  name_prefix          = "${var.project_name}-postgres-"
  option_group_description = "PostgreSQL 옵션 그룹"
  engine_name          = "postgres"
  major_engine_version = "16"

  tags = {
    Name = "${var.project_name}-postgres-og"
  }
}

# CloudWatch 알람 - DB CPU 사용률
resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "${var.project_name}-db-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  alarm_description = "RDS CPU 사용률이 80% 이상"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-db-cpu-alarm"
  }
}

# CloudWatch 알람 - DB 저장소 공간
resource "aws_cloudwatch_metric_alarm" "db_storage" {
  alarm_name          = "${var.project_name}-db-storage-low"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "1"
  metric_name         = "FreeStorageSpace"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "2147483648" # 2GB (바이트)

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  alarm_description = "RDS 여유 저장소 공간이 2GB 미만"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-db-storage-alarm"
  }
}

# CloudWatch 알람 - DB 연결 수
resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name          = "${var.project_name}-db-connections-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    DBInstanceIdentifier = aws_db_instance.postgres.id
  }

  alarm_description = "RDS 데이터베이스 연결 수가 높음"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-db-connections-alarm"
  }
}

# Outputs
output "rds_endpoint" {
  description = "RDS 데이터베이스 엔드포인트"
  value       = aws_db_instance.postgres.endpoint
}

output "rds_address" {
  description = "RDS 호스트 주소"
  value       = aws_db_instance.postgres.address
}

output "rds_port" {
  description = "RDS 포트"
  value       = aws_db_instance.postgres.port
}

output "rds_database_name" {
  description = "RDS 데이터베이스 이름"
  value       = aws_db_instance.postgres.db_name
}

output "rds_username" {
  description = "RDS 사용자명"
  value       = aws_db_instance.postgres.username
  sensitive   = true
}

output "rds_instance_id" {
  description = "RDS 인스턴스 ID"
  value       = aws_db_instance.postgres.id
}
