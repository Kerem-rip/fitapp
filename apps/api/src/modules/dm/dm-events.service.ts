// Mesajlar için anlık bildirim: uzun bekleyen istek (long-polling). Ek paket ya da ücretli servis gerekmez.
// - Uygulama GET /social/dm/events?after=<sıra> ile bekler; yeni olay gelince cevap hemen döner, yoksa ~25 sn sonra boş döner.
// - Olaylar bellekte tutulur (kişi başı son 200). Sunucu yeniden başlarsa "boot" değişir; uygulama listeleri yeniden yükler.
// - Not: Sunucu birden çok kopya çalışırsa olaylar paylaşılmaz; o zaman ortak bir kuyruğa (ör. Redis) geçilmeli.
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

export type DmEvent =
  | { type: 'message'; conversationId: string; messageId: string }
  | { type: 'unsent'; conversationId: string; messageId: string }
  | { type: 'read'; conversationId: string; userId: string; at: string }
  | { type: 'delivered'; conversationId: string; userId: string; at: string }
  | { type: 'conversation'; conversationId: string };

type Stored = DmEvent & { seq: number };
type Waiter = { after: number; resolve: (events: Stored[]) => void; timer: ReturnType<typeof setTimeout> };

const KEEP = 200;
export const WAIT_MS = 25_000;

@Injectable()
export class DmEventsService implements OnModuleDestroy {
  readonly boot = randomBytes(6).toString('hex');
  private seq = 0;
  private readonly queues = new Map<string, Stored[]>();
  private readonly waiters = new Map<string, Set<Waiter>>();
  // Çevrimiçi bilgisi: son bekleme isteğinin zamanı
  private readonly seen = new Map<string, number>();

  emit(userIds: Iterable<string>, event: DmEvent) {
    for (const userId of new Set(userIds)) {
      const stored = { ...event, seq: ++this.seq };
      const q = this.queues.get(userId) ?? [];
      q.push(stored);
      if (q.length > KEEP) q.splice(0, q.length - KEEP);
      this.queues.set(userId, q);
      for (const w of this.waiters.get(userId) ?? []) {
        clearTimeout(w.timer);
        this.waiters.get(userId)!.delete(w);
        w.resolve(q.filter((e) => e.seq > w.after));
      }
    }
  }

  // `after`: uygulamanın gördüğü son sıra; farklı "boot"tan geliyorsa 0 kabul edilir
  wait(userId: string, after: number, waitMs = WAIT_MS): Promise<Stored[]> {
    this.seen.set(userId, Date.now());
    const pending = (this.queues.get(userId) ?? []).filter((e) => e.seq > after);
    if (pending.length || waitMs <= 0) return Promise.resolve(pending);
    return new Promise((resolve) => {
      const set = this.waiters.get(userId) ?? new Set<Waiter>();
      const w: Waiter = {
        after,
        resolve,
        timer: setTimeout(() => {
          set.delete(w);
          this.seen.set(userId, Date.now());
          resolve([]);
        }, waitMs),
      };
      set.add(w);
      this.waiters.set(userId, set);
    });
  }

  get currentSeq() {
    return this.seq;
  }

  // Son 2 dakikada bekleme isteği yapan kişi çevrimiçi sayılır
  isOnline(userId: string) {
    if ((this.waiters.get(userId)?.size ?? 0) > 0) return true;
    const t = this.seen.get(userId);
    return t !== undefined && Date.now() - t < 120_000;
  }

  onModuleDestroy() {
    for (const set of this.waiters.values()) for (const w of set) clearTimeout(w.timer);
    this.waiters.clear();
  }
}
