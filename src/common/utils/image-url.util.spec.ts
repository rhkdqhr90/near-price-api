import {
  normalizeImageUrl,
  resolveUploadPublicBaseUrl,
} from './image-url.util';

describe('image-url.util', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.UPLOAD_PUBLIC_BASE_URL;
    delete process.env.CLOUDFRONT_DOMAIN;
    delete process.env.S3_BUCKET_NAME;
    delete process.env.AWS_REGION;
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('UPLOAD_PUBLIC_BASE_URL이 있으면 우선 사용한다', () => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'https://cdn.example.com';
    process.env.CLOUDFRONT_DOMAIN = 'fallback.cloudfront.net';

    expect(resolveUploadPublicBaseUrl()).toBe('https://cdn.example.com');
  });

  it('S3 가상호스트 URL을 CDN URL로 변환한다', () => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'https://d1example.cloudfront.net';
    process.env.S3_BUCKET_NAME = 'near-price-uploads';
    process.env.AWS_REGION = 'ap-northeast-2';

    const s3Url =
      'https://near-price-uploads.s3.ap-northeast-2.amazonaws.com/uploads/abc.jpg';

    expect(normalizeImageUrl(s3Url)).toBe(
      'https://d1example.cloudfront.net/uploads/abc.jpg',
    );
  });

  it('S3 URL이 아니면 원본 URL을 유지한다', () => {
    process.env.UPLOAD_PUBLIC_BASE_URL = 'https://d1example.cloudfront.net';
    const externalUrl = 'https://images.example.com/path/img.jpg';

    expect(normalizeImageUrl(externalUrl)).toBe(externalUrl);
  });
});
