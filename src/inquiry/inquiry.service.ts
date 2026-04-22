import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry, InquiryStatus } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { User } from '../user/entities/user.entity';
import { InquiryMailService } from './inquiry-mail.service';
import { ReplyInquiryDto } from './dto/reply-inquiry.dto';

@Injectable()
export class InquiryService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly inquiryMailService: InquiryMailService,
  ) {}

  async create(
    createInquiryDto: CreateInquiryDto,
    userId: string,
  ): Promise<InquiryResponseDto> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }
    const inquiry = this.inquiryRepository.create({
      ...createInquiryDto,
      email: user.email,
      user,
    });

    const saved = await this.inquiryRepository.save(inquiry);

    await this.inquiryMailService.sendInquiryCreatedEmails({
      inquiryId: saved.id,
      title: saved.title,
      content: saved.content,
      userEmail: saved.email,
      createdAt: saved.createdAt,
    });

    return InquiryResponseDto.from(saved);
  }

  async findByUser(userId: string): Promise<InquiryResponseDto[]> {
    const inquiries = await this.inquiryRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    return inquiries.map((i) => InquiryResponseDto.from(i));
  }

  async findAll(): Promise<InquiryResponseDto[]> {
    const inquiries = await this.inquiryRepository.find({
      order: { createdAt: 'DESC' },
    });

    return inquiries.map((i) => InquiryResponseDto.from(i));
  }

  async reply(
    inquiryId: string,
    replyInquiryDto: ReplyInquiryDto,
  ): Promise<InquiryResponseDto> {
    const inquiry = await this.inquiryRepository.findOneBy({ id: inquiryId });
    if (!inquiry) {
      throw new NotFoundException('문의를 찾을 수 없습니다');
    }

    inquiry.adminReply = replyInquiryDto.adminReply.trim();
    inquiry.status = InquiryStatus.ANSWERED;

    const saved = await this.inquiryRepository.save(inquiry);

    await this.inquiryMailService.sendInquiryAnsweredEmail({
      inquiryId: saved.id,
      title: saved.title,
      adminReply: saved.adminReply ?? '',
      userEmail: saved.email,
      answeredAt: saved.updatedAt,
    });

    return InquiryResponseDto.from(saved);
  }
}
