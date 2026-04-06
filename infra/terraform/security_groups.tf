# 보안 그룹 설정
#
# [수정 사항 요약]
#   1. EC2 Port 3000: 0.0.0.0/0 → ALB SG로만 허용 (NestJS 직접 노출 차단)
#   2. EC2 80/443: enable_direct_ec2_ingress=true 일 때만 허용
#   3. SSH: for_each로 변경 → 여러 관리자 IP 동시 지원
#   4. egress ip_protocol="-1": from/to_port를 0으로 통일 (AWS API 규칙)
#   5. ALB → EC2 포워딩 전용 egress 규칙 추가 (정밀 제어)
#   6. Redis SG는 enable_elasticache=true 일 때만 생성

# ─────────────────────────────────────────────────────────
# ALB Security Group (인터넷 → ALB)
# ─────────────────────────────────────────────────────────
resource "aws_security_group" "alb" {
  count       = var.enable_alb ? 1 : 0
  name_prefix = "${var.project_name}-alb-sg-"
  vpc_id      = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-alb-sg"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_http" {
  for_each          = var.enable_alb ? toset(var.allowed_http_cidrs) : toset([])
  description       = "Allow HTTP from internet"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  security_group_id = aws_security_group.alb[0].id

  tags = { Name = "alb-allow-http-${replace(each.value, "/", "-")}" }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  for_each          = var.enable_alb ? toset(var.allowed_https_cidrs) : toset([])
  description       = "Allow HTTPS from internet"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  security_group_id = aws_security_group.alb[0].id

  tags = { Name = "alb-allow-https-${replace(each.value, "/", "-")}" }
}

# ALB → EC2 포워딩 (포트 3000, NestJS 직접 forwarding 시)
resource "aws_vpc_security_group_egress_rule" "alb_to_ec2_app" {
  count                        = var.enable_alb ? 1 : 0
  description                  = "ALB forwards to EC2 NestJS port"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api_server.id
  security_group_id            = aws_security_group.alb[0].id

  tags = { Name = "alb-egress-ec2-3000" }
}

# ALB → EC2 포워딩 (포트 80, Nginx를 거치는 경우)
resource "aws_vpc_security_group_egress_rule" "alb_to_ec2_http" {
  count                        = var.enable_alb ? 1 : 0
  description                  = "ALB forwards to EC2 Nginx port 80"
  from_port                    = 80
  to_port                      = 80
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api_server.id
  security_group_id            = aws_security_group.alb[0].id

  tags = { Name = "alb-egress-ec2-80" }
}

# ─────────────────────────────────────────────────────────
# EC2 Security Group (API Server)
# ─────────────────────────────────────────────────────────
resource "aws_security_group" "api_server" {
  name_prefix = "${var.project_name}-api-sg-"
  vpc_id      = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-api-sg"
  }
}

# HTTP (80) - 인터넷 전체 허용 (Nginx 리버스 프록시용, ALB 없이 직접 배포 시)
resource "aws_vpc_security_group_ingress_rule" "api_http" {
  for_each          = var.enable_direct_ec2_ingress ? toset(var.allowed_http_cidrs) : toset([])
  description       = "Allow HTTP (Nginx) from internet"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  security_group_id = aws_security_group.api_server.id

  tags = { Name = "ec2-allow-http-${replace(each.value, "/", "-")}" }
}

# HTTPS (443) - 인터넷 전체 허용
resource "aws_vpc_security_group_ingress_rule" "api_https" {
  for_each          = var.enable_direct_ec2_ingress ? toset(var.allowed_https_cidrs) : toset([])
  description       = "Allow HTTPS (Nginx) from internet"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  security_group_id = aws_security_group.api_server.id

  tags = { Name = "ec2-allow-https-${replace(each.value, "/", "-")}" }
}

# NestJS App Port (3000) - ALB에서만 허용
# [보안] 기존: 0.0.0.0/0 → ALB SG로 제한
# Nginx → localhost:3000 는 루프백이라 SG 규칙 불필요
resource "aws_vpc_security_group_ingress_rule" "api_app_port" {
  count                        = var.enable_alb ? 1 : 0
  description                  = "Allow NestJS port 3000 from ALB only"
  from_port                    = 3000
  to_port                      = 3000
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.alb[0].id
  security_group_id            = aws_security_group.api_server.id

  tags = { Name = "ec2-allow-3000-from-alb" }
}

# SSH (22) - 관리자 IP만 허용
# [수정] 기존: allowed_ssh_cidrs[0]만 사용 → for_each로 여러 IP 지원
# ⚠️  반드시 terraform.tfvars에서 실제 IP로 변경하세요! (default 0.0.0.0/0 위험)
resource "aws_vpc_security_group_ingress_rule" "api_ssh" {
  for_each          = toset(var.allowed_ssh_cidrs)
  description       = "Allow SSH from admin IP"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  cidr_ipv4         = each.value
  security_group_id = aws_security_group.api_server.id

  tags = { Name = "ec2-allow-ssh-${replace(each.value, "/", "-")}" }
}

# EC2 Outbound - 전체 허용 (외부 API 호출: Kakao, Firebase 등)
# [수정] ip_protocol="-1" 시 from_port/to_port는 0이어야 함
resource "aws_vpc_security_group_egress_rule" "api_outbound_all" {
  description       = "Allow all outbound (Kakao OAuth, Firebase FCM, etc.)"
  ip_protocol       = "-1"
  from_port         = 0
  to_port           = 0
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.api_server.id

  tags = { Name = "ec2-allow-all-outbound" }
}

# ─────────────────────────────────────────────────────────
# RDS Security Group (PostgreSQL - Private Subnet)
# ─────────────────────────────────────────────────────────
resource "aws_security_group" "rds_postgres" {
  name_prefix = "${var.project_name}-rds-sg-"
  vpc_id      = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-rds-sg"
  }
}

# PostgreSQL (5432) - EC2에서만 접근 허용 (SG 참조로 정밀 제어)
resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  description                  = "Allow PostgreSQL from EC2 only"
  from_port                    = 5432
  to_port                      = 5432
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api_server.id
  security_group_id            = aws_security_group.rds_postgres.id

  tags = { Name = "rds-allow-from-ec2" }
}

# RDS Outbound - VPC 내부만 (인터넷 접근 불필요)
resource "aws_vpc_security_group_egress_rule" "rds_outbound_vpc" {
  description       = "Allow outbound within VPC only"
  ip_protocol       = "-1"
  from_port         = 0
  to_port           = 0
  cidr_ipv4         = var.vpc_cidr
  security_group_id = aws_security_group.rds_postgres.id

  tags = { Name = "rds-allow-outbound-vpc" }
}

# ─────────────────────────────────────────────────────────
# ElastiCache Redis Security Group (Private Subnet)
# ─────────────────────────────────────────────────────────
resource "aws_security_group" "elasticache_redis" {
  count       = var.enable_elasticache ? 1 : 0
  name_prefix = "${var.project_name}-redis-sg-"
  vpc_id      = aws_vpc.main.id

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-redis-sg"
  }
}

# Redis (6379) - EC2에서만 접근 허용
resource "aws_vpc_security_group_ingress_rule" "redis_from_ec2" {
  count                        = var.enable_elasticache ? 1 : 0
  description                  = "Allow Redis from EC2 API servers only"
  from_port                    = 6379
  to_port                      = 6379
  ip_protocol                  = "tcp"
  referenced_security_group_id = aws_security_group.api_server.id
  security_group_id            = aws_security_group.elasticache_redis[0].id

  tags = { Name = "redis-allow-from-ec2" }
}

# Redis Outbound - VPC 내부만
resource "aws_vpc_security_group_egress_rule" "redis_outbound_vpc" {
  count             = var.enable_elasticache ? 1 : 0
  description       = "Allow outbound within VPC only"
  ip_protocol       = "-1"
  from_port         = 0
  to_port           = 0
  cidr_ipv4         = var.vpc_cidr
  security_group_id = aws_security_group.elasticache_redis[0].id

  tags = { Name = "redis-allow-outbound-vpc" }
}

# ─────────────────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────────────────
output "api_security_group_id" {
  description = "API Server Security Group ID"
  value       = aws_security_group.api_server.id
}

output "rds_security_group_id" {
  description = "RDS Security Group ID"
  value       = aws_security_group.rds_postgres.id
}

output "alb_security_group_id" {
  description = "ALB Security Group ID"
  value       = var.enable_alb ? aws_security_group.alb[0].id : null
}

output "redis_security_group_id" {
  description = "ElastiCache Redis Security Group ID"
  value       = var.enable_elasticache ? aws_security_group.elasticache_redis[0].id : null
}
