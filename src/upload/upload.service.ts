import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
  });

  private resolveStorageMode(): 's3' | 'local' {
    // 프로덕션은 항상 S3 사용 (환경 분리 강제)
    if (process.env.NODE_ENV === 'production') {
      return 's3';
    }

    const configured = (process.env.UPLOAD_STORAGE ?? '').trim().toLowerCase();
    if (configured === 's3') {
      return 's3';
    }

    return 'local';
  }

  private getLocalUploadDir(): string {
    const configured = process.env.LOCAL_UPLOAD_DIR?.trim();
    return configured && configured.length > 0
      ? configured
      : `${process.cwd()}/uploads`;
  }

  private getUploadPublicBaseUrl(): string {
    const configured = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
    if (configured && configured.length > 0) {
      return configured.replace(/\/+$/, '');
    }

    const port = process.env.PORT ?? '3000';
    return `http://localhost:${port}`;
  }

  async upload(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }

    const storageMode = this.resolveStorageMode();
    if (storageMode === 's3') {
      return await this.uploadToS3(file);
    }

    return await this.uploadToLocal(file);
  }

  async uploadToS3(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }

    const bucket = process.env.S3_BUCKET_NAME;
    if (!bucket) {
      throw new InternalServerErrorException(
        '[UploadService] S3_BUCKET_NAME 환경변수가 설정되지 않았습니다.',
      );
    }

    const ext = extname(file.originalname).toLowerCase();
    const key = `uploads/${uuidv4()}${ext}`;
    const region = process.env.AWS_REGION ?? 'ap-northeast-2';

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
        }),
      );
    } catch (error) {
      this.logger.error('S3 업로드 실패:', error);
      throw new InternalServerErrorException('이미지 업로드에 실패했습니다.');
    }

    return {
      url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    };
  }

  async uploadToLocal(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }

    const ext = extname(file.originalname).toLowerCase() || '.jpg';
    const fileName = `${uuidv4()}${ext}`;
    const uploadDir = this.getLocalUploadDir();
    const filePath = `${uploadDir}/${fileName}`;

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, file.buffer);
    } catch (error) {
      this.logger.error('로컬 파일 저장 실패:', error);
      throw new InternalServerErrorException('이미지 저장에 실패했습니다.');
    }

    const publicBaseUrl = this.getUploadPublicBaseUrl();
    return {
      url: `${publicBaseUrl}/uploads/${fileName}`,
    };
  }
}
