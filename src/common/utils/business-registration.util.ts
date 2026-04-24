import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

const parseEncryptionKey = (raw: string): Buffer => {
  const trimmed = raw.trim();

  const asBase64 = Buffer.from(trimmed, 'base64');
  if (asBase64.length === 32) {
    return asBase64;
  }

  const asUtf8 = Buffer.from(trimmed, 'utf8');
  if (asUtf8.length === 32) {
    return asUtf8;
  }

  throw new Error(
    '[OwnerApplication] BIZ_REG_ENCRYPTION_KEY must be 32-byte base64 or utf8 string',
  );
};

const getEncryptionKey = (): Buffer => {
  const raw = process.env.BIZ_REG_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('[OwnerApplication] BIZ_REG_ENCRYPTION_KEY is required');
  }
  return parseEncryptionKey(raw);
};

export const normalizeBusinessRegistrationNumber = (input: string): string => {
  return input.replace(/[^0-9]/g, '');
};

export const maskBusinessRegistrationNumber = (normalized: string): string => {
  if (!/^\d{10}$/.test(normalized)) {
    throw new Error('[OwnerApplication] invalid business registration number');
  }
  return `${normalized.slice(0, 3)}-**-${normalized.slice(5)}`;
};

export const encryptBusinessRegistrationNumber = (
  normalized: string,
): string => {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);

  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(normalized, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decryptBusinessRegistrationNumber = (payload: string): string => {
  const [ivHex, authTagHex, encryptedHex] = payload.split(':');
  if (!ivHex || !authTagHex || !encryptedHex) {
    throw new Error('[OwnerApplication] invalid encrypted payload format');
  }

  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
};
