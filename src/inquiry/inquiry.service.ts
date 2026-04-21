import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { User } from '../user/entities/user.entity';
import { InquiryMailService } from './inquiry-mail.service';

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
}
