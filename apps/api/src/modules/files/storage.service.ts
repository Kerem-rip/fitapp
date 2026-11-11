// Yüklenen belgelerin diskteki gizli deposu. Dosyalar rastgele adla saklanır, adresle erişilemez;
// sadece yetkili uç noktalar (yönetici) okuyabilir. Yayında şifreli nesne depolamaya taşınır.
import { Injectable } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { env } from '../../config/env.js';

const KEY_PATTERN = /^[a-f0-9]{32}$/;

@Injectable()
export class StorageService {
  private readonly root = resolve(env.storageDir);

  private pathOf(key: string): string {
    // Klasör dışına çıkmayı (../) engeller
    if (!KEY_PATTERN.test(key)) throw new Error('Geçersiz depolama anahtarı');
    return join(this.root, key.slice(0, 2), key);
  }

  async save(data: Buffer): Promise<string> {
    const key = randomBytes(16).toString('hex');
    const path = this.pathOf(key);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, data, { mode: 0o600 });
    return key;
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.pathOf(key));
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathOf(key), { force: true });
  }
}
