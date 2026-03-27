import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

@Injectable()
export class FlyerService {
  constructor(
    @InjectRepository(Flyer)
    private readonly flyerRepository: Repository<Flyer>,

    @InjectRepository(OwnerPost)
    private readonly ownerPostRepository: Repository<OwnerPost>,

    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    private readonly notificationService: NotificationService,
  ) {}

  // ─── Flyers ──────────────────────────────────────────────────────────────

  async findAllFlyers(): Promise<FlyerResponseDto[]> {
    const flyers = await this.flyerRepository.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return flyers.map((f) => FlyerResponseDto.from(f));
  }

  async findOneFlyer(id: string): Promise<FlyerResponseDto> {
    const flyer = await this.flyerRepository.findOne({
      where: { id, isActive: true },
    });
    if (!flyer) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
    }
    return FlyerResponseDto.from(flyer);
  }

  async createFlyer(dto: CreateFlyerDto): Promise<FlyerResponseDto> {
    const flyer = this.flyerRepository.create(dto);
    const saved = await this.flyerRepository.save(flyer);

    // 전단지 알림 수신 동의 사용자에게 FCM 푸시 발송
    const users = await this.userRepository.find({
      where: { notifPromotion: true },
      select: ['fcmToken'],
    });
    await Promise.all(
      users
        .filter((u) => u.fcmToken)
        .map((u) =>
          this.notificationService.sendToUser(
            u.fcmToken!,
            `${saved.storeName} 새 전단지`,
            saved.promotionTitle,
          ),
        ),
    );

    return FlyerResponseDto.from(saved);
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

  async removeFlyer(id: string): Promise<void> {
    const flyer = await this.flyerRepository.findOne({ where: { id } });
    if (!flyer) {
      throw new NotFoundException('전단지를 찾을 수 없습니다.');
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
}
