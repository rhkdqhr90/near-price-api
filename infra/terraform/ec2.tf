# EC2 인스턴스 및 IAM 역할 설정

# EC2용 IAM 역할
resource "aws_iam_role" "ec2_role" {
  name_prefix = "${var.project_name}-ec2-role-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-ec2-role"
  }
}

# EC2 IAM 역할 정책 - SSM Systems Manager (SSH 대신 AWS Systems Manager Session Manager 사용 가능)
resource "aws_iam_role_policy_attachment" "ec2_ssm_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

# EC2 IAM 역할 정책 - CloudWatch Logs
resource "aws_iam_role_policy_attachment" "ec2_cloudwatch_policy" {
  role       = aws_iam_role.ec2_role.name
  policy_arn = "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy"
}

# EC2 IAM 역할 정책 - S3 접근 (업로드된 이미지 저장소)
resource "aws_iam_role_policy" "ec2_s3_policy" {
  name_prefix = "${var.project_name}-ec2-s3-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = [
          "arn:aws:s3:::${aws_s3_bucket.app_uploads.id}",
          "arn:aws:s3:::${aws_s3_bucket.app_uploads.id}/*"
        ]
      }
    ]
  })
}

# EC2 IAM 역할 정책 - Secrets Manager (환경변수 저장)
resource "aws_iam_role_policy" "ec2_secrets_policy" {
  name_prefix = "${var.project_name}-ec2-secrets-"
  role        = aws_iam_role.ec2_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:${data.aws_caller_identity.current.account_id}:secret:${var.project_name}/*"
      }
    ]
  })
}

# EC2 IAM Instance Profile
resource "aws_iam_instance_profile" "ec2_profile" {
  name_prefix = "${var.project_name}-ec2-profile-"
  role        = aws_iam_role.ec2_role.name
}

# EC2 User Data 스크립트
locals {
  user_data = base64encode(templatefile("${path.module}/user_data.sh", {
    region       = var.aws_region
    project_name = var.project_name
  }))
}

# EC2 인스턴스 (Public Subnet에 배치)
resource "aws_instance" "api_server" {
  count                    = var.ec2_instance_count
  ami                         = data.aws_ami.amazon_linux_2.id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.public[count.index % 2].id
  vpc_security_group_ids      = [aws_security_group.api_server.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2_profile.name
  key_name                    = var.key_pair_name  # [수정] SSH 키 페어 연결 (누락된 설정)
  associate_public_ip_address = true
  monitoring                  = var.enable_monitoring
  user_data                   = local.user_data

  # 스토리지 설정
  root_block_device {
    volume_type           = "gp3"
    volume_size           = 30
    delete_on_termination = true
    encrypted             = true
    tags = {
      Name = "${var.project_name}-api-root-volume-${count.index + 1}"
    }
  }

  # 메타데이터 (IMDSv2 사용 - 보안)
  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "${var.project_name}-api-server-${count.index + 1}"
    Role = "API Server"
  }

  # [수정] 자기 자신을 참조하는 순환 depends_on 제거 (버그)
  depends_on = [aws_internet_gateway.main]
}

# Elastic IP 할당
resource "aws_eip" "api_server" {
  count    = var.ec2_instance_count
  instance = aws_instance.api_server[count.index].id
  domain   = "vpc"

  tags = {
    Name = "${var.project_name}-api-eip-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.main]
}

# S3 버킷 (이미지 업로드용)
resource "aws_s3_bucket" "app_uploads" {
  bucket_prefix = "${var.project_name}-uploads-"

  tags = {
    Name = "${var.project_name}-uploads"
  }
}

# S3 버킷 버전 관리
resource "aws_s3_bucket_versioning" "app_uploads" {
  bucket = aws_s3_bucket.app_uploads.id

  versioning_configuration {
    status = "Enabled"
  }
}

# S3 버킷 암호화
resource "aws_s3_bucket_server_side_encryption_configuration" "app_uploads" {
  bucket = aws_s3_bucket.app_uploads.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# S3 버킷 공개 차단
resource "aws_s3_bucket_public_access_block" "app_uploads" {
  bucket = aws_s3_bucket.app_uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# S3 버킷 정책 (CloudFront에서만 접근)
resource "aws_s3_bucket_policy" "app_uploads" {
  bucket = aws_s3_bucket.app_uploads.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFront"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.app_uploads.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.uploads.arn
          }
        }
      },
      {
        Sid    = "AllowEC2"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ec2_role.arn
        }
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.app_uploads.arn}/*"
      }
    ]
  })
}

# EC2 인스턴스 데이터 소스 - Amazon Linux 2 AMI
data "aws_ami" "amazon_linux_2" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# Outputs
output "ec2_instance_ids" {
  description = "EC2 인스턴스 IDs"
  value       = aws_instance.api_server[*].id
}

output "ec2_public_ips" {
  description = "EC2 Elastic IP 주소"
  value       = aws_eip.api_server[*].public_ip
}

output "ec2_private_ips" {
  description = "EC2 Private IP 주소"
  value       = aws_instance.api_server[*].private_ip
}

output "s3_bucket_name" {
  description = "S3 업로드 버킷 이름"
  value       = aws_s3_bucket.app_uploads.id
}

output "s3_bucket_arn" {
  description = "S3 업로드 버킷 ARN"
  value       = aws_s3_bucket.app_uploads.arn
}
