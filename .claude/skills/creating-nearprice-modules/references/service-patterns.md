# Service 패턴

## 핵심: return await 필수

모든 async 메서드에서 `return await` 사용. bare return Promise 절대 금지.

```typescript
// ✅ 올바름
async findOne(id: string): Promise<n> {
  const entity = await this.repository.findOne({ where: { id } });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }
  return await entity;
}

// ❌ 금지 — try/catch에서 에러 캐치 불가
async findOne(id: string): Promise<n> {
  return this.repository.findOne({ where: { id } });
}
```

## create 패턴

save 후 관계 포함 재조회.

```typescript
async create(dto: Create<n>Dto): Promise<n> {
  // FK 검증: 관련 엔티티 존재 확인
  const store = await this.storeRepository.findOne({ where: { id: dto.storeId } });
  if (!store) {
    throw new NotFoundException(`Store ${dto.storeId} not found`);
  }

  const entity = this.repository.create({ ...dto, store });
  const saved = await this.repository.save(entity);

  // 관계 포함 재조회
  return await this.repository.findOne({
    where: { id: saved.id },
    relations: ['store', 'product', 'user'],
  });
}
```

## update 패턴

스프레드 병합 금지. FK와 스칼라 필드 분리.

```typescript
async update(id: string, dto: Update<n>Dto): Promise<n> {
  const entity = await this.repository.findOne({
    where: { id },
    relations: ['store', 'product', 'user'],
  });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }

  // FK 변경이 있으면 별도 처리
  const { storeId, productId, ...scalarFields } = dto as any;
  if (storeId) {
    const store = await this.storeRepository.findOne({ where: { id: storeId } });
    if (!store) throw new NotFoundException(`Store ${storeId} not found`);
    entity.store = store;
  }

  // 스칼라 필드만 병합
  Object.assign(entity, scalarFields);
  const saved = await this.repository.save(entity);

  return await this.repository.findOne({
    where: { id: saved.id },
    relations: ['store', 'product', 'user'],
  });
}
```

## findOne / findAll 패턴

```typescript
// findOne — 없으면 NotFoundException
async findOne(id: string): Promise<n> {
  const entity = await this.repository.findOne({
    where: { id },
    relations: ['store', 'product', 'user'],
  });
  if (!entity) {
    throw new NotFoundException(`${id} not found`);
  }
  return await entity;
}

// findAll — 빈 배열 허용
async findAll(): Promise<n[]> {
  return await this.repository.find({
    relations: ['store', 'product', 'user'],
  });
}
```

## Controller 패턴 (thin)

```typescript
@Get(':id')
async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<ResponseDto> {
  return await this.service.findOne(id);
}
```

ParseUUIDPipe 필수 — 잘못된 UUID 입력 시 400 반환.

## 신뢰도 시스템 Service 패턴 (NEW)

### PriceVerificationService 핵심 메서드

```typescript
@Injectable()
export class PriceVerificationService {
  constructor(
    @InjectRepository(PriceVerification)
    private verificationRepository: Repository<PriceVerification>,
    @InjectRepository(Price)
    private priceRepository: Repository<Price>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private trustScoreCalculator: PriceTrustScoreCalculator,
  ) {}

  /**
   * 가격 검증 생성 (맞아요/달라요)
   */
  async createVerification(
    priceId: string,
    userId: string,
    createVerificationDto: CreateVerificationDto,
  ): Promise<VerificationResponseDto> {
    // 1. 가격 데이터 조회
    const price = await this.priceRepository.findOne({
      where: { id: priceId },
      relations: ['user'],
    });

    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    // 2. 본인 등록 가격 검증 방지
    if (price.user?.id === userId) {
      throw new ForbiddenException('본인이 등록한 가격은 검증할 수 없습니다');
    }

    // 3. 중복 검증 방지 (unique constraint에 의해 자동 처리되지만, 명시적 확인)
    const existing = await this.verificationRepository.findOne({
      where: {
        priceId,
        userId,
      },
    });

    if (existing) {
      throw new ConflictException('이미 이 가격을 검증했습니다');
    }

    // 4. 검증 데이터 생성 및 저장
    const verification = this.verificationRepository.create({
      priceId,
      userId,
      result: createVerificationDto.result,
      comment: createVerificationDto.comment,
    });

    const saved = await this.verificationRepository.save(verification);

    // 5. 신뢰도 점수 자동 계산 (트리거)
    await this.trustScoreCalculator.calculateAndUpdate(price.userId);

    // 6. 관계 포함 재조회 후 반환
    return await this.verificationRepository.findOne({
      where: { id: saved.id },
      relations: ['price', 'user'],
    });
  }

  /**
   * 가격별 검증 데이터 조회
   */
  async findVerificationsByPrice(priceId: string): Promise<VerificationResponseDto[]> {
    const price = await this.priceRepository.findOne({ where: { id: priceId } });
    if (!price) {
      throw new NotFoundException('가격 데이터를 찾을 수 없습니다');
    }

    const verifications = await this.verificationRepository.find({
      where: { priceId },
      relations: ['user'],
      order: { createdAt: 'DESC' },
    });

    return await verifications.map((v) => VerificationResponseDto.from(v));
  }

  /**
   * 검증 데이터 삭제 (관리자 또는 등록자만)
   */
  async deleteVerification(
    verificationId: string,
    userId: string,
    isAdmin: boolean,
  ): Promise<void> {
    const verification = await this.verificationRepository.findOne({
      where: { id: verificationId },
      relations: ['price'],
    });

    if (!verification) {
      throw new NotFoundException('검증 데이터를 찾을 수 없습니다');
    }

    // 권한 확인 (본인 또는 관리자만)
    if (verification.userId !== userId && !isAdmin) {
      throw new ForbiddenException('삭제 권한이 없습니다');
    }

    const priceOwnerId = verification.price.userId;

    await this.verificationRepository.delete(verificationId);

    // 신뢰도 점수 재계산
    await this.trustScoreCalculator.calculateAndUpdate(priceOwnerId);
  }
}
```

### TrustScoreCalculator Service

```typescript
@Injectable()
export class PriceTrustScoreCalculator {
  constructor(
    @InjectRepository(PriceVerification)
    private verificationRepository: Repository<PriceVerification>,
    @InjectRepository(TrustScore)
    private trustScoreRepository: Repository<TrustScore>,
    @InjectRepository(Badge)
    private badgeRepository: Repository<Badge>,
  ) {}

  /**
   * 사용자의 신뢰도 점수 자동 계산 및 저장
   */
  async calculateAndUpdate(userId: string): Promise<TrustScore> {
    // 1. 사용자가 등록한 모든 가격의 검증 데이터 조회
    const verifications = await this.verificationRepository.find({
      where: { price: { userId } },
    });

    const totalVerifications = verifications.length;
    const matchVerifications = verifications.filter(
      (v) => v.result === VerificationResult.MATCH,
    ).length;

    // 2. 신뢰도 점수 계산 (0~100)
    const trustScore =
      totalVerifications > 0
        ? Math.round((matchVerifications / totalVerifications) * 100)
        : 0;

    // 3. 신뢰도 레벨 결정
    const level = this.calculateLevel(trustScore);

    // 4. TrustScore 엔티티 저장 (upsert)
    let trustScoreEntity = await this.trustScoreRepository.findOne({
      where: { userId },
    });

    if (!trustScoreEntity) {
      trustScoreEntity = this.trustScoreRepository.create({
        userId,
        totalVerifications: 0,
        matchVerifications: 0,
        trustScore: 0,
        level: BadgeLevel.BRONZE,
      });
    }

    trustScoreEntity.totalVerifications = totalVerifications;
    trustScoreEntity.matchVerifications = matchVerifications;
    trustScoreEntity.trustScore = trustScore;
    trustScoreEntity.level = level;

    const saved = await this.trustScoreRepository.save(trustScoreEntity);

    // 5. Badge 자동 업데이트
    await this.updateBadge(userId, level);

    return await this.trustScoreRepository.findOne({ where: { userId } });
  }

  /**
   * 신뢰도 점수 → 레벨 변환
   */
  private calculateLevel(trustScore: number): BadgeLevel {
    if (trustScore >= 75) return BadgeLevel.PLATINUM;
    if (trustScore >= 50) return BadgeLevel.GOLD;
    if (trustScore >= 25) return BadgeLevel.SILVER;
    return BadgeLevel.BRONZE;
  }

  /**
   * Badge 업데이트
   */
  private async updateBadge(userId: string, level: BadgeLevel): Promise<void> {
    let badge = await this.badgeRepository.findOne({ where: { userId } });

    if (!badge) {
      badge = this.badgeRepository.create({
        userId,
        level,
      });
    } else {
      badge.level = level;
    }

    await this.badgeRepository.save(badge);
  }
}
```

## Controller 패턴 (신뢰도 엔드포인트)

```typescript
@Controller('prices/:id/verify')
@UseGuards(JwtAuthGuard)
export class PriceVerificationController {
  constructor(
    private readonly priceVerificationService: PriceVerificationService,
  ) {}

  /**
   * POST /prices/:id/verify - 가격 검증
   */
  @Post()
  async createVerification(
    @Param('id', ParseUUIDPipe) priceId: string,
    @Body() dto: CreateVerificationDto,
    @Request() req,
  ): Promise<VerificationResponseDto> {
    return await this.priceVerificationService.createVerification(
      priceId,
      req.user.userId,
      dto,
    );
  }

  /**
   * GET /prices/:id/verify - 가격별 검증 조회
   */
  @Get()
  async findVerifications(
    @Param('id', ParseUUIDPipe) priceId: string,
  ): Promise<VerificationResponseDto[]> {
    return await this.priceVerificationService.findVerificationsByPrice(priceId);
  }

  /**
   * DELETE /verify/:verificationId - 검증 삭제
   */
  @Delete(':verificationId')
  async deleteVerification(
    @Param('verificationId', ParseUUIDPipe) verificationId: string,
    @Request() req,
  ): Promise<void> {
    return await this.priceVerificationService.deleteVerification(
      verificationId,
      req.user.userId,
      req.user.role === UserRole.ADMIN,
    );
  }
}
```

## 금지사항

- Controller에 비즈니스 로직 금지 (Service 호출만)
- Repository 직접 접근 금지 (Controller → Service → Repository)
- silent error swallowing 금지 (빈 catch 블록)
- findOne에서 null 반환 금지 → 적절한 Exception throw
- 중복 검증 체크 누락 금지 (unique constraint + 명시적 확인)
- 트리거 로직 누락 금지 (신뢰도 자동 계산)
