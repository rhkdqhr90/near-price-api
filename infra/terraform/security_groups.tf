# 보안 그룹 설정

# EC2 Security Group (API Server)
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

# EC2 Security Group Rules - Inbound
resource "aws_vpc_security_group_ingress_rule" "api_http" {
  description       = "Allow HTTP from anywhere"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.api_server.id

  tags = {
    Name = "allow-http"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_https" {
  description       = "Allow HTTPS from anywhere"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.api_server.id

  tags = {
    Name = "allow-https"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_ssh" {
  description       = "Allow SSH from specified IPs"
  from_port         = 22
  to_port           = 22
  ip_protocol       = "tcp"
  cidr_ipv4         = var.allowed_ssh_cidrs[0]
  security_group_id = aws_security_group.api_server.id

  tags = {
    Name = "allow-ssh"
  }
}

resource "aws_vpc_security_group_ingress_rule" "api_app_port" {
  description       = "Allow application port (3000)"
  from_port         = 3000
  to_port           = 3000
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.api_server.id

  tags = {
    Name = "allow-app-port"
  }
}

# EC2 Security Group Rules - Outbound
resource "aws_vpc_security_group_egress_rule" "api_outbound_all" {
  description       = "Allow all outbound traffic"
  from_port         = 0
  to_port           = 65535
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.api_server.id

  tags = {
    Name = "allow-all-outbound"
  }
}

# RDS Security Group (PostgreSQL)
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

# RDS Security Group Rules - Inbound (EC2에서만 접근)
resource "aws_vpc_security_group_ingress_rule" "rds_from_ec2" {
  description              = "Allow PostgreSQL from EC2 instances"
  from_port                = 5432
  to_port                  = 5432
  ip_protocol              = "tcp"
  referenced_security_group_id = aws_security_group.api_server.id
  security_group_id        = aws_security_group.rds_postgres.id

  tags = {
    Name = "allow-from-ec2"
  }
}

# RDS Security Group Rules - Outbound
resource "aws_vpc_security_group_egress_rule" "rds_outbound_all" {
  description       = "Allow all outbound traffic"
  from_port         = 0
  to_port           = 65535
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.rds_postgres.id

  tags = {
    Name = "allow-all-outbound"
  }
}

# ALB Security Group (선택사항 - 나중에 추가 가능)
resource "aws_security_group" "alb" {
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
  description       = "Allow HTTP"
  from_port         = 80
  to_port           = 80
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.alb.id

  tags = {
    Name = "allow-http"
  }
}

resource "aws_vpc_security_group_ingress_rule" "alb_https" {
  description       = "Allow HTTPS"
  from_port         = 443
  to_port           = 443
  ip_protocol       = "tcp"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.alb.id

  tags = {
    Name = "allow-https"
  }
}

resource "aws_vpc_security_group_egress_rule" "alb_outbound_all" {
  description       = "Allow all outbound traffic"
  from_port         = 0
  to_port           = 65535
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
  security_group_id = aws_security_group.alb.id

  tags = {
    Name = "allow-all-outbound"
  }
}

# Outputs
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
  value       = aws_security_group.alb.id
}
