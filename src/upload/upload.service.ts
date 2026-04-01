import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
  });

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
}
