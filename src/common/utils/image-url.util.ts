const DEFAULT_AWS_REGION = 'ap-northeast-2';

const trimTrailingSlash = (value: string): string => value.replace(/\/+$/, '');

const trimLeadingSlash = (value: string): string => value.replace(/^\/+/, '');

const toAbsoluteBaseUrl = (value: string): string => {
  if (/^https?:\/\//i.test(value)) {
    return trimTrailingSlash(value);
  }

  return `https://${trimTrailingSlash(value)}`;
};

export const resolveUploadPublicBaseUrl = (): string | null => {
  const explicit = process.env.UPLOAD_PUBLIC_BASE_URL?.trim();
  if (explicit && explicit.length > 0) {
    return toAbsoluteBaseUrl(explicit);
  }

  const cloudfrontDomain = process.env.CLOUDFRONT_DOMAIN?.trim();
  if (cloudfrontDomain && cloudfrontDomain.length > 0) {
    return toAbsoluteBaseUrl(cloudfrontDomain);
  }

  return null;
};

const getS3VirtualHost = (): string | null => {
  const bucket = process.env.S3_BUCKET_NAME?.trim();
  if (!bucket) {
    return null;
  }

  const region = process.env.AWS_REGION?.trim() || DEFAULT_AWS_REGION;
  return `${bucket}.s3.${region}.amazonaws.com`;
};

const extractObjectPath = (rawUrl: string): string | null => {
  try {
    const parsed = new URL(rawUrl);
    const s3VirtualHost = getS3VirtualHost();
    if (!s3VirtualHost || parsed.hostname !== s3VirtualHost) {
      return null;
    }

    const objectPath = trimLeadingSlash(parsed.pathname);
    if (!objectPath) {
      return null;
    }

    return objectPath;
  } catch {
    return null;
  }
};

export const normalizeImageUrl = (
  rawUrl: string | null | undefined,
): string | null => {
  if (!rawUrl) {
    return null;
  }

  const baseUrl = resolveUploadPublicBaseUrl();
  if (!baseUrl) {
    return rawUrl;
  }

  if (!/^https?:\/\//i.test(rawUrl)) {
    return `${baseUrl}/${trimLeadingSlash(rawUrl)}`;
  }

  const objectPath = extractObjectPath(rawUrl);
  if (!objectPath) {
    return rawUrl;
  }

  return `${baseUrl}/${objectPath}`;
};
