// Sosyal medya dosyaları (profil fotoğrafı; sonraki aşamalarda gönderi, hikâye ve mesaj medyası).
// - Tür dosyanın ilk baytlarından belirlenir, gizli bilgiler (EXIF/GPS) sunucuda çıkarılır, boyut sınırlıdır.
// - Dosyalar gizli depoda durur. Görüntüleme adresi süreli ve imzalıdır: adresi sadece görmeye yetkili kişiye
//   verilir (gizli hesabın içeriği gibi), süresi dolunca geçersizdir. Başvuru belgeleri bu yoldan asla sunulmaz.
import { Inject, Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { badRequest, notFound, tooLarge } from '../../common/app-error.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { env } from '../../config/env.js';
import type { UploadedFileLike } from '../files/documents.service.js';
import { StorageService } from '../files/storage.service.js';
import { detectImage, sanitizeImage } from './image-sanitize.js';
import { detectVideo, sanitizeVideo } from './video-inspect.js';

export type MediaPurpose = 'AVATAR' | 'POST' | 'STORY' | 'MESSAGE' | 'GROUP';
const PURPOSES: readonly string[] = ['AVATAR', 'POST', 'STORY', 'MESSAGE', 'GROUP'];

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
// Gönderi ve hikâye videoları en fazla 30 saniye
export const MAX_VIDEO_MS = 30_000;
// Sesli mesaj en fazla 2 dakika
export const MAX_VOICE_MS = 120_000;
export const MAX_VOICE_BYTES = 10 * 1024 * 1024;
// İmzalı adres en az 6, en fazla 12 saat geçerlidir (6 saatlik dilimlere yuvarlanır; aynı dilimde adres değişmez, önbellek çalışır)
const URL_WINDOW_SEC = 6 * 60 * 60;

@Injectable()
export class MediaService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(StorageService) private readonly storage: StorageService,
  ) {}

  private sign(fileId: string, exp: number) {
    return createHmac('sha256', env.jwtSecret).update(`media:${fileId}:${exp}`).digest('base64url');
  }

  // Görüntüleme adresi (API köküne göre). Yetki kontrolü bu adresi üreten tarafta yapılmış olmalıdır.
  url(fileId: string): string;
  url(fileId: string | null | undefined): string | null;
  url(fileId: string | null | undefined): string | null {
    if (!fileId) return null;
    const now = Math.floor(Date.now() / 1000);
    const exp = (Math.floor(now / URL_WINDOW_SEC) + 2) * URL_WINDOW_SEC;
    return `/media/${fileId}?e=${exp}&s=${this.sign(fileId, exp)}`;
  }

  async saveImage(ownerId: string, file: UploadedFileLike | undefined, purpose: MediaPurpose) {
    if (!file || file.buffer.length === 0) throw badRequest('FILE_REQUIRED', 'Bir fotoğraf seç.');
    if (file.buffer.length > MAX_IMAGE_BYTES) throw tooLarge('FILE_TOO_LARGE', 'Fotoğraf en fazla 8 MB olabilir.');
    const clean = sanitizeImage(file.buffer);
    if (!clean) throw badRequest('INVALID_FILE_TYPE', 'Sadece JPG veya PNG fotoğraf yükleyebilirsin.');
    const storageKey = await this.storage.save(clean.data);
    return this.prisma.file.create({
      data: { ownerId, storageKey, mimeType: clean.mime, sizeBytes: clean.data.length, isPrivate: true, purpose },
      select: { id: true, mimeType: true, sizeBytes: true },
    });
  }

  // Video (MP4/MOV, en fazla 30 sn ve 50 MB). Konum/cihaz bilgisi kutuları etkisizleştirilir.
  async saveVideo(ownerId: string, file: UploadedFileLike | undefined, purpose: MediaPurpose) {
    if (!file || file.buffer.length === 0) throw badRequest('FILE_REQUIRED', 'Bir video seç.');
    if (file.buffer.length > MAX_VIDEO_BYTES) throw tooLarge('FILE_TOO_LARGE', 'Video en fazla 50 MB olabilir.');
    const clean = sanitizeVideo(file.buffer);
    if (!clean || clean.info.mime === 'audio/mp4') throw badRequest('INVALID_FILE_TYPE', 'Sadece MP4 veya MOV video yükleyebilirsin.');
    if (clean.info.durationMs > MAX_VIDEO_MS + 500) throw badRequest('VIDEO_TOO_LONG', 'Video en fazla 30 saniye olabilir.');
    const storageKey = await this.storage.save(clean.data);
    const saved = await this.prisma.file.create({
      data: { ownerId, storageKey, mimeType: clean.info.mime, sizeBytes: clean.data.length, isPrivate: true, purpose },
      select: { id: true, mimeType: true, sizeBytes: true },
    });
    return { ...saved, durationMs: clean.info.durationMs };
  }

  // Sesli mesaj (M4A, en fazla 2 dakika)
  async saveVoice(ownerId: string, file: UploadedFileLike | undefined) {
    if (!file || file.buffer.length === 0) throw badRequest('FILE_REQUIRED', 'Ses kaydı bulunamadı.');
    if (file.buffer.length > MAX_VOICE_BYTES) throw tooLarge('FILE_TOO_LARGE', 'Ses kaydı en fazla 10 MB olabilir.');
    const clean = sanitizeVideo(file.buffer);
    if (!clean || clean.info.mime !== 'audio/mp4') throw badRequest('INVALID_FILE_TYPE', 'Ses kaydı M4A biçiminde olmalı.');
    if (clean.info.durationMs > MAX_VOICE_MS + 500) throw badRequest('VOICE_TOO_LONG', 'Sesli mesaj en fazla 2 dakika olabilir.');
    const storageKey = await this.storage.save(clean.data);
    const saved = await this.prisma.file.create({
      data: { ownerId, storageKey, mimeType: 'audio/mp4', sizeBytes: clean.data.length, isPrivate: true, purpose: 'MESSAGE' },
      select: { id: true, mimeType: true, sizeBytes: true },
    });
    return { ...saved, durationMs: clean.info.durationMs };
  }
  // Fotoğraf ya da video: tür dosyanın ilk baytlarından anlaşılır
  async saveMedia(ownerId: string, file: UploadedFileLike | undefined, purpose: MediaPurpose) {
    const detected = file ? detectVideo(file.buffer) : null;
    if (detected === 'audio/mp4' && purpose === 'MESSAGE') return { ...(await this.saveVoice(ownerId, file)), kind: 'VOICE' as const };
    if (detected) return { ...(await this.saveVideo(ownerId, file, purpose)), kind: 'VIDEO' as const };
    if (file && !detectImage(file.buffer) && file.buffer.length > MAX_IMAGE_BYTES) throw badRequest('INVALID_FILE_TYPE', 'Sadece JPG/PNG fotoğraf ya da MP4/MOV video yükleyebilirsin.');
    return { ...(await this.saveImage(ownerId, file, purpose)), kind: 'IMAGE' as const, durationMs: null };
  }

  // Kayıtlı videonun süresi (gönderiye eklenirken)
  async videoDuration(fileId: string): Promise<number | null> {
    const file = await this.prisma.file.findUnique({ where: { id: fileId }, select: { storageKey: true, mimeType: true } });
    if (!file || !(file.mimeType.startsWith('video/') || file.mimeType.startsWith('audio/'))) return null;
    return sanitizeVideo(await this.storage.read(file.storageKey))?.info.durationMs ?? null;
  }

  // Dosya kaydı ve depodaki dosya silinir (sahibi kontrol edilerek)

  async remove(ownerId: string, fileId: string) {
    const file = await this.prisma.file.findFirst({ where: { id: fileId, ownerId, purpose: { in: [...PURPOSES] } }, select: { id: true, storageKey: true } });
    if (!file) return;
    await this.prisma.file.delete({ where: { id: file.id } });
    await this.storage.remove(file.storageKey);
  }

  // İmzalı adresle dosyayı okur. Sadece sosyal medya dosyaları sunulur.
  async read(fileId: string, exp: string | undefined, sig: string | undefined) {
    const e = Number(exp);
    if (!sig || !Number.isInteger(e) || e < Math.floor(Date.now() / 1000)) throw notFound('MEDIA_NOT_FOUND', 'Dosya bulunamadı.');
    const expected = Buffer.from(this.sign(fileId, e));
    const actual = Buffer.from(sig);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw notFound('MEDIA_NOT_FOUND', 'Dosya bulunamadı.');
    const file = await this.prisma.file.findUnique({ where: { id: fileId }, select: { storageKey: true, mimeType: true, purpose: true } });
    if (!file || !file.purpose || !PURPOSES.includes(file.purpose)) throw notFound('MEDIA_NOT_FOUND', 'Dosya bulunamadı.');
    return { mime: file.mimeType, data: await this.storage.read(file.storageKey), expiresAt: e };
  }
}
