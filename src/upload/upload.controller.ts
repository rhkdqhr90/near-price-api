import {
  Controller,
  Logger,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
  private readonly logger = new Logger(UploadController.name);

  constructor(private readonly configService: ConfigService) {}

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
    const baseUrl = this.configService.get<string>('BASE_URL');
    if (!baseUrl) {
      this.logger.warn(
        'BASE_URL 환경변수가 설정되지 않았습니다. 기본값(http://localhost:3000)을 사용합니다.',
      );
    }
    return {
      url: `${baseUrl ?? 'http://localhost:3000'}/uploads/${file.filename}`,
    };
  }
}
