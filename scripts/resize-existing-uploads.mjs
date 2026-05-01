#!/usr/bin/env node
/**
 * 기존 S3 업로드 이미지 일괄 리사이즈 스크립트.
 *
 * 배경: upload.service.ts에 sharp 변환을 추가하기 전에 업로드된 이미지들이
 *       원본 그대로(2~5MB) S3에 남아 있어 모바일 홈 화면에서 다운로드 지연/실패가
 *       발생했다. 이 스크립트는 1회성으로 기존 객체들을 같은 키로 덮어써서
 *       URL 변경 없이 운영 화면을 즉시 정상화한다.
 *
 * 동작:
 *   1. S3 버킷의 `uploads/` prefix 아래 모든 객체 나열
 *   2. ContentLength가 SIZE_THRESHOLD를 넘는 객체만 대상
 *   3. GET → sharp로 1200x1200 / JPEG q82 변환 → 같은 Key로 PutObject (덮어쓰기)
 *   4. 처리 결과 요약 출력
 *
 * 사용법:
 *   AWS_ACCESS_KEY_ID=... AWS_SECRET_ACCESS_KEY=... \
 *     S3_BUCKET_NAME=nearprice-uploads AWS_REGION=ap-northeast-2 \
 *     node scripts/resize-existing-uploads.mjs [--dry-run] [--threshold-kb=500]
 *
 * 안전장치:
 *   - --dry-run: 실제 PUT 안 함, 어떤 객체가 처리될지만 출력
 *   - 변환 실패 객체는 SKIP하고 계속 진행 (원본 보존)
 *   - 결과 < 원본 일 때만 덮어씀 (역효과 방지)
 *   - 동시성 제한 (CONCURRENCY=4)
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import sharp from 'sharp';

const PREFIX = 'uploads/';
const IMAGE_MAX_DIMENSION = 1200;
const IMAGE_JPEG_QUALITY = 82;
const CONCURRENCY = 4;

const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const thresholdArg = args.find((a) => a.startsWith('--threshold-kb='));
const SIZE_THRESHOLD_BYTES =
  (thresholdArg ? parseInt(thresholdArg.split('=')[1], 10) : 500) * 1024;

const bucket = process.env.S3_BUCKET_NAME;
const region = process.env.AWS_REGION ?? 'ap-northeast-2';

if (!bucket) {
  console.error('환경변수 S3_BUCKET_NAME 이 필요합니다.');
  process.exit(1);
}

const s3 = new S3Client({ region });

const streamToBuffer = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });

const listAllObjects = async () => {
  const all = [];
  let token;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: PREFIX,
        ContinuationToken: token,
      }),
    );
    if (res.Contents) all.push(...res.Contents);
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return all;
};

const JPEG_EXTENSIONS = new Set(['.jpg', '.jpeg']);

const getKeyExt = (key) => {
  const dot = key.lastIndexOf('.');
  return dot >= 0 ? key.slice(dot).toLowerCase() : '';
};

const processOne = async (obj) => {
  const key = obj.Key;
  const sizeBefore = obj.Size ?? 0;

  if (sizeBefore < SIZE_THRESHOLD_BYTES) {
    return { key, status: 'skip-small', sizeBefore };
  }

  // QA: 덮어쓰기 시 ContentType=image/jpeg와 키 확장자 mismatch 방지.
  // .png/.webp 등 비-jpeg 키는 사용자가 다시 업로드하도록 두고 여기선 스킵.
  // (앱은 새 업로드부터 sharp 변환 거친 .jpg 키만 생성)
  const ext = getKeyExt(key);
  if (!JPEG_EXTENSIONS.has(ext)) {
    return { key, status: 'skip-non-jpeg', sizeBefore };
  }

  try {
    const got = await s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key }),
    );
    const original = await streamToBuffer(got.Body);

    const resized = await sharp(original)
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

    if (resized.length >= original.length) {
      return {
        key,
        status: 'skip-no-gain',
        sizeBefore,
        sizeAfter: resized.length,
      };
    }

    if (isDryRun) {
      return {
        key,
        status: 'dry-run',
        sizeBefore,
        sizeAfter: resized.length,
      };
    }

    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: resized,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000, immutable',
      }),
    );

    return {
      key,
      status: 'resized',
      sizeBefore,
      sizeAfter: resized.length,
    };
  } catch (err) {
    return { key, status: 'error', sizeBefore, error: err.message };
  }
};

const runWithConcurrency = async (items, worker) => {
  const results = [];
  let i = 0;
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (i < items.length) {
      const idx = i++;
      const r = await worker(items[idx]);
      results[idx] = r;
      const tag = r.status === 'resized' || r.status === 'dry-run' ? '✓' : '·';
      const before = r.sizeBefore ? `${(r.sizeBefore / 1024).toFixed(0)}KB` : '?';
      const after = r.sizeAfter
        ? ` → ${(r.sizeAfter / 1024).toFixed(0)}KB`
        : '';
      console.log(`${tag} [${r.status}] ${r.key}  ${before}${after}`);
    }
  });
  await Promise.all(workers);
  return results;
};

const fmtBytes = (n) =>
  n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(2)} MB`
    : `${(n / 1024).toFixed(0)} KB`;

(async () => {
  console.log(`[resize-existing-uploads]`);
  console.log(`  bucket=${bucket} region=${region}`);
  console.log(`  threshold=${SIZE_THRESHOLD_BYTES / 1024}KB  dryRun=${isDryRun}`);
  console.log('');

  const objects = await listAllObjects();
  const eligible = objects.filter((o) => (o.Size ?? 0) >= SIZE_THRESHOLD_BYTES);

  console.log(`총 객체 수: ${objects.length}`);
  console.log(`임계치 초과 (변환 후보): ${eligible.length}`);
  console.log('');

  const results = await runWithConcurrency(objects, processOne);

  const stats = {
    resized: 0,
    skipSmall: 0,
    skipNoGain: 0,
    skipNonJpeg: 0,
    error: 0,
    dryRun: 0,
    bytesBefore: 0,
    bytesAfter: 0,
  };
  for (const r of results) {
    if (r.status === 'resized') {
      stats.resized++;
      stats.bytesBefore += r.sizeBefore;
      stats.bytesAfter += r.sizeAfter;
    } else if (r.status === 'dry-run') {
      stats.dryRun++;
      stats.bytesBefore += r.sizeBefore;
      stats.bytesAfter += r.sizeAfter;
    } else if (r.status === 'skip-small') stats.skipSmall++;
    else if (r.status === 'skip-no-gain') stats.skipNoGain++;
    else if (r.status === 'skip-non-jpeg') stats.skipNonJpeg++;
    else if (r.status === 'error') stats.error++;
  }

  console.log('');
  console.log('--- 요약 ---');
  console.log(`처리됨(resized): ${stats.resized}`);
  console.log(`드라이런(dry-run): ${stats.dryRun}`);
  console.log(`스킵(임계치 미만): ${stats.skipSmall}`);
  console.log(`스킵(압축 후 더 큼): ${stats.skipNoGain}`);
  console.log(`스킵(비-JPEG 확장자): ${stats.skipNonJpeg}`);
  console.log(`에러: ${stats.error}`);
  if (stats.bytesBefore > 0) {
    const saved = stats.bytesBefore - stats.bytesAfter;
    const ratio = (1 - stats.bytesAfter / stats.bytesBefore) * 100;
    console.log(
      `용량: ${fmtBytes(stats.bytesBefore)} → ${fmtBytes(stats.bytesAfter)} ` +
        `(${ratio.toFixed(1)}% 감소, ${fmtBytes(saved)} 절약)`,
    );
  }

  if (stats.error > 0) {
    console.log('');
    console.log('--- 에러 목록 ---');
    for (const r of results.filter((x) => x.status === 'error')) {
      console.log(`  ${r.key}: ${r.error}`);
    }
    process.exit(1);
  }
})().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
