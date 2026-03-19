#!/bin/bash
# NearPrice 백엔드 자동 검증 스크립트
# Claude Code의 Stop hook에서 호출됨
# 실패 시 stdout으로 에러를 출력 → Claude가 읽고 자체 수정

cd "$(dirname "$0")/../.." || exit 0

ERRORS=""

# 1. ESLint (프로덕션 코드만 — spec 파일 제외, --fix 포함)
echo "🔍 ESLint 검사 및 자동 수정 중..."
LINT_OUTPUT=$(npx eslint "src/**/*.ts" --ignore-pattern "**/*.spec.ts" --fix 2>&1)
LINT_EXIT=$?
if [ $LINT_EXIT -ne 0 ]; then
  ERRORS="${ERRORS}\n❌ ESLint 에러:\n${LINT_OUTPUT}\n"
fi

# 2. TypeScript 타입체크
echo "🔍 TypeScript 타입체크 중..."
TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
TSC_EXIT=$?
if [ $TSC_EXIT -ne 0 ]; then
  ERRORS="${ERRORS}\n❌ TypeScript 타입 에러:\n${TSC_OUTPUT}\n"
fi

# 3. return await 규칙 체크 (NestJS 핵심 규칙)
# Repository/Service 메서드를 await 없이 직접 반환하는 패턴 탐지
echo "🔍 return await 규칙 검사 중..."
RETURN_VIOLATIONS=$(grep -rn \
  "return this\.[a-zA-Z]*[Rr]epository\.\|return this\.[a-zA-Z]*[Ss]ervice\." \
  src/ --include="*.ts" | grep -v "return await" | grep -v "^\s*//" | head -10)
if [ -n "$RETURN_VIOLATIONS" ]; then
  ERRORS="${ERRORS}\n❌ return await 누락 (Repository/Service 직접 반환 금지):\n${RETURN_VIOLATIONS}\n"
fi

# 결과 출력
if [ -n "$ERRORS" ]; then
  echo ""
  echo "⚠️ 검증 실패 — 아래 에러를 수정해줘 (자동 재시도 남은 횟수 확인):"
  echo -e "$ERRORS"
  exit 1
else
  echo "✅ 검증 통과: ESLint + TypeScript + return await 규칙 모두 OK"
  echo ""
  echo "📋 다음 체크리스트를 반드시 수동 점검하세요:"
  echo "   .claude/reviews/code-review-checklist.md"
  echo "   항목: 아키텍처 / 에러처리 / 보안 / 성능"
  exit 0
fi
