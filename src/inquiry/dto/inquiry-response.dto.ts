import { InquiryStatus, Inquiry } from '../entities/inquiry.entity';

export class InquiryResponseDto {
  id: string;
  title: string;
  content: string;
  email: string;
  status: InquiryStatus;
  adminReply: string | null;
  createdAt: Date;
  updatedAt: Date;

  static from(inquiry: Inquiry): InquiryResponseDto {
    const dto = new InquiryResponseDto();
    dto.id = inquiry.id;
    dto.title = inquiry.title;
    dto.content = inquiry.content;
    dto.email = inquiry.email;
    dto.status = inquiry.status;
    dto.adminReply = inquiry.adminReply;
    dto.createdAt = inquiry.createdAt;
    dto.updatedAt = inquiry.updatedAt;
    return dto;
  }
}
