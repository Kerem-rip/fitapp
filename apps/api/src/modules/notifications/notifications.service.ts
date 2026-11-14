// Bildirimler: veritabanında tür + veri olarak durur; burada kullanıcının okuyacağı Türkçe metne çevrilir.
// Metinlere sağlık verisi yazılmaz (bildirimler kilit ekranında görünebilir).
import { Inject, Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service.js';

type Data = Record<string, string | number | undefined>;

const when = (iso: unknown) =>
  typeof iso === 'string'
    ? new Date(iso).toLocaleString('tr-TR', { timeZone: 'Europe/Istanbul', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })
    : '';

function describe(type: string, d: Data, name: (id: unknown) => string): { title: string; text: string } {
  switch (type) {
    case 'client_offer':
      return { title: 'Danışanlık teklifi', text: `${name(d.professionalId)} seni danışanı olarak eklemek istiyor.` };
    case 'client_accepted':
      return { title: 'Teklif kabul edildi', text: `${name(d.clientId)} danışanlık teklifini kabul etti.` };
    case 'client_declined':
      return { title: 'Teklif yanıtlandı', text: 'Bir danışanlık teklifin kabul edilmedi.' };
    case 'relationship_ended':
      return { title: 'Danışanlık sona erdi', text: 'Bir danışanlık sona erdi; veri erişimi kapandı.' };
    case 'application_approved':
      return { title: 'Başvurun onaylandı', text: 'Profesyonel hesabın açıldı.' };
    case 'application_rejected':
      return { title: 'Başvurun onaylanmadı', text: typeof d.reason === 'string' ? d.reason : 'Ayrıntılar başvuru ekranında.' };
    case 'plan_published':
      return { title: 'Beslenme planın güncellendi', text: `Diyetisyenin planının ${d.number}. sürümünü yayınladı.` };
    case 'gym_invite':
      return {
        title: 'Salon ekibine davet',
        text: `${String(d.gymName ?? 'Bir salon')} seni ${d.role === 'RECEPTION' ? 'resepsiyon görevlisi' : 'eğitmen'} olarak ekibine davet etti.`,
      };
    case 'gym_invite_accepted':
      return { title: 'Ekibine yeni biri katıldı', text: `${name(d.clientId)} salon davetini kabul etti.` };
    case 'gym_staff_ended':
      return { title: 'Salon ekibinden çıkarıldın', text: `${String(d.gymName ?? 'Salon')} ekibindeki görevin sona erdi.` };
    case 'gym_task_assigned':
      return { title: 'Yeni görev', text: `${String(d.gymName ?? 'Salon')} yöneticisi sana bir görev verdi.` };
    case 'program_published':
      return { title: 'Antrenman programın güncellendi', text: `Antrenörün programının ${d.number}. sürümünü yayınladı.` };
    case 'appointment_created':
      return { title: 'Yeni randevu', text: `${name(d.professionalId)} ile ${when(d.startsAt)}.` };
    case 'appointment_updated':
      return { title: 'Randevun güncellendi', text: `${name(d.professionalId)} ile yeni zaman: ${when(d.startsAt)}.` };
    case 'appointment_cancelled':
      return { title: 'Randevu iptal edildi', text: `${name(d.professionalId)} ile ${when(d.startsAt)} randevusu iptal edildi.` };
    case 'appointment_cancelled_by_client':
      return { title: 'Danışan randevuyu iptal etti', text: `${name(d.clientId)} · ${when(d.startsAt)}` };
    case 'appointment_reminder':
      return { title: 'Yaklaşan randevu', text: `${name(d.professionalId)} ile ${when(d.startsAt)}.` };
    case 'reminder':
      return { title: `${name(d.professionalId)} hatırlatıyor`, text: typeof d.text === 'string' ? d.text : '' };
    // ── Sosyal bildirimler (actorId: eylemi yapan kişi) ──
    case 'social_follow':
      return { title: 'Yeni takipçi', text: `${name(d.actorId)} seni takip etmeye başladı.` };
    case 'social_follow_request':
      return { title: 'Takip isteği', text: `${name(d.actorId)} seni takip etmek istiyor.` };
    case 'social_follow_accepted':
      return { title: 'Takip isteğin kabul edildi', text: `${name(d.actorId)} artık takibinde.` };
    case 'social_like':
      return { title: 'Beğeni', text: `${name(d.actorId)} gönderini beğendi.` };
    case 'social_comment':
      return { title: 'Yorum', text: `${name(d.actorId)} gönderine yorum yaptı.` };
    case 'social_reply':
      return { title: 'Yanıt', text: `${name(d.actorId)} yorumuna yanıt verdi.` };
    case 'social_mention':
      return { title: 'Bahsetme', text: `${name(d.actorId)} senden bahsetti.` };
    case 'social_story_mention':
      return { title: 'Hikâyede bahsetme', text: `${name(d.actorId)} hikâyesinde senden bahsetti.` };
    case 'social_story_reaction':
      return { title: 'Hikâyene tepki', text: `${name(d.actorId)} hikâyene ${typeof d.emoji === 'string' ? d.emoji : ''} tepkisi verdi.` };
    case 'social_story_answer':
      return { title: 'Hikâyene yanıt', text: `${name(d.actorId)} sorunu yanıtladı.` };
    case 'moderation_removed':
      return { title: 'Bir içeriğin kaldırıldı', text: 'Topluluk kurallarına aykırı bulundu. Bir kez itiraz edebilirsin.' };
    case 'moderation_restored':
      return { title: 'İçeriğin geri getirildi', text: 'İtirazın kabul edildi.' };
    case 'appeal_rejected':
      return { title: 'İtirazın sonuçlandı', text: 'İnceleme sonucunda içerik kaldırılmış olarak kaldı.' };
    default:
      return { title: 'Bildirim', text: '' };
  }
}

export type Center = 'SOCIAL' | 'PRO';

export interface PreferencesInput {
  likes?: boolean;
  comments?: boolean;
  follows?: boolean;
  mentions?: boolean;
  stories?: boolean;
  messages?: boolean;
  pushEnabled?: boolean;
  quietFrom?: number | null;
  quietTo?: number | null;
}

const DEFAULT_PREFS = { likes: true, comments: true, follows: true, mentions: true, stories: true, messages: true, pushEnabled: false, quietFrom: null as number | null, quietTo: null as number | null };

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string, limit: number, center?: Center) {
    const rows = await this.prisma.notification.findMany({ where: { userId, ...(center ? { center } : {}) }, orderBy: { createdAt: 'desc' }, take: limit });
    const ids = new Set<string>();
    for (const r of rows) {
      const d = r.data as Data;
      for (const key of ['professionalId', 'clientId'] as const) if (typeof d[key] === 'string') ids.add(d[key] as string);
      if (r.actorId) ids.add(r.actorId);
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, firstName: true, lastName: true, username: true, profile: { select: { displayName: true } } } });
    const name = (id: unknown) => {
      const u = users.find((x) => x.id === id);
      return u ? u.profile?.displayName?.trim() || [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username : 'Biri';
    };
    const proName = (id: unknown) => (users.some((x) => x.id === id) ? name(id) : 'Uzmanın');
    return rows.map((r) => {
      const d = r.data as Data;
      const social = r.center === 'SOCIAL';
      return {
        id: r.id,
        type: r.type,
        center: r.center as Center,
        ...describe(r.type, { ...d, actorId: r.actorId ?? undefined }, social ? name : proName),
        read: r.readAt !== null,
        createdAt: r.createdAt,
        // Dokununca gidilecek yer
        actorUsername: r.actorId ? (users.find((x) => x.id === r.actorId)?.username ?? null) : null,
        postId: typeof d.postId === 'string' ? d.postId : null,
        storyId: typeof d.storyId === 'string' ? d.storyId : null,
      };
    });
  }

  unreadCount(userId: string, center?: Center) {
    return this.prisma.notification.count({ where: { userId, readAt: null, ...(center ? { center } : {}) } });
  }

  async counts(userId: string) {
    const [social, pro] = await Promise.all([this.unreadCount(userId, 'SOCIAL'), this.unreadCount(userId, 'PRO')]);
    return { social, pro, total: social + pro };
  }

  async markRead(userId: string, ids?: string[], center?: Center) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}), ...(center ? { center } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }

  // ───── Tercihler ve cihazlar ─────

  async preferences(userId: string) {
    const p = await this.prisma.notificationPreference.findUnique({ where: { userId } });
    if (!p) return DEFAULT_PREFS;
    const { userId: _owner, ...prefs } = p;
    return prefs;
  }

  async setPreferences(userId: string, input: PreferencesInput) {
    await this.prisma.notificationPreference.upsert({ where: { userId }, create: { userId, ...input }, update: input });
    return this.preferences(userId);
  }

  // Cihaz kaydı: aynı cihaz başka hesaba geçtiyse yeni hesaba bağlanır
  async registerDevice(userId: string, token: string, platform: string) {
    await this.prisma.pushDevice.upsert({ where: { token }, create: { userId, token, platform }, update: { userId, platform } });
    return { registered: true };
  }

  async removeDevice(userId: string, token: string) {
    await this.prisma.pushDevice.deleteMany({ where: { userId, token } });
    return { registered: false };
  }
}