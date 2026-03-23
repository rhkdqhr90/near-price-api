import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Inquiry } from './entities/inquiry.entity';
import { CreateInquiryDto } from './dto/create-inquiry.dto';
import { InquiryResponseDto } from './dto/inquiry-response.dto';
import { User } from '../user/entities/user.entity';

@Injectable()
export class InquiryService {
  constructor(
    @InjectRepository(Inquiry)
    private readonly inquiryRepository: Repository<Inquiry>,
  ) {}

  async create(
    createInquiryDto: CreateInquiryDto,
    user?: User,
  ): Promise<InquiryResponseDto> {
    const inquiry = this.inquiryRepository.create({
      ...createInquiryDto,
      user: user || null,
    });

    const saved = await this.inquiryRepository.save(inquiry);
    return InquiryResponseDto.from(saved);
  }

  async findByUser(userId: string): Promise<InquiryResponseDto[]> {
    const inquiries = await this.inquiryRepository.find({
      where: { user: { id: userId } },
      order: { createdAt: 'DESC' },
    });

    return inquiries.map(InquiryResponseDto.from);
  }
}
