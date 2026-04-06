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

## 4. 보안 (OWASP Top 10 2025)

### 입력 검증 (A05: Injection)
- [ ] DTO에 `class-validator` 데코레이터 **전부** 적용?
  ```typescript
  @IsString() @IsEmail() @IsUUID() @IsNumber() @IsInt() @IsOptional() 등
  ```
- [ ] QueryBuilder 사용 시 파라미터 바인딩 필수? (`:paramName` 방식)
  ```typescript
  // ✅ 안전
  .where('price.id = :id', { id: priceId })
  // ❌ 위험
  .where(`price.id = '${priceId}'`)
  ```
- [ ] 사용자 입력값을 raw query에 직접 삽입하지 않는가?
- [ ] 문자열 길이 제한? (@Length, @MaxLength)
- [ ] 이메일/URL/숫자 형식 검증?

### 민감 정보 보호 (A01: Broken Access Control + Data Exposure)
- [ ] 민감 정보 로깅 없는가? (토큰, 비밀번호, OAuth 시크릿, 개인정보)
  ```typescript
  // ❌ 금지
  console.log('User token:', jwt_token);
  logger.info(`OAuth secret: ${secret}`);
  ```
- [ ] ResponseDto에서 민감 필드 제외? (password, oauth_secret)
- [ ] 에러 응답에서 상세 정보 노출 금지? (DB 구조 노출 방지)

### 인증 & 권한 (A01: Broken Access Control)
- [ ] 보호된 엔드포인트에 `@UseGuards(JwtAuthGuard)` 적용?
  ```typescript
  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() dto: CreatePriceDto, @Request() req) { ... }
  ```
- [ ] 관리자 전용에 `@UseGuards(AdminGuard)` 또는 `@Roles(UserRole.ADMIN)` 적용?
- [ ] 타인 리소스 수정/삭제 시 소유자 확인? (ForbiddenException)
  ```typescript
  if (price.userId !== requestUserId) {
    throw new ForbiddenException('수정 권한이 없습니다');
  }
  ```
- [ ] JWT 토큰 검증 구현? (만료, 서명 검증)
- [ ] refresh token 보안? (httpOnly, secure flags)

### 데이터 무결성
- [ ] 중요 데이터 변경 로깅? (감사 추적)
- [ ] 동시성 제어? (낙관적/비관적 락)
- [ ] 트랜잭션 처리? (여러 테이블 수정 시)

### HTTPS & 통신 보안
- [ ] 프로덕션에서 HTTPS 필수
- [ ] CORS 정책 명시? (`origins`, `credentials`)
- [ ] 헤더 보안? (X-Frame-Options, X-Content-Type-Options, CSP)

---

## 5. TypeORM / 성능 최적화

### 컬럼 타입 명시 (실제 장애 사례)
- [ ] `string | null` 유니온 타입 컬럼에 `type: 'varchar'` 명시?
  ```typescript
  // ❌ 타입 누락 → TypeORM이 "Object"로 추론 → 서버 시작 실패
  @Column({ nullable: true })
  condition: string | null;

  // ✅ 올바름
  @Column({ type: 'varchar', nullable: true })
  condition: string | null;
  ```
  > **사유**: TypeORM은 `string | null` 유니온을 단일 원시 타입으로 추론하지 못해
  > `DataTypeNotSupportedError: Data type "Object"` 에러를 던지고 DB 연결 자체가 실패한다.
  > `nullable: true`만 쓸 때는 반드시 `type`을 함께 지정한다.
- [ ] `number | null`, `boolean | null` 등 nullable 유니온에도 동일하게 `type` 명시?

### Decimal 컬럼 (좌표, 가격)
- [ ] transformer 정확하게 적용?
  ```typescript
  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    transformer: {
      from: (v: string | null) => v !== null ? parseFloat(v) : null,
      to: (v: number | null) => v,
    },
  })
  latitude: number;
  ```
- [ ] nullable decimal 처리? (null 체크)
- [ ] 정밀도 맞는가? (좌표: 7자리, 가격: 2자리)

### 쿼리 최적화 (N+1 방지)
- [ ] N+1 쿼리 없는가? (필요한 `relations` 명시)
  ```typescript
  // ✅ 올바름 (1 쿼리)
  await priceRepository.find({
    relations: ['store', 'product', 'user'],
  });

  // ❌ N+1 (1 + N 쿼리)
  const prices = await priceRepository.find();
  prices.forEach(p => console.log(p.store.name)); // 각각 쿼리 발생
  ```
- [ ] QueryBuilder 사용 시 `leftJoinAndSelect` 최적화?
  ```typescript
  createQueryBuilder('price')
    .leftJoinAndSelect('price.store', 'store')
    .leftJoinAndSelect('price.product', 'product')
    .where('price.createdAt > :date', { date: yesterday })
  ```
- [ ] 불필요한 relations 로드 금지? (성능 저하)
- [ ] Eager loading 사용하지 않음? (TypeORM 추천)

### 대량 데이터 처리
- [ ] 대량 조회 시 pagination (`take`, `skip`) 적용?
  ```typescript
  take: 20,
  skip: 0,
  order: { createdAt: 'DESC' },
  ```
- [ ] 대량 insert 시 `createQueryBuilder` + `insert`?
- [ ] 배치 처리 고려? (1000개 이상)

### 인덱스 전략
- [ ] Foreign Key 컬럼 인덱싱? (자주 조회/조인되는 FK)
- [ ] 정렬/필터링 컬럼 인덱싱? (created_at, updated_at)
- [ ] 복합 인덱스 고려? (FK + status 등)
- [ ] 위치 기반 검색용 좌표 인덱스? (GiST index)

---

## 6. DTO 규칙 & 검증

### 3종 DTO 분리
- [ ] CreateDto, UpdateDto, ResponseDto 3개 분리?
- [ ] Entity를 직접 반환하지 않고 ResponseDto 사용?
  ```typescript
  // ✅ 올바름
  return ResponseDto.from(entity);

  // ❌ 금지
  return entity; // Entity 직접 반환
  ```

### 날짜 필드 처리
- [ ] DTO의 날짜 필드에 `@Type(() => Date)` 적용?
  ```typescript
  @Type(() => Date)
  @IsDate()
  saleEndDate: Date;
  ```
- [ ] ValidationPipe에 `transform: true` 설정?
  ```typescript
  // main.ts
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  ```

### 선택 필드 처리
- [ ] UpdateDto에서 `PartialType(CreateDto)` 사용?
  ```typescript
  export class UpdatePriceDto extends PartialType(CreatePriceDto) {}
  ```
- [ ] @IsOptional() 올바르게 사용? (선택 필드만)
- [ ] FK 변경 방지 필요시 CreateDto에만 포함?

### 신뢰도 시스템 필드
- [ ] verificationResult enum 값은 실제 Entity(`src/price-verification/entities/price-verification.entity.ts`) 참조? (`confirmed` / `disputed`)
- [ ] trustScore는 `TrustScoreScheduler`(매일 03:00)만 업데이트? (Service에서 즉시 계산 금지)
- [ ] UI 표현 로직은 ResponseDto에서만 노출?

---

## 점검 방법

```bash
# 파일 저장 후 PostToolUse 훅이 자동으로 tsc + ESLint 실행
# 최종 완료 전 수동 실행:
.claude/scripts/verify.sh
```

위 체크리스트는 자동화할 수 없는 논리적 검토 항목이다.
코드 작성 완료 후 변경된 파일을 기준으로 해당 항목을 직접 검토한다.
