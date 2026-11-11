// Demo verisinden türetilen okuma işlemleri (saf fonksiyonlar).
import { ageOn, findFood, type Allergen, type MealSlot } from '@fitapp/shared';
import { dateKey } from './dates';
import type {
  ClientLink,
  ClientRecord,
  Conversation,
  DemoAccount,
  DemoState,
  MealEntry,
  Party,
  ProProfile,
  UserData,
} from './types';
import { SEED_PROS } from './seed';

export const fullName = (a: DemoAccount) => `${a.firstName} ${a.lastName}`;

export function accountById(state: DemoState, id: string): DemoAccount | undefined {
  return state.accounts.find((a) => a.id === id);
}

export function proById(id: string): ProProfile | undefined {
  return SEED_PROS.find((p) => p.id === id);
}

export function proByAccount(accountId: string): ProProfile | undefined {
  return SEED_PROS.find((p) => p.accountId === accountId);
}

// ───────────── Beslenme ─────────────

export interface DayTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export function totalsOf(entries: readonly MealEntry[]): DayTotals {
  const totals: DayTotals = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 };
  for (const entry of entries) {
    const food = findFood(entry.foodId);
    if (!food) continue;
    totals.kcal += food.kcal * entry.servings;
    totals.proteinG += food.proteinG * entry.servings;
    totals.carbsG += food.carbsG * entry.servings;
    totals.fatG += food.fatG * entry.servings;
  }
  return {
    kcal: Math.round(totals.kcal),
    proteinG: Math.round(totals.proteinG),
    carbsG: Math.round(totals.carbsG),
    fatG: Math.round(totals.fatG),
  };
}

export function mealsBySlot(entries: readonly MealEntry[]): Record<MealSlot, MealEntry[]> {
  const result: Record<MealSlot, MealEntry[]> = { breakfast: [], lunch: [], snack: [], dinner: [] };
  for (const entry of entries) result[entry.slot].push(entry);
  return result;
}

// ───────────── Danışanlar ─────────────

export interface ClientView extends Omit<ClientRecord, 'allergens'> {
  allergens: Allergen[] | null;
  accountLinked: boolean;
}

// Danışan bir demo hesabına bağlıysa, hesabın güncel verisi esas alınır.
// Danışanın paylaşmadığı veriler görünmez.
export function clientView(state: DemoState, clientId: string): ClientView | undefined {
  const record = state.shared.clients[clientId];
  if (!record) return undefined;
  const account = record.accountId ? accountById(state, record.accountId) : undefined;
  const data = record.accountId ? state.userData[record.accountId] : undefined;
  if (!account || !data) return { ...record, accountLinked: false };

  const today = dateKey(0);
  const lastMealDay = Object.keys(data.meals).filter((d) => (data.meals[d]?.length ?? 0) > 0).sort().pop();
  const lastWeight = data.weights[data.weights.length - 1]?.date;
  const lastDay = [lastMealDay, lastWeight].filter(Boolean).sort().pop();
  const lastEntryDaysAgo = lastDay
    ? Math.max(0, Math.round((new Date(today).getTime() - new Date(lastDay).getTime()) / 86400000))
    : 30;

  const mealsToday = (data.meals[today] ?? []).flatMap((entry) => {
    const food = findFood(entry.foodId);
    return food ? [{ slot: entry.slot, name: food.name, kcal: Math.round(food.kcal * entry.servings) }] : [];
  });

  return {
    ...record,
    accountLinked: true,
    name: fullName(account),
    ageYears: ageOn(new Date(account.birthDate)),
    sex: account.sex,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    goal: data.goal,
    activity: data.activity,
    allergens: data.allergens,
    diet: data.diet,
    weights: data.weights,
    lastEntryDaysAgo,
    sharing: data.sharing,
    mealsToday: data.sharing.meals ? mealsToday : [],
  };
}

export function activeLinksOf(state: DemoState, proAccountId: string): ClientLink[] {
  return state.shared.clientLinks.filter((l) => l.proId === proAccountId && l.status === 'active');
}

// Kullanıcının, bu uzmanın aktif danışanı olup olmadığı
export function activeLinkBetween(state: DemoState, userAccountId: string, proAccountId: string): ClientLink | undefined {
  return state.shared.clientLinks.find((l) => {
    if (l.proId !== proAccountId || l.status !== 'active') return false;
    return state.shared.clients[l.clientId]?.accountId === userAccountId;
  });
}

// ───────────── Mesajlar ─────────────

export function otherParty(conversation: Conversation, viewerId: string): Party {
  return conversation.a.id === viewerId ? conversation.b : conversation.a;
}

export function lastMessage(conversation: Conversation) {
  return conversation.messages[conversation.messages.length - 1];
}

export function unreadCount(conversation: Conversation, viewerId: string): number {
  const readAt = conversation.reads[viewerId];
  return conversation.messages.filter(
    (m) => m.fromId !== viewerId && (!readAt || new Date(m.at).getTime() > new Date(readAt).getTime()),
  ).length;
}

export function conversationsOf(state: DemoState, viewerId: string): Conversation[] {
  return state.shared.conversations
    .filter((c) => c.a.id === viewerId || c.b.id === viewerId)
    .sort((x, y) => new Date(lastMessage(y)?.at ?? 0).getTime() - new Date(lastMessage(x)?.at ?? 0).getTime());
}

// Konuşan kişi, bu uzmanın danışanı mı? (danışan kaydının kimliği ya da hesap kimliği ile eşleşir)
export function isClientParty(state: DemoState, proAccountId: string, partyId: string): boolean {
  return activeLinksOf(state, proAccountId).some(
    (l) => l.clientId === partyId || state.shared.clients[l.clientId]?.accountId === partyId,
  );
}

export function unreadTotal(state: DemoState, viewerId: string): number {
  return conversationsOf(state, viewerId).reduce((sum, c) => sum + unreadCount(c, viewerId), 0);
}

export function unreadNotifications(state: DemoState, accountId: string): number {
  return state.shared.notifications.filter((n) => n.toAccountId === accountId && !n.read).length;
}

// ───────────── Programlar ─────────────

export function programProgress(data: UserData, programId: string, totalDays: number) {
  const enrollment = data.enrollments[programId];
  const done = enrollment?.completedDays.length ?? 0;
  return { enrolled: Boolean(enrollment), done, total: totalDays };
}
