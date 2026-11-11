// İnceleme özeti için Türkçe etiketler ve küçük yardımcılar.
import type { FindingDecision, FindingEvent, FindingLevel } from '@fitapp/api-client';

export const LEVEL_TITLES: Record<FindingLevel, string> = {
  RED: 'İncelenmesi gerekenler',
  YELLOW: 'Doğrulanacaklar ve sorulacaklar',
  GREEN: 'Değerlendirilebilecekler',
};

export const LEVEL_TAGS: Record<FindingLevel, { label: string; kind: 'danger' | 'warning' | 'success' }> = {
  RED: { label: 'Kırmızı', kind: 'danger' },
  YELLOW: { label: 'Sarı', kind: 'warning' },
  GREEN: { label: 'Yeşil', kind: 'success' },
};

export const DECISION_LABELS: Record<FindingDecision, string> = {
  EVALUATED: 'Değerlendirdim',
  NOT_APPLICABLE: 'Bu danışan için geçerli değil',
  CLIENT_INFORMED: 'Danışanla konuştum',
  OTHER: 'Diğer',
};

export const DECISION_ORDER: FindingDecision[] = ['EVALUATED', 'CLIENT_INFORMED', 'NOT_APPLICABLE', 'OTHER'];

const EVENT_LABELS: Record<FindingEvent['kind'], string> = {
  NOTE: 'Not',
  CLOSED: 'Kapatıldı',
  REOPENED: 'Yeniden açıldı',
  TASK_CREATED: 'Takip görevi',
  TASK_DONE: 'Görev tamamlandı',
  SUPERSEDED: 'Güncellendi',
};

export function eventText(event: FindingEvent): string {
  const label = EVENT_LABELS[event.kind];
  if (event.kind === 'CLOSED' && event.text) {
    const [decision, ...rest] = event.text.split(': ');
    const known = DECISION_LABELS[decision as FindingDecision];
    return known ? `${label} · ${known}: ${rest.join(': ')}` : `${label}: ${event.text}`;
  }
  return event.text ? `${label}: ${event.text}` : label;
}

// "12.03.2026" → ISO (bugün ya da ileri bir tarih); boşsa undefined; geçersiz/geçmişse null
export function parseDueInput(text: string): string | undefined | null {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const m = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(trimmed);
  if (!m) return null;
  const date = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), 12));
  const valid = date.getUTCFullYear() === Number(m[3]) && date.getUTCMonth() === Number(m[2]) - 1 && date.getUTCDate() === Number(m[1]);
  const startOfToday = new Date();
  startOfToday.setUTCHours(0, 0, 0, 0);
  if (!valid || date.getTime() < startOfToday.getTime()) return null;
  return date.toISOString();
}

// Vade durumu: "Gecikti", "Bugün", "12 Kasım" ya da vadesiz
export function dueLabel(iso: string | null): { text: string; overdue: boolean; today: boolean } {
  if (!iso) return { text: 'Vadesiz', overdue: false, today: false };
  const due = new Date(iso);
  const now = new Date();
  const dayKey = (d: Date) => d.toISOString().slice(0, 10);
  const same = dayKey(due) === dayKey(now);
  const overdue = !same && due.getTime() < now.getTime();
  return {
    text: same ? 'Bugün' : overdue ? 'Gecikti' : due.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }),
    overdue,
    today: same,
  };
}
