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
    default:
      return { title: 'Bildirim', text: '' };
  }
}

@Injectable()
export class NotificationsService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async list(userId: string, limit: number) {
    const rows = await this.prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
    const ids = new Set<string>();
    for (const r of rows) {
      const d = r.data as Data;
      for (const key of ['professionalId', 'clientId'] as const) if (typeof d[key] === 'string') ids.add(d[key] as string);
    }
    const users = await this.prisma.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, firstName: true, lastName: true, username: true } });
    const name = (id: unknown) => {
      const u = users.find((x) => x.id === id);
      return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username : 'Uzmanın';
    };
    return rows.map((r) => ({ id: r.id, type: r.type, ...describe(r.type, r.data as Data, name), read: r.readAt !== null, createdAt: r.createdAt }));
  }

  unreadCount(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(userId: string, ids?: string[]) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null, ...(ids ? { id: { in: ids } } : {}) },
      data: { readAt: new Date() },
    });
    return { updated: result.count };
  }
}
