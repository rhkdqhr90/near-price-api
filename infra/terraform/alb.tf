# Application Load Balancer (ALB)
# 인터넷 → ALB(80/443) → EC2(3000) 트래픽 흐름

# ─────────────────────────────────────────────
# ALB 액세스 로그용 S3 버킷
# ─────────────────────────────────────────────
resource "aws_s3_bucket" "alb_logs" {
  count         = var.enable_alb ? 1 : 0
  bucket_prefix = "${var.project_name}-alb-logs-"
  force_destroy = true

  tags = {
    Name = "${var.project_name}-alb-logs"
  }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  count  = var.enable_alb ? 1 : 0
  bucket = aws_s3_bucket.alb_logs[0].id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  count  = var.enable_alb ? 1 : 0
  bucket = aws_s3_bucket.alb_logs[0].id

  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

# ALB 서비스 계정 조회 (로그 버킷 정책에 필요)
data "aws_elb_service_account" "main" {
  count = var.enable_alb ? 1 : 0
}

resource "aws_s3_bucket_policy" "alb_logs" {
  count      = var.enable_alb ? 1 : 0
  bucket     = aws_s3_bucket.alb_logs[0].id
  depends_on = [aws_s3_bucket_public_access_block.alb_logs]

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          AWS = data.aws_elb_service_account.main[0].arn
        }
        Action   = "s3:PutObject"
        Resource = "${aws_s3_bucket.alb_logs[0].arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs[0].arn}/alb/AWSLogs/${data.aws_caller_identity.current.account_id}/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      },
      {
        Effect = "Allow"
        Principal = {
          Service = "delivery.logs.amazonaws.com"
        }
        Action   = "s3:GetBucketAcl"
        Resource = aws_s3_bucket.alb_logs[0].arn
      }
    ]
  })
}

# ─────────────────────────────────────────────
# Application Load Balancer
# ─────────────────────────────────────────────
resource "aws_lb" "main" {
  count              = var.enable_alb ? 1 : 0
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb[0].id]
  subnets            = aws_subnet.public[*].id

  # 프로덕션에서는 삭제 보호 활성화
  enable_deletion_protection = var.environment == "prod"

  access_logs {
    bucket  = aws_s3_bucket.alb_logs[0].id
    prefix  = "alb"
    enabled = true
  }

  # HTTP/2 활성화
  enable_http2 = true

  tags = {
    Name = "${var.project_name}-alb"
    Role = "Load Balancer"
  }

  depends_on = [aws_s3_bucket_policy.alb_logs]
}

# ─────────────────────────────────────────────
# Target Group (EC2 포트 3000)
# ─────────────────────────────────────────────
resource "aws_lb_target_group" "api" {
  count    = var.enable_alb ? 1 : 0
  name     = "${var.project_name}-api-tg"
  port     = 3000
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  # Deregistration delay (무중단 배포 시 연결 대기 시간)
  deregistration_delay = 30

  health_check {
    enabled             = true
    healthy_threshold   = 2
    interval            = 30
    matcher             = "200"
    path                = "/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 3
  }

  stickiness {
    type    = "lb_cookie"
    enabled = false
  }

  tags = {
    Name = "${var.project_name}-api-tg"
  }
}

# EC2 인스턴스를 Target Group에 등록
resource "aws_lb_target_group_attachment" "api" {
  count            = var.enable_alb ? var.ec2_instance_count : 0
  target_group_arn = aws_lb_target_group.api[0].arn
  target_id        = aws_instance.api_server[count.index].id
  port             = 3000
}

# ─────────────────────────────────────────────
# ALB Listeners
# ─────────────────────────────────────────────

# HTTP → HTTPS 리다이렉트
resource "aws_lb_listener" "http" {
  count             = var.enable_alb ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS → EC2:3000 포워드
resource "aws_lb_listener" "https" {
  count             = var.enable_alb ? 1 : 0
  load_balancer_arn = aws_lb.main[0].arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate_validation.api[0].certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api[0].arn
  }
}

# ─────────────────────────────────────────────
# CloudWatch 알람 - ALB
# ─────────────────────────────────────────────

# 5xx 에러율 알람
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  count               = var.enable_alb ? 1 : 0
  alarm_name          = "${var.project_name}-alb-5xx-high"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Sum"
  threshold           = "50"

  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
  }

  alarm_description  = "ALB 5xx 에러가 5분 동안 50건 이상"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-alb-5xx-alarm"
  }
}

# 응답 시간 알람
resource "aws_cloudwatch_metric_alarm" "alb_response_time" {
  count               = var.enable_alb ? 1 : 0
  alarm_name          = "${var.project_name}-alb-response-time"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = "300"
  statistic           = "Average"
  threshold           = "3"

  dimensions = {
    LoadBalancer = aws_lb.main[0].arn_suffix
  }

  alarm_description  = "ALB 평균 응답 시간이 3초 이상"
  treat_missing_data = "notBreaching"

  tags = {
    Name = "${var.project_name}-alb-response-alarm"
  }
}

# ─────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────
output "alb_dns_name" {
  description = "ALB DNS 이름 (Route53 또는 도메인 등록 시 CNAME으로 연결)"
  value       = var.enable_alb ? aws_lb.main[0].dns_name : null
}

output "alb_arn" {
  description = "ALB ARN"
  value       = var.enable_alb ? aws_lb.main[0].arn : null
}

output "alb_zone_id" {
  description = "ALB Hosted Zone ID (Route53 Alias 레코드에 사용)"
  value       = var.enable_alb ? aws_lb.main[0].zone_id : null
}

output "alb_target_group_arn" {
  description = "API Target Group ARN"
  value       = var.enable_alb ? aws_lb_target_group.api[0].arn : null
}
