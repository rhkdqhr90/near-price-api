# ACM SSL/TLS 인증서
# ap-northeast-2 리전에서 생성 (ALB에 연결)
# 참고: CloudFront용 인증서는 반드시 us-east-1에 있어야 하나,
#       현재 CloudFront는 기본 인증서를 사용 중 → CDN 커스텀 도메인 연결 시 별도 추가 필요

# ─────────────────────────────────────────────
# API 도메인용 ACM 인증서 (ALB 연결)
# ─────────────────────────────────────────────
resource "aws_acm_certificate" "api" {
  count       = var.enable_alb ? 1 : 0
  domain_name = var.domain_name

  # 와일드카드 포함: *.masil.kr 도 커버
  subject_alternative_names = [
    "*.${var.domain_name}",
    "api.${var.domain_name}",
  ]

  validation_method = "DNS"

  lifecycle {
    # 교체 시 기존 인증서 삭제 전 새 인증서 먼저 생성
    create_before_destroy = true
  }

  tags = {
    Name = "${var.project_name}-api-cert"
  }
}

# ─────────────────────────────────────────────
# DNS 검증 레코드
# Route53을 사용하지 않는 경우:
#   아래 output "acm_dns_validation_records" 값을 도메인 등록 업체에서 직접 추가
# ─────────────────────────────────────────────
resource "aws_acm_certificate_validation" "api" {
  count           = var.enable_alb ? 1 : 0
  certificate_arn = aws_acm_certificate.api[0].arn

  # Route53을 사용하는 경우 validation_record_fqdns를 채워야 검증 완료
  # 현재는 수동 DNS 검증을 가정: 검증 레코드를 도메인 업체에서 직접 추가 후 apply
  # validation_record_fqdns = [for record in aws_acm_certificate.api.domain_validation_options : record.resource_record_name]

  timeouts {
    create = "30m"
  }
}

# ─────────────────────────────────────────────
# [선택] CloudFront CDN용 인증서 (us-east-1)
# 커스텀 CDN 도메인(예: cdn.masil.kr)을 사용할 경우 주석 해제
# ─────────────────────────────────────────────
# provider "aws" {
#   alias  = "us_east_1"
#   region = "us-east-1"
# }
#
# resource "aws_acm_certificate" "cdn" {
#   provider    = aws.us_east_1
#   domain_name = "cdn.${var.domain_name}"
#   validation_method = "DNS"
#
#   lifecycle {
#     create_before_destroy = true
#   }
#
#   tags = {
#     Name = "${var.project_name}-cdn-cert"
#   }
# }

# ─────────────────────────────────────────────
# Outputs
# ─────────────────────────────────────────────
output "acm_certificate_arn" {
  description = "ACM 인증서 ARN (ALB HTTPS 리스너에서 사용)"
  value       = var.enable_alb ? aws_acm_certificate.api[0].arn : null
}

output "acm_certificate_status" {
  description = "ACM 인증서 상태 (ISSUED 되어야 ALB에서 사용 가능)"
  value       = var.enable_alb ? aws_acm_certificate.api[0].status : null
}

# acm_dns_validation_records 는 outputs.tf에서 통합 관리 (중복 제거)
