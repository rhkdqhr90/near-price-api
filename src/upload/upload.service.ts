import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { promises as fs } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import sharp from 'sharp';
import {
  normalizeImageUrl,
  resolveUploadPublicBaseUrl,
} from '../common/utils/image-url.util';

/**
 * 업로드 이미지 변환 정책.
 * - 휴대폰 카메라 원본 사진(2~5MB)이 그대로 S3에 올라가던 문제 해결.
 * - 최대 1200x1200 (긴 변 기준) 안에 맞춤. 작은 사진은 확대하지 않음.
 * - JPEG 품질 82, mozjpeg 인코더 → 약 200~400KB로 압축.
 * - EXIF orientation을 픽셀에 적용 후 메타데이터 제거 → 클라이언트 회전 처리 불필요 + 용량 절감.
 * - PNG/WebP 입력도 JPEG로 정규화하여 출력 일관성 확보 (상품/가격표 이미지에 알파 불필요).
 */
const IMAGE_MAX_DIMENSION = 1200;
const IMAGE_JPEG_QUALITY = 82;

@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly s3 = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
  });

  /**
   * 업로드 원본 사진을 카드 표시용 크기로 정규화 (리사이즈 + JPEG 압축).
   * 결과물은 항상 JPEG.
   */
  private async normalizeImageBuffer(
    file: Express.Multer.File,
  ): Promise<{ buffer: Buffer; ext: string; mimetype: string }> {
    try {
      const buffer = await sharp(file.buffer)
        .rotate()
        .resize(IMAGE_MAX_DIMENSION, IMAGE_MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
        .jpeg({
          quality: IMAGE_JPEG_QUALITY,
          mozjpeg: true,
          progressive: true,
        })
        .toBuffer();

      return { buffer, ext: '.jpg', mimetype: 'image/jpeg' };
    } catch (error) {
      this.logger.error('이미지 변환 실패:', error);
      throw new BadRequestException('이미지 형식이 올바르지 않습니다.');
    }
  }

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
      : join(process.cwd(), 'uploads');
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

    const normalized = await this.normalizeImageBuffer(file);
    const key = `uploads/${uuidv4()}${normalized.ext}`;
    const region = process.env.AWS_REGION ?? 'ap-northeast-2';

    try {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: normalized.buffer,
          ContentType: normalized.mimetype,
        }),
      );
    } catch (error) {
      this.logger.error('S3 업로드 실패:', error);
      throw new InternalServerErrorException('이미지 업로드에 실패했습니다.');
    }

    const s3Url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`;
    return {
      url: normalizeImageUrl(s3Url) ?? s3Url,
    };
  }

  async uploadToLocal(file: Express.Multer.File): Promise<{ url: string }> {
    if (!file) {
      throw new BadRequestException('파일이 없습니다.');
    }

    const normalized = await this.normalizeImageBuffer(file);
    const fileName = `${uuidv4()}${normalized.ext}`;
    const uploadDir = this.getLocalUploadDir();
    const filePath = `${uploadDir}/${fileName}`;

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      await fs.writeFile(filePath, normalized.buffer);
    } catch (error) {
      this.logger.error('로컬 파일 저장 실패:', error);
      throw new InternalServerErrorException('이미지 저장에 실패했습니다.');
    }

    const publicBaseUrl =
      resolveUploadPublicBaseUrl() ??
      `http://localhost:${process.env.PORT ?? '3000'}`;
    return {
      url: `${publicBaseUrl}/uploads/${fileName}`,
    };
  }
}
