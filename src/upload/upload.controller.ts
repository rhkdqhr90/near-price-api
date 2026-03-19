import {
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const;
const ALLOWED_EXTS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

@Controller('upload')
@UseGuards(JwtAuthGuard)
export class UploadController {
  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, cb) => {
          const ext = extname(file.originalname).toLowerCase();
          cb(null, `${uuidv4()}${ext}`);
        },
      }),
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
  upload(@UploadedFile() file: Express.Multer.File): { url: string } {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }
    const baseUrl = process.env.BASE_URL ?? 'http://localhost:3000';
    return { url: `${baseUrl}/uploads/${file.filename}` };
  }
}
