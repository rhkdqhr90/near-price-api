# NearPrice 백엔드 코드 리뷰 체크리스트

검증 파이프라인(ESLint → TypeScript → return await 검사) 통과 후 **반드시** 이 체크리스트를 점검한다.
하나라도 위반 발견 시 즉시 수정하고 재검증한다.

---

## 1. 아키텍처

- [ ] Controller는 thin한가? (Service 호출만, 비즈니스 로직 없음)
- [ ] Service에서만 Repository 접근? (Controller에서 직접 Repository 호출 금지)
- [ ] DTO 3종 분리: CreateDto / UpdateDto / ResponseDto 각각 분리?
- [ ] Entity를 직접 반환하지 않는가? (`ResponseDto.from()` 패턴 사용)
- [ ] Module에 Entity 명시적 등록? (`TypeOrmModule.forFeature([Entity])`, glob 패턴 금지)

---

## 2. 비동기 / return await

- [ ] 모든 async 메서드에서 `return await` 사용?
- [ ] `return this.repository.find(...)` 같이 await 없이 Promise 반환하는 패턴 없는가?
- [ ] `try/catch` 내부에서 `return` 없이 `await` 빠진 Promise 없는가?
- [ ] `Promise.all([])` 결과를 `await` 없이 반환하지 않는가?

---

## 3. 에러 처리

- [ ] `findOne` → null 결과 시 `NotFoundException` 처리?
- [ ] 타인 리소스 접근 → `ForbiddenException` 처리?
- [ ] `catch` 블록에서 에러를 삼키지 않는가? (silent error swallowing 금지)
- [ ] 적절한 NestJS 예외 사용? (NotFoundException, BadRequestException, ConflictException 등)

---

## 4. 보안

- [ ] DTO에 `class-validator` 데코레이터 전부 적용? (`@IsString()`, `@IsUUID()` 등)
- [ ] QueryBuilder 사용 시 파라미터 바인딩 사용? (SQL injection 방지)
- [ ] 민감 정보 로깅 없는가? (토큰, 비밀번호, 개인정보)
- [ ] 인증 필요 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용?
- [ ] 관리자 전용 엔드포인트에 `AdminGuard` 적용?

---

## 5. TypeORM / 성능

- [ ] decimal 컬럼에 `transformer: { from: (v) => parseFloat(v) }` 적용?
- [ ] N+1 쿼리 없는가? (필요한 `relations`만 명시하거나 QueryBuilder join 사용)
- [ ] 불필요한 relations를 과도하게 로드하지 않는가?
- [ ] 대량 조회 시 `take` / 페이지네이션 적용?

---

## 6. DTO 규칙

- [ ] 날짜 필드 DTO에 `@Type(() => Date)` + `ValidationPipe transform: true`?
- [ ] `UpdateDto`는 `PartialType(CreateDto)` 상속 사용?
- [ ] `trustScore`: int로 처리, UI 표현 로직은 프론트에 위임?

---

## 점검 방법

```bash
# 파일 저장 후 PostToolUse 훅이 자동으로 tsc + ESLint 실행
# 최종 완료 전 수동 실행:
.claude/scripts/verify.sh
```

위 체크리스트는 자동화할 수 없는 논리적 검토 항목이다.
코드 작성 완료 후 변경된 파일을 기준으로 해당 항목을 직접 검토한다.
