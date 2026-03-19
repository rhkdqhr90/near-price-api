#!/usr/bin/env node
/**
 * Usage: node scripts/generate-admin-hash.mjs <password>
 * Outputs the ADMIN_PASSWORD_HASH value to set in .env
 */
import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

const password = process.argv[2];
if (!password) {
  console.error('Usage: node scripts/generate-admin-hash.mjs <password>');
  process.exit(1);
}

const salt = randomBytes(16).toString('hex');
const hash = (await scryptAsync(password, salt, 64)).toString('hex');
console.log(`ADMIN_PASSWORD_HASH=${salt}:${hash}`);
