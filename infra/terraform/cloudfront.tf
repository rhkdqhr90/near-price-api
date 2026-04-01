# CloudFront 이미지 CDN (S3 앞단)

# Origin Access Control (OAC) — OAI의 후계자, S3와 권장 방식
resource "aws_cloudfront_origin_access_control" "uploads" {
  name                              = "${var.project_name}-uploads-oac"
  description                       = "NearPrice S3 업로드 버킷 OAC"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "uploads" {
  origin {
    domain_name              = aws_s3_bucket.app_uploads.bucket_regional_domain_name
    origin_id                = "S3-${aws_s3_bucket.app_uploads.id}"
    origin_access_control_id = aws_cloudfront_origin_access_control.uploads.id
  }

  enabled         = true
  is_ipv6_enabled = true
  price_class     = "PriceClass_200" # 북미·유럽·아시아 포함

  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.app_uploads.id}"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true

    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6" # CachingOptimized (AWS Managed)
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    # 커스텀 도메인(cdn.nearprice.kr) 사용 시:
    # acm_certificate_arn      = aws_acm_certificate.cdn.arn
    # ssl_support_method       = "sni-only"
    # minimum_protocol_version = "TLSv1.2_2021"
  }

  tags = {
    Name = "${var.project_name}-cdn"
  }
}
