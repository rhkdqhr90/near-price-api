# ElastiCache Redis - 마실앱 세션 / 캐싱 / 큐
# Private Subnet에 배치 (인터넷 노출 없음)

# ElastiCache용 서브넷 그룹
resource "aws_elasticache_subnet_group" "main" {
  count      = var.enable_elasticache ? 1 : 0
  name       = "${var.project_name}-redis-subnet-group"
  subnet_ids = [aws_subnet.private[0].id, aws_subnet.private[1].id]

  tags = {
    Name = "${var.project_name}-redis-subnet-group"
  }
}

# Redis 파라미터 그룹
resource "aws_elasticache_parameter_group" "redis" {
  count  = var.enable_elasticache ? 1 : 0
  name   = "${var.project_name}-redis-params"
  family = "redis7"

  # 메모리 정책: LRU 방식으로 오래된 캐시 자동 제거
  parameter {
    name  = "maxmemory-policy"
    value = "allkeys-lru"
  }

  # Keyspace 알림 (Bull Queue 사용 시 필요)
  parameter {
    name  = "notify-keyspace-events"
    value = "Ex"
  }

  tags = {
    Name = "${var.project_name}-redis-params"
  }
}

# ElastiCache Replication Group (Redis)
resource "aws_elasticache_replication_group" "redis" {
  count                = var.enable_elasticache ? 1 : 0
  replication_group_id = "${var.project_name}-redis"
  description          = "마실앱 Redis 캐시 클러스터"

  node_type            = var.redis_node_type
  num_cache_clusters   = var.redis_num_nodes
  parameter_group_name = aws_elasticache_parameter_group.redis[0].name
  engine_version       = "7.1"
  port                 = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main[0].name
  security_group_ids = [aws_security_group.elasticache_redis[0].id]

  # 보안: 암호화
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token                 = var.redis_auth_token

  # 고가용성: 노드 2개 이상이면 자동 장애 조치 활성화
  automatic_failover_enabled = var.redis_num_nodes > 1

  # 스냅샷 / 유지보수
  snapshot_retention_limit = 1
  snapshot_window          = "04:00-05:00"  # UTC (한국시간: 오전 1시)
  maintenance_window       = "sun:05:00-sun:06:00"

  # 버전 업그레이드는 수동으로
  auto_minor_version_upgrade = false

  # 로그
  log_delivery_configuration {
    destination      = aws_cloudwatch_log_group.redis_slow_log[0].name
    destination_type = "cloudwatch-logs"
    log_format       = "text"
    log_type         = "slow-log"
  }

  tags = {
    Name = "${var.project_name}-redis"
    Role = "Cache"
  }
}

# CloudWatch Log Group - Redis Slow Log
resource "aws_cloudwatch_log_group" "redis_slow_log" {
  count             = var.enable_elasticache ? 1 : 0
  name              = "/aws/elasticache/${var.project_name}/redis/slow-log"
  retention_in_days = 7

  tags = {
    Name = "${var.project_name}-redis-slow-log"
  }
}

# CloudWatch 알람 - Redis CPU 사용률
resource "aws_cloudwatch_metric_alarm" "redis_cpu" {
  count               = var.enable_elasticache ? 1 : 0
  alarm_name          = "${var.project_name}-redis-cpu-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "EngineCPUUtilization"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  alarm_description  = "Redis CPU 사용률이 80% 이상"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-redis-cpu-alarm"
  }
}

# CloudWatch 알람 - Redis 메모리 사용률
resource "aws_cloudwatch_metric_alarm" "redis_memory" {
  count               = var.enable_elasticache ? 1 : 0
  alarm_name          = "${var.project_name}-redis-memory-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "DatabaseMemoryUsagePercentage"
  namespace           = "AWS/ElastiCache"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"

  dimensions = {
    ReplicationGroupId = aws_elasticache_replication_group.redis[0].id
  }

  alarm_description  = "Redis 메모리 사용률이 80% 이상"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-redis-memory-alarm"
  }
}

# ─────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────
output "redis_primary_endpoint" {
  description = "Redis Primary Endpoint (.env REDIS_HOST에 설정)"
  value       = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].primary_endpoint_address : null
}

output "redis_reader_endpoint" {
  description = "Redis Reader Endpoint (읽기 전용 복제본이 있을 경우 사용)"
  value       = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].reader_endpoint_address : null
}

output "redis_port" {
  description = "Redis Port"
  value       = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].port : null
}

output "redis_replication_group_id" {
  description = "ElastiCache Replication Group ID"
  value       = var.enable_elasticache ? aws_elasticache_replication_group.redis[0].id : null
}
