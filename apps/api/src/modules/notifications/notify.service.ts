// Sosyal bildirim üretimi (takip, beğeni, yorum, bahsetme, hikâye, moderasyon).
// - Kendi eylemin, engellediğin ya da sessize aldığın kişinin eylemi bildirim üretmez.
// - Tercihlerde kapatılan tür üretilmez. Aynı kişinin aynı gönderiye beğenisi okunmadıysa tekrar yazılmaz.
// - Anlık bildirim (push) sadece kişi izin verdiyse, cihazı kayıtlıysa ve sessiz saatte değilse gönderilir;
//   metin kişi adı, içerik ve sağlık bilgisi taşımaz. Gönderim altyapısı (telefon bildirim servisi) henüz bağlı değildir.
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';
import { inQuietHours, lockScreenText, prefKeyOf, turkeyHour, type SocialType } from './notify-rules.js';

type Data = Record<string, string | number | undefined>;

@Injectable()
export class NotifyService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  // Hata bildirimi asıl işlemi bozmasın diye yutulur
  async social(userId: string, type: SocialType, actorId: string | null, data: Data = {}): Promise<void> {
    try {
      await this.create(userId, type, actorId, data);
    } catch {
      // bildirim yazılamadıysa işlem yine de tamamlanır
    }
  }

  private async create(userId: string, type: SocialType, actorId: string | null, data: Data) {
    if (actorId && actorId === userId) return;
    if (actorId) {
      const [blocked, muted] = await Promise.all([
        this.prisma.block.count({ where: { OR: [{ blockerId: userId, blockedId: actorId }, { blockerId: actorId, blockedId: userId }] } }),
        this.prisma.mute.count({ where: { muterId: userId, mutedId: actorId } }),
      ]);
      if (blocked > 0 || muted > 0) return;
    }
    const pref = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    const key = prefKeyOf(type);
    if (key && pref && pref[key] === false) return;
    // Beğeni ve tepki gibi tekrarlanabilen olaylar: okunmamış aynısı varsa yeniden yazılmaz
    if (actorId && (type === 'social_like' || type === 'social_story_reaction' || type === 'social_follow' || type === 'social_follow_request')) {
      const target = data.postId ?? data.storyId;
      const existing = await this.prisma.notification.findFirst({
        where: { userId, type, actorId, readAt: null, ...(target ? { data: { path: [data.postId ? 'postId' : 'storyId'], equals: target } } : {}) },
        select: { id: true },
      });
      if (existing) return;
    }
    await this.prisma.notification.create({ data: { userId, type, center: 'SOCIAL', actorId, data } });
    await this.push(userId, type, pref);
  }

  // Takip isteği geri çekilince ya da takip bırakılınca okunmamış bildirimi kaldır
  async retract(userId: string, types: SocialType[], actorId: string) {
    await this.prisma.notification.deleteMany({ where: { userId, actorId, type: { in: types }, readAt: null } }).catch(() => undefined);
  }

  private async push(userId: string, type: string, pref: { pushEnabled: boolean; quietFrom: number | null; quietTo: number | null } | null) {
    if (!pref?.pushEnabled) return;
    if (inQuietHours(turkeyHour(new Date()), pref.quietFrom, pref.quietTo)) return;
    const devices = await this.prisma.pushDevice.count({ where: { userId } });
    if (devices === 0) return;
    // Gönderilecek metin hazır; telefon bildirim servisi bağlanınca burada gönderilecek.
    void lockScreenText(type);
  }
}
