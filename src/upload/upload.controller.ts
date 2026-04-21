import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { extname } from 'path';
import multer from 'multer';
import { fromBuffer } from 'file-type';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UploadService } from './upload.service';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: multer.memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!(ALLOWED_MIMES as readonly string[]).includes(file.mimetype)) {
          cb(
            new BadRequestException(
              '이미지 파일만 업로드 가능합니다. (jpg, png, webp)',
            ),
            false,
          );
          return;
        }
        const ext = extname(file.originalname).toLowerCase();
        if (!(ALLOWED_EXTS as readonly string[]).includes(ext)) {
          cb(
            new BadRequestException('허용되지 않는 파일 확장자입니다.'),
            false,
          );
          return;
        }
        cb(null, true);
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }

    // Magic bytes 검증: MIME 스푸핑 방지 (실제 파일 시그니처 확인)
    const detected = await fromBuffer(file.buffer);
    if (
      !detected ||
      !(ALLOWED_MIMES as readonly string[]).includes(detected.mime)
    ) {
      throw new BadRequestException('허용되지 않는 파일 형식입니다.');
    }

    return await this.uploadService.upload(file);
  }
}
