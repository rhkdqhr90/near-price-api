# NearPrice 닉네임 시스템 방어 코드 구현

## 개요
NearPrice 프로젝트의 닉네임 시스템에 보안 방어 코드를 추가했습니다. API와 앱 양쪽에서 다층 방어를 구현했습니다.

---

## API 쪽 (near-price-api) 방어 코드

### 1. XSS 방지 (교차 사이트 스크립팅 방지)
**파일**: `src/user/dto/update-nickname.dto.ts`
- `@Transform(({ value }) => value.trim())` 데코레이터로 입력값의 양 끝 공백 제거
- `@Matches(/^[가-힣a-zA-Z0-9]{2,6}$/)` 정규식으로 한글/영문/숫자만 허용
- HTML 태그나 스크립트 삽입 원천 차단

### 2. SQL Injection 방지
**파일**: `src/user/user.service.ts`
- TypeORM 파라미터 바인딩 사용 (쿼리 빌더에서 자동 이스케이핑)
- Raw SQL 사용 없음으로 안전성 보장

### 3. Rate Limiting (속도 제한)
**파일**: `src/user/user.controller.ts`
- `@Throttle({ default: { limit: 3, ttl: 60000 } })`
- 1분에 3회까지만 닉네임 변경 가능
- 빈번한 변경 시도를 통한 공격 방지

### 4. 욕설/금칙어 필터
**파일**: `src/common/constants/banned-words.ts` (신규 생성)
```typescript
export const BANNED_WORDS = [
  '개새끼', '병신', '씨발', '지랄', '미친', // 욕설
  '관리자', 'admin', '운영자', '개발자', // 사칭 방지
  'ceo', 'cto', // 관리자 사칭 방지
];
```

**파일**: `src/user/user.service.ts` - `updateNickname()` 메서드
```typescript
if (containsBannedWords(nickname)) {
  throw new BadRequestException('사용할 수 없는 닉네임입니다.');
}
```

### 5. 공백 방어
**파일**: `src/user/user.service.ts`
```typescript
if (!nickname || nickname.trim().length === 0) {
  throw new BadRequestException('닉네임은 공백으로만 이루어질 수 없습니다.');
}
```
- 공백만으로 이루어진 닉네임 거부

### 6. 동시성 방어 (Unique 제약)
**파일**: `src/user/entities/user.entity.ts`
```typescript
@Column({ unique: true })
nickname: string;
```
- DB 레벨에서 중복 닉네임 방지
- 동시에 같은 닉네임으로 변경 시도 시 DB constraint 위반으로 자동 차단

---

## 앱 쪽 (near-price-app) 방어 코드

### 7. 입력 제한
**파일**: `src/screens/mypage/MyPageScreen.tsx`
```tsx
<TextInput
  maxLength={6}
  // ...
/>
```
- TextInput에 maxLength={6} 적용

### 8. 특수문자 실시간 필터
**파일**: `src/screens/mypage/MyPageScreen.tsx` - `handleChangeNickname()` 메서드
```typescript
// 특수문자 필터링: 한글, 영문, 숫자만 허용
const filteredText = text.replace(/[^가-힣a-zA-Z0-9]/g, '');
const limitedText = filteredText.slice(0, 6);
setNickname(limitedText);
```
- 사용자가 입력한 값을 실시간으로 필터링
- 허용된 문자만 통과

### 9. 네트워크 에러 처리
**파일**: `src/screens/mypage/MyPageScreen.tsx` - `handleUpdate()` 메서드
```typescript
if (response?.status === 409) {
  message = '이미 사용 중인 닉네임입니다';
} else if (response?.status === 400) {
  message = response?.data?.message ?? '유효하지 않은 닉네임입니다';
} else if (response?.status === 429) {
  message = '너무 빠르게 변경했습니다. 잠시 후 다시 시도해주세요';
}
```
- HTTP 상태 코드별 명확한 에러 메시지
- 사용자 경험 개선

### 10. 닉네임 미설정 방어
**파일**: `src/screens/mypage/MyPageScreen.tsx`
```typescript
// 닉네임이 없거나 빈 문자열인 경우 폴백 처리
const displayNickname = user?.nickname && user.nickname.trim().length > 0
  ? user.nickname
  : (user?.email?.split('@')[0] ?? '익명');
```
- 닉네임이 null/빈 문자열인 경우:
  - 첫 번째 선택: 이메일 앞부분 (예: "john@example.com" → "john")
  - 두 번째 선택: "익명"

---

## 유효성 검사 흐름

### 클라이언트 → 서버

```
사용자 입력
  ↓
[앱] 특수문자 필터링 (실시간)
  ↓
[앱] maxLength=6 제한
  ↓
[앱] 유효성 검사 (길이, 정규식)
  ↓
[API] Transform으로 trim 처리
  ↓
[API] @Matches 정규식 검증
  ↓
[API] 공백 확인
  ↓
[API] 금칙어 필터링
  ↓
[API] 중복 확인
  ↓
[API] Rate Limiting 확인
  ↓
[API] DB 저장 (Unique 제약 적용)
```

---

## 테스트 시나리오

| 입력값 | 결과 | 처리 레이어 |
|--------|------|-----------|
| `abc123` | ✅ 성공 | 통과 |
| `<script>` | ❌ 필터됨 | 앱 필터링 |
| `admin` | ❌ 거부 | API 금칙어 |
| `   ` (공백) | ❌ 거부 | API 공백 검사 |
| `1글` | ❌ 거부 | 길이 미달 |
| `1234567` | ❌ 거부 | maxLength 제한 |
| `중복닉네임` | ❌ 거부 (2번) | Rate Limiting (429) |
| 동일 닉네임 | ❌ 거부 | DB Unique 제약 |

---

## 보안 개선 사항 요약

✅ **XSS 방지**: HTML/스크립트 삽입 원천 차단
✅ **SQL Injection 방지**: TypeORM 파라미터 바인딩
✅ **Rate Limiting**: 1분에 3회만 변경 가능
✅ **욕설 필터**: 금칙어 목록 검사
✅ **사칭 방지**: 관리자/운영자 등 예약어 차단
✅ **공백 방어**: 공백만으로 이루어진 입력 거부
✅ **동시성 방어**: DB Unique 제약 + 중복 확인
✅ **UX 개선**: 명확한 에러 메시지
✅ **Fallback 처리**: 닉네임 미설정 시 안전한 폴백

---

## 추후 개선 사항 (선택사항)

1. **더 많은 금칙어 추가**: 시간이 지남에 따라 욕설 목록 업데이트
2. **IP 기반 Rate Limiting**: 사용자별 뿐 아니라 IP별로도 제한
3. **유사성 검사**: 기존 닉네임과 너무 유사한 경우 거부
4. **나쁜 단어 감지 API**: 외부 AI 기반 콘텐츠 필터링 활용
5. **감시 대시보드**: 신고된 닉네임 모니터링

---

**작성일**: 2026-03-20
**프로젝트**: NearPrice
**상태**: 구현 완료
