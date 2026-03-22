#!/bin/bash
# EC2 초기화 스크립트
# Node.js, PM2, 기타 필수 패키지 설치

set -e

# 로그 설정
exec > >(tee -a /var/log/user-data.log)
exec 2>&1

echo "==============================================="
echo "NearPrice API Server 초기화 시작"
echo "시간: $(date)"
echo "==============================================="

# 시스템 업데이트
echo "[1/6] 시스템 패키지 업데이트 중..."
yum update -y
yum install -y curl wget git vim htop tree nodejs npm

# Node.js 버전 확인
echo "[2/6] Node.js 설치 확인..."
node --version
npm --version

# PM2 전역 설치
echo "[3/6] PM2 설치 중..."
npm install -g pm2@latest

# PM2 시작 설정
echo "[4/6] PM2 시작 설정..."
pm2 startup systemd -u ec2-user --hp /home/ec2-user
pm2 save

# CloudWatch Agent 설치
echo "[5/6] CloudWatch Agent 설치 중..."
wget https://s3.amazonaws.com/amazoncloudwatch-agent/amazon_linux/amd64/latest/amazon-cloudwatch-agent.rpm
rpm -U ./amazon-cloudwatch-agent.rpm

# 애플리케이션 배포 준비 디렉토리 생성
echo "[6/6] 애플리케이션 디렉토리 생성..."
mkdir -p /home/ec2-user/near-price-api
mkdir -p /var/log/near-price
chown -R ec2-user:ec2-user /home/ec2-user/near-price-api
chown -R ec2-user:ec2-user /var/log/near-price

# 환경변수 파일 위치 정보 출력
echo "==============================================="
echo "NearPrice API Server 초기화 완료"
echo "==============================================="
echo "로그 위치: /var/log/user-data.log"
echo "앱 디렉토리: /home/ec2-user/near-price-api"
echo "로그 디렉토리: /var/log/near-price"
echo "다음 단계:"
echo "1. /home/ec2-user/near-price-api에 애플리케이션 코드 배포"
echo "2. npm install --production 실행"
echo "3. npm run build 실행"
echo "4. pm2 start ecosystem.config.js 실행"
echo "==============================================="

# EC2 메타데이터에서 인스턴스 정보 출력
echo "Instance ID: $(ec2-metadata --instance-id | cut -d' ' -f2)"
echo "Private IP: $(ec2-metadata --local-ipv4 | cut -d' ' -f2)"
echo "Public IP: $(ec2-metadata --public-ipv4 | cut -d' ' -f2)"
