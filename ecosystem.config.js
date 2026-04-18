// PM2 에코시스템 설정 파일
// 사용법:
//   - 시작: pm2 start ecosystem.config.js
//   - 재시작: pm2 restart ecosystem.config.js
//   - 멈춤: pm2 stop ecosystem.config.js
//   - 삭제: pm2 delete ecosystem.config.js

module.exports = {
  apps: [
    {
      // 애플리케이션 정보
      name: 'near-price',
      script: './dist/main.js',
      cwd: '/home/ec2-user/near-price-api',

      // 실행 환경
      env: {
        NODE_ENV: 'staging',
        PORT: 3000,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      env_development: {
        NODE_ENV: 'development',
        PORT: 3000,
      },

      // 프로세스 관리
      instances: 'max',  // CPU 코어 수만큼 클러스터링
      exec_mode: 'cluster',  // 클러스터 모드
      max_memory_restart: '500M',  // 메모리 초과 시 재시작
      max_restarts: 10,  // 최대 재시작 횟수
      min_uptime: '10s',  // 최소 실행 시간
      autorestart: true,  // 자동 재시작

      // 일시 정지/재시작
      watch: false,  // 파일 변경 감지 (프로덕션: false)
      ignore_watch: [
        'node_modules',
        'logs',
        '.git',
        '.env',
        'dist',
        'uploads',
      ],

      // 로깅
      out_file: '/var/log/near-price/out.log',
      error_file: '/var/log/near-price/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      combine_logs: true,  // 클러스터 모드에서 모든 로그 결합
      max_old_space_size: 2048,  // Node.js 힙 메모리 크기 (MB)

      // 이름 지정
      instance_var: 'INSTANCE_ID',

      // 신호 처리
      kill_timeout: 5000,  // 프로세스 종료 타임아웃 (ms)
      listen_timeout: 10000,  // 리스너 타임아웃 (ms)

      // 메트릭
      pmx: true,  // 메트릭 수집 활성화

      // 기타
      merge_logs: true,
      wait_ready: true,  // 앱이 준비되었음을 신호할 때까지 대기
    },
  ],
  // 배포는 Terraform + EC2 user-data로 처리 (pm2 deploy 미사용)
};
