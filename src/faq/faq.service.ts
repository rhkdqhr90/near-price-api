import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Faq } from './entities/faq.entity';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { FaqGroupedResponseDto, FaqResponseDto } from './dto/faq-response.dto';

@Injectable()
export class FaqService {
  constructor(
    @InjectRepository(Faq)
    private readonly faqRepository: Repository<Faq>,
  ) {}

  async findAllGrouped(): Promise<FaqGroupedResponseDto[]> {
    const faqs = await this.faqRepository.find({
      where: { isActive: true },
      order: { orderIndex: 'ASC', createdAt: 'ASC' },
    });

    const groupMap = new Map<string | null, FaqResponseDto[]>();
    for (const faq of faqs) {
      const key = faq.category ?? null;
      if (!groupMap.has(key)) {
        groupMap.set(key, []);
      }
      groupMap.get(key)?.push(FaqResponseDto.from(faq));
    }

    return Array.from(groupMap.entries()).map(([category, items]) => ({
      category,
      items,
    }));
  }

  async findOne(id: string): Promise<FaqResponseDto> {
    const faq = await this.faqRepository.findOne({
      where: { id, isActive: true },
    });
    if (!faq) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }
    return FaqResponseDto.from(faq);
  }

  async create(dto: CreateFaqDto): Promise<FaqResponseDto> {
    const faq = this.faqRepository.create(dto);
    return FaqResponseDto.from(await this.faqRepository.save(faq));
  }

  async update(id: string, dto: UpdateFaqDto): Promise<FaqResponseDto> {
    const faq = await this.faqRepository.findOne({ where: { id } });
    if (!faq) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }
    Object.assign(faq, dto);
    return FaqResponseDto.from(await this.faqRepository.save(faq));
  }

  async remove(id: string): Promise<void> {
    const faq = await this.faqRepository.findOne({ where: { id } });
    if (!faq) {
      throw new NotFoundException('FAQ를 찾을 수 없습니다.');
    }
    await this.faqRepository.remove(faq);
  }
}
