import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Flyer } from './entities/flyer.entity';
import { OwnerPost } from './entities/owner-post.entity';
import { CreateFlyerDto } from './dto/create-flyer.dto';
import { UpdateFlyerDto } from './dto/update-flyer.dto';
import { FlyerResponseDto } from './dto/flyer-response.dto';
import { CreateOwnerPostDto } from './dto/create-owner-post.dto';
import { UpdateOwnerPostDto } from './dto/update-owner-post.dto';
import { OwnerPostResponseDto } from './dto/owner-post-response.dto';
import { User } from '../user/entities/user.entity';
import { NotificationService } from '../notification/notification.service';
import {
  OwnerApplication,
  OwnerApplicationStatus,
} from '../owner-application/entities/owner-application.entity';

@Injectable()
export class FlyerService {
  private readonly logger = new Logger(FlyerService.name);

  constructor(
    @InjectRepository(Flyer)
    private readonly flyerRepository: Repository<Flyer>,

    @InjectRepository(OwnerPost)
    private readonly ownerPostRepository: Repository<OwnerPost>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    @InjectRepository(OwnerApplication)
    private readonly ownerApplicationRepository: Repository<OwnerApplication>,

    private readonly notificationService: NotificationService,
  ) {}

  // ─── Flyers ──────────────────────────────────────────────────────────────

  async findAllFlyers(): Promise<FlyerResponseDto[]> {
    const flyers = await this.flyerRepository.find({
      where: { isActive: true },
      relations: ['ownerApplication'],
      order: { createdAt: 'DESC' },
    });
    return flyers.map((f) => FlyerResponseDto.from(f));
  }

  async findOneFlyer(id: string): Promise<FlyerResponseDto> {
    const flyer = await this.flyerRepository.findOne({
      where: { id, isActive: true },
      relations: ['ownerApplication'],
    });
    if (!flyer) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
    }
    return FlyerResponseDto.from(flyer);
  }

  async createFlyer(dto: CreateFlyerDto): Promise<FlyerResponseDto> {
    const flyer = this.flyerRepository.create(dto);
    const saved = await this.flyerRepository.save(flyer);

    // 전단지 알림 수신 동의 사용자에게 FCM 푸시 발송 (500명 청크 배치)
    this.sendFlyerNotifications(
      `${saved.storeName} 새 전단지`,
      saved.promotionTitle,
      saved.id,
    ).catch((err: unknown) =>
      this.logger.warn('전단지 FCM 알림 실패', (err as Error)?.message),
    );

    return FlyerResponseDto.from(saved);
  }

  async findMyFlyers(userId: string): Promise<FlyerResponseDto[]> {
    const ownerApplication = await this.ownerApplicationRepository.findOne({
      where: {
        user: { id: userId },
        status: OwnerApplicationStatus.APPROVED,
      },
    });
    if (!ownerApplication) {
      return [];
    }

    const flyers = await this.flyerRepository.find({
      where: { ownerApplication: { id: ownerApplication.id } },
      relations: ['ownerApplication'],
      order: { createdAt: 'DESC' },
    });
    return flyers.map((flyer) => FlyerResponseDto.from(flyer));
  }

  async createMyFlyer(
    userId: string,
    dto: CreateFlyerDto,
  ): Promise<FlyerResponseDto> {
    const ownerApplication = await this.getApprovedOwnerApplication(userId);

    const flyer = this.flyerRepository.create({
      ...dto,
      storeName: ownerApplication.store.name,
      storeAddress: dto.storeAddress ?? ownerApplication.store.address,
      ownerApplication,
    });

    const saved = await this.flyerRepository.save(flyer);

    this.sendFlyerNotifications(
      `${saved.storeName} 새 전단지`,
      saved.promotionTitle,
      saved.id,
    ).catch((err: unknown) =>
      this.logger.warn('전단지 FCM 알림 실패', (err as Error)?.message),
    );

    const reloaded = await this.flyerRepository.findOne({
      where: { id: saved.id },
      relations: ['ownerApplication'],
    });
    if (!reloaded) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
    }
    return FlyerResponseDto.from(reloaded);
  }

  private async sendFlyerNotifications(
    title: string,
    body: string,
    flyerId: string,
  ): Promise<void> {
    const BATCH_SIZE = 500;
    let skip = 0;
    while (true) {
      const users = await this.userRepository.find({
        where: { notifPromotion: true },
        select: ['id', 'fcmToken'],
        order: { id: 'ASC' },
        take: BATCH_SIZE,
        skip,
      });
      if (users.length === 0) break;

      const pairs = users.map((u) => ({
        userId: u.id,
        fcmToken: u.fcmToken ?? null,
      }));

      const failedTokens = await this.notificationService.createAndPushMany(
        pairs,
        {
          type: 'system',
          title,
          body,
          linkType: 'url',
          linkId: `nearprice://flyer/${flyerId}`,
        },
      );

      // 만료/무효 토큰 정리
      if (failedTokens.length > 0) {
        await this.userRepository.update(
          { fcmToken: In(failedTokens) },
          { fcmToken: null },
        );
      }

      skip += BATCH_SIZE;
      if (users.length < BATCH_SIZE) break;
    }
  }

  async updateFlyer(
    id: string,
    dto: UpdateFlyerDto,
  ): Promise<FlyerResponseDto> {
    const flyer = await this.flyerRepository.findOne({ where: { id } });
    if (!flyer) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
    }
    Object.assign(flyer, dto);
    return FlyerResponseDto.from(await this.flyerRepository.save(flyer));
  }

  async updateMyFlyer(
    userId: string,
    id: string,
    dto: UpdateFlyerDto,
  ): Promise<FlyerResponseDto> {
    const ownerApplication = await this.getApprovedOwnerApplication(userId);

    const flyer = await this.flyerRepository.findOne({
      where: {
        id,
        ownerApplication: { id: ownerApplication.id },
      },
      relations: ['ownerApplication'],
    });
    if (!flyer) {
      throw new NotFoundException('내 전단지를 찾을 수 없습니다.');
    }

    Object.assign(flyer, dto);
    flyer.storeName = ownerApplication.store.name;
    if (!flyer.storeAddress) {
      flyer.storeAddress = ownerApplication.store.address;
    }

    return FlyerResponseDto.from(await this.flyerRepository.save(flyer));
  }

  async removeFlyer(id: string): Promise<void> {
    const flyer = await this.flyerRepository.findOne({ where: { id } });
    if (!flyer) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
    }
    await this.flyerRepository.remove(flyer);
  }

  async removeMyFlyer(userId: string, id: string): Promise<void> {
    const ownerApplication = await this.getApprovedOwnerApplication(userId);

    const flyer = await this.flyerRepository.findOne({
      where: {
        id,
        ownerApplication: { id: ownerApplication.id },
      },
    });
    if (!flyer) {
      throw new NotFoundException('내 전단지를 찾을 수 없습니다.');
    }

    await this.flyerRepository.remove(flyer);
  }

  // ─── Owner Posts ──────────────────────────────────────────────────────────

  async findAllOwnerPosts(): Promise<OwnerPostResponseDto[]> {
    const posts = await this.ownerPostRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return posts.map((p) => OwnerPostResponseDto.from(p));
  }

  async createOwnerPost(
    dto: CreateOwnerPostDto,
  ): Promise<OwnerPostResponseDto> {
    const post = this.ownerPostRepository.create(dto);
    return OwnerPostResponseDto.from(await this.ownerPostRepository.save(post));
  }

  async updateOwnerPost(
    id: string,
    dto: UpdateOwnerPostDto,
  ): Promise<OwnerPostResponseDto> {
    const post = await this.ownerPostRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException('사장님 게시글을 찾을 수 없습니다.');
    }
    Object.assign(post, dto);
    return OwnerPostResponseDto.from(await this.ownerPostRepository.save(post));
  }

  async removeOwnerPost(id: string): Promise<void> {
    const post = await this.ownerPostRepository.findOne({ where: { id } });
    if (!post) {
      throw new NotFoundException('사장님 게시글을 찾을 수 없습니다.');
    }
    await this.ownerPostRepository.remove(post);
  }

  private async getApprovedOwnerApplication(
    userId: string,
  ): Promise<OwnerApplication> {
    const ownerApplication = await this.ownerApplicationRepository.findOne({
      where: {
        user: { id: userId },
        status: OwnerApplicationStatus.APPROVED,
      },
      relations: ['store'],
    });
    if (!ownerApplication) {
      throw new ForbiddenException(
        '승인된 사장 계정만 전단지를 관리할 수 있습니다.',
      );
    }

    return ownerApplication;
  }
}
