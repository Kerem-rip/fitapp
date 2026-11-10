// Şifreler veritabanında asla açık saklanmaz; scrypt ile tek yönlü karılır.
import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>;

const N = 2 ** 15;
const R = 8;
const P = 1;
const KEY_LENGTH = 32;
const MAX_MEM = 64 * 1024 * 1024;

@Injectable()
export class PasswordService {
  // Biçim: scrypt$N$r$p$tuz$özet
  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, KEY_LENGTH, {
      N,
      r: R,
      p: P,
      maxmem: MAX_MEM,
    });
    return `scrypt$${N}$${R}$${P}$${salt.toString('base64')}$${key.toString('base64')}`;
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, n, r, p, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await scryptAsync(
      password,
      Buffer.from(salt, 'base64'),
      expected.length,
      { N: Number(n), r: Number(r), p: Number(p), maxmem: MAX_MEM },
    );
    return timingSafeEqual(actual, expected);
  }
}
