import { Faq } from '../entities/faq.entity';

export class FaqResponseDto {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  orderIndex: number;
  isActive: boolean;
  createdAt: Date;

  static from(faq: Faq): FaqResponseDto {
    const dto = new FaqResponseDto();
    dto.id = faq.id;
    dto.question = faq.question;
    dto.answer = faq.answer;
    dto.category = faq.category;
    dto.orderIndex = faq.orderIndex;
    dto.isActive = faq.isActive;
    dto.createdAt = faq.createdAt;
    return dto;
  }
}

export interface FaqGroupedResponseDto {
  category: string | null;
  items: FaqResponseDto[];
}
