import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from './entities/notice.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { NoticeResponseDto } from './dto/notice-response.dto';

@Injectable()
export class NoticeService {
  constructor(
    @InjectRepository(Notice)
    private readonly noticeRepository: Repository<Notice>,
  ) {}

  async findAll(): Promise<NoticeResponseDto[]> {
    const notices = await this.noticeRepository.find({
      where: { isActive: true },
      order: { isPinned: 'DESC', createdAt: 'DESC' },
    });
    return notices.map((n) => NoticeResponseDto.from(n));
  }

  async findOne(id: string): Promise<NoticeResponseDto> {
    const notice = await this.noticeRepository.findOne({
      where: { id, isActive: true },
    });
    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }
    return NoticeResponseDto.from(notice);
  }

  async create(dto: CreateNoticeDto): Promise<NoticeResponseDto> {
    const notice = this.noticeRepository.create(dto);
    return NoticeResponseDto.from(await this.noticeRepository.save(notice));
  }

  async update(id: string, dto: UpdateNoticeDto): Promise<NoticeResponseDto> {
    const notice = await this.noticeRepository.findOne({ where: { id } });
    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }
    Object.assign(notice, dto);
    return NoticeResponseDto.from(await this.noticeRepository.save(notice));
  }

  async remove(id: string): Promise<void> {
    const notice = await this.noticeRepository.findOne({ where: { id } });
    if (!notice) {
      throw new NotFoundException('공지사항을 찾을 수 없습니다.');
    }
    await this.noticeRepository.remove(notice);
  }
}
