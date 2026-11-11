// Demo verisini değiştiren tüm işlemler. Gerçek sunucu bağlanınca bunlar API çağrılarına dönüşecek.
import {
  ageGroupOf,
  parseTrDate,
  validateEmail,
  validatePassword,
  validateUsername,
  type MealSlot,
  type Sex,
} from '@fitapp/shared';
import { dateKey, isoNow, newId } from './dates';
import { findExercise } from './content';
import { toGoal } from './labels';
import { accountById, activeLinkBetween } from './selectors';
import { newUserData } from './seed';
import { getState, resetDemo, setState } from './store';
import type {
  Appointment,
  ClientRecord,
  DemoAccount,
  DemoState,
  GymStaff,
  OnboardingAnswers,
  Party,
  Plan,
  Program,
  ProgramDay,
  SharedState,
  UserData,
} from './types';

const DELETION_GRACE_DAYS = 30;

// ───────────── Küçük yardımcılar ─────────────

function patchUser(accountId: string, fn: (data: UserData) => UserData) {
  setState((s) => {
    const data = s.userData[accountId];
    if (!data) return s;
    return { ...s, userData: { ...s.userData, [accountId]: fn(data) } };
  });
}

function patchShared(fn: (shared: SharedState) => SharedState) {
  setState((s) => ({ ...s, shared: fn(s.shared) }));
}

function notify(toAccountId: string, title: string, text: string) {
  patchShared((sh) => ({
    ...sh,
    notifications: [{ id: newId('nt'), toAccountId, title, text, at: isoNow(), read: false }, ...sh.notifications],
  }));
}

// ───────────── Hesap ─────────────

export type LoginResult =
  | { ok: true; account: DemoAccount; deletionCancelled: boolean }
  | { ok: false; error: string };

export function login(identifier: string, password: string): LoginResult {
  const id = identifier.trim().toLowerCase();
  const s = getState();
  const account = s.accounts.find((a) => a.email.toLowerCase() === id || a.username.toLowerCase() === id);
  if (!account || account.password !== password) {
    return { ok: false, error: 'E-posta veya şifre hatalı.' };
  }

  // Silme sürecindeki hesapta giriş, silmeyi iptal eder
  let deletionCancelled = false;
  const data = s.userData[account.id];
  if (data?.deletionRequestedAt) {
    const expired = Date.now() - new Date(data.deletionRequestedAt).getTime() >= DELETION_GRACE_DAYS * 86400000;
    if (expired) return { ok: false, error: 'E-posta veya şifre hatalı.' };
    patchUser(account.id, (u) => ({ ...u, deletionRequestedAt: null }));
    deletionCancelled = true;
  }

  setState((cur) => ({ ...cur, session: { accountId: account.id } }));
  return { ok: true, account, deletionCancelled };
}

export function quickLogin(accountId: string): LoginResult {
  const account = getState().accounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: 'Hesap bulunamadı.' };
  return login(account.email, account.password);
}

export function logout() {
  setState((s) => ({ ...s, session: null }));
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  // GG.AA.YYYY
  birthDate: string;
  sex: Sex;
  acceptTerms: boolean;
  healthConsent: boolean;
}

export type RegisterErrors = Partial<
  Record<'email' | 'password' | 'username' | 'birthDate' | 'firstName' | 'acceptTerms' | 'general', string>
>;

export type RegisterResult = { ok: true; account: DemoAccount } | { ok: false; errors: RegisterErrors };

export function register(input: RegisterInput): RegisterResult {
  const s = getState();
  const errors: RegisterErrors = {};

  const email = input.email.trim().toLowerCase();
  const username = input.username.trim().toLowerCase();
  const birth = parseTrDate(input.birthDate);

  const emailError = validateEmail(email);
  if (emailError) errors.email = emailError;
  else if (s.accounts.some((a) => a.email.toLowerCase() === email)) errors.email = 'Bu e-posta adresi zaten kayıtlı.';

  const usernameError = validateUsername(username);
  if (usernameError) errors.username = usernameError;
  else if (s.accounts.some((a) => a.username.toLowerCase() === username)) errors.username = 'Bu kullanıcı adı alınmış.';

  const passwordError = validatePassword(input.password);
  if (passwordError) errors.password = passwordError;

  if (!input.firstName.trim()) errors.firstName = 'Adını yaz';
  if (!input.acceptTerms) errors.acceptTerms = 'Kullanım koşullarını kabul etmelisin';

  let group: ReturnType<typeof ageGroupOf> = 'ADULT';
  if (!birth) {
    errors.birthDate = 'Doğum tarihini GG.AA.YYYY biçiminde yaz';
  } else {
    group = ageGroupOf(birth);
    if (group === 'CHILD') errors.general = '13 yaşından küçükler kayıt olamaz.';
  }

  if (Object.keys(errors).length > 0 || !birth) return { ok: false, errors };

  const account: DemoAccount = {
    id: newId('acc'),
    roleKey: group === 'TEEN' ? 'teen' : 'user',
    email,
    username,
    password: input.password,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    birthDate: birth.toISOString().slice(0, 10),
    sex: input.sex,
    bio: '',
    isSeed: false,
  };

  const onboarding = s.ui.onboarding;
  const goal = group === 'TEEN' ? 'maintain' : toGoal(onboarding?.goals[0]);
  const data = newUserData({
    goal,
    activity: onboarding?.level === 'advanced' ? 'active' : onboarding?.level === 'intermediate' ? 'moderate' : 'light',
    // 18 yaş altı sağlık verisi rızasını kendisi veremez; veli onayı gerekir
    consents: { health_data: group === 'ADULT' && input.healthConsent, marketing: false },
    parentalApproval: group === 'TEEN' ? 'requested' : 'none',
  });

  setState((cur) => ({
    ...cur,
    accounts: [...cur.accounts, account],
    userData: { ...cur.userData, [account.id]: data },
    session: { accountId: account.id },
  }));
  return { ok: true, account };
}

export function requestDeletion(accountId: string, password: string): { ok: boolean; error?: string } {
  const account = accountById(getState(), accountId);
  if (!account || account.password !== password) return { ok: false, error: 'Şifre hatalı.' };
  // Uzman ve personel hesaplarının kişisel verisi olmayabilir; silme bilgisi için boş kayıt açılır
  setState((s) => ({
    ...s,
    userData: { ...s.userData, [accountId]: { ...(s.userData[accountId] ?? newUserData()), deletionRequestedAt: isoNow() } },
  }));
  logout();
  return { ok: true };
}

export function updateProfile(
  accountId: string,
  patch: { firstName?: string; lastName?: string; bio?: string; username?: string },
): { ok: boolean; error?: string } {
  const s = getState();
  if (patch.username !== undefined) {
    const username = patch.username.trim().toLowerCase();
    const error = validateUsername(username);
    if (error) return { ok: false, error };
    if (s.accounts.some((a) => a.id !== accountId && a.username.toLowerCase() === username)) {
      return { ok: false, error: 'Bu kullanıcı adı alınmış.' };
    }
    patch = { ...patch, username };
  }
  setState((cur) => ({
    ...cur,
    accounts: cur.accounts.map((a) => (a.id === accountId ? { ...a, ...patch } : a)),
  }));
  return { ok: true };
}

export function setPrivate(accountId: string, isPrivate: boolean): { ok: boolean; error?: string } {
  const account = accountById(getState(), accountId);
  if (account?.roleKey === 'teen' && !isPrivate) {
    return { ok: false, error: '18 yaşından küçüklerin profili gizli kalır.' };
  }
  patchUser(accountId, (u) => ({ ...u, isPrivate }));
  return { ok: true };
}

export function setConsent(accountId: string, key: 'health_data' | 'marketing', value: boolean): { ok: boolean; error?: string } {
  const account = accountById(getState(), accountId);
  if (key === 'health_data' && value && account?.roleKey === 'teen') {
    return { ok: false, error: '18 yaşından küçükler için sağlık verisi rızası veli tarafından verilmelidir.' };
  }
  patchUser(accountId, (u) => ({ ...u, consents: { ...u.consents, [key]: value } }));
  return { ok: true };
}

export function setSharing(accountId: string, key: keyof UserData['sharing'], value: boolean) {
  patchUser(accountId, (u) => ({ ...u, sharing: { ...u.sharing, [key]: value } }));
}

export function requestParentalApproval(accountId: string) {
  patchUser(accountId, (u) => ({ ...u, parentalApproval: 'requested' }));
}

// Demo: veli onayını simüle eder. Veli onayı, sağlık verisi rızasını da kapsar.
export function simulateParentalApproval(accountId: string) {
  patchUser(accountId, (u) => ({ ...u, parentalApproval: 'approved', consents: { ...u.consents, health_data: true } }));
}

export function setTheme(pref: DemoState['ui']['themePref']) {
  setState((s) => ({ ...s, ui: { ...s.ui, themePref: pref } }));
}

export function setOnboarding(answers: OnboardingAnswers | null) {
  setState((s) => ({ ...s, ui: { ...s.ui, onboarding: answers } }));
}

export { resetDemo };

// ───────────── Beslenme ve ilerleme ─────────────

export function addMeal(accountId: string, date: string, entry: { slot: MealSlot; foodId: string; servings: number }) {
  patchUser(accountId, (u) => ({
    ...u,
    meals: { ...u.meals, [date]: [...(u.meals[date] ?? []), { id: newId('me'), ...entry }] },
  }));
}

export function addMeals(accountId: string, date: string, entries: { slot: MealSlot; foodId: string; servings: number }[]) {
  patchUser(accountId, (u) => ({
    ...u,
    meals: { ...u.meals, [date]: [...(u.meals[date] ?? []), ...entries.map((e) => ({ id: newId('me'), ...e }))] },
  }));
}

export function removeMeal(accountId: string, date: string, entryId: string) {
  patchUser(accountId, (u) => ({
    ...u,
    meals: { ...u.meals, [date]: (u.meals[date] ?? []).filter((m) => m.id !== entryId) },
  }));
}

export function addWater(accountId: string, date: string, ml: number) {
  patchUser(accountId, (u) => ({
    ...u,
    waterMl: { ...u.waterMl, [date]: Math.max(0, (u.waterMl[date] ?? 0) + ml) },
  }));
}

export function addWeight(accountId: string, kg: number) {
  const today = dateKey(0);
  patchUser(accountId, (u) => ({
    ...u,
    weightKg: kg,
    weights: [...u.weights.filter((w) => w.date !== today), { date: today, kg }],
  }));
}

export function updateHealth(
  accountId: string,
  patch: Partial<Pick<UserData, 'heightCm' | 'activity' | 'allergens' | 'diet' | 'goal' | 'targetKcal'>> & { weightKg?: number },
) {
  const { weightKg, ...rest } = patch;
  patchUser(accountId, (u) => ({ ...u, ...rest }));
  if (weightKg !== undefined) addWeight(accountId, weightKg);
}

// ───────────── Egzersiz ve program ─────────────

export function enroll(accountId: string, programId: string) {
  patchUser(accountId, (u) => ({
    ...u,
    enrollments: { ...u.enrollments, [programId]: u.enrollments[programId] ?? { startedAt: dateKey(0), completedDays: [] } },
  }));
}

export function leaveProgram(accountId: string, programId: string) {
  patchUser(accountId, (u) => {
    const enrollments = { ...u.enrollments };
    delete enrollments[programId];
    return { ...u, enrollments };
  });
}

export function toggleProgramDay(accountId: string, programId: string, dayNumber: number) {
  patchUser(accountId, (u) => {
    const current = u.enrollments[programId];
    if (!current) return u;
    const done = current.completedDays.includes(dayNumber)
      ? current.completedDays.filter((d) => d !== dayNumber)
      : [...current.completedDays, dayNumber].sort((a, b) => a - b);
    return { ...u, enrollments: { ...u.enrollments, [programId]: { ...current, completedDays: done } } };
  });
}

// ───────────── Sosyal ─────────────

export function toggleFollow(accountId: string, proId: string) {
  patchUser(accountId, (u) => ({
    ...u,
    following: u.following.includes(proId) ? u.following.filter((p) => p !== proId) : [...u.following, proId],
  }));
}

export function toggleLike(accountId: string, postId: string) {
  patchUser(accountId, (u) => ({
    ...u,
    likes: u.likes.includes(postId) ? u.likes.filter((p) => p !== postId) : [...u.likes, postId],
  }));
}

export function toggleSave(accountId: string, postId: string) {
  patchUser(accountId, (u) => ({
    ...u,
    saves: u.saves.includes(postId) ? u.saves.filter((p) => p !== postId) : [...u.saves, postId],
  }));
}

// Sadece danışan bağlantısı kurulmuş kullanıcılar yorum yazabilir; kişi başı tek yorum (güncellenebilir)
export function postReview(input: {
  proAccountId: string;
  proId: string;
  authorAccountId: string;
  rating: number;
  text: string;
}): { ok: boolean; error?: string } {
  const s = getState();
  const link = activeLinkBetween(s, input.authorAccountId, input.proAccountId);
  if (!link) return { ok: false, error: 'Yorum yazmak için bu uzmanın danışanı olman gerekir.' };
  const author = accountById(s, input.authorAccountId);
  if (!author) return { ok: false, error: 'Hesap bulunamadı.' };
  const since = new Date(link.startedAt).getTime();
  const days = Math.max(1, Math.round((Date.now() - since) / 86400000));
  const clientFor = days < 14 ? `${days} gün` : days < 60 ? `${Math.round(days / 7)} hafta` : `${Math.round(days / 30)} ay`;

  patchShared((sh) => ({
    ...sh,
    reviews: [
      {
        id: newId('rev'),
        proId: input.proId,
        authorName: `${author.firstName} ${author.lastName.slice(0, 1)}.`,
        authorAccountId: author.id,
        rating: input.rating,
        text: input.text.trim(),
        clientFor,
        createdAt: isoNow(),
      },
      ...sh.reviews.filter((r) => !(r.proId === input.proId && r.authorAccountId === input.authorAccountId)),
    ],
  }));
  return { ok: true };
}

// Uzman, her yoruma bir kez cevap yazabilir
export function replyToReview(reviewId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  patchShared((sh) => ({
    ...sh,
    reviews: sh.reviews.map((r) => (r.id === reviewId && !r.reply ? { ...r, reply: body } : r)),
  }));
}

// ───────────── Mesajlaşma ─────────────

// Varsa mevcut sohbeti döndürür. Uzmanlara doğrudan yazılır (istek gerekmez).
export function startConversation(viewer: Party, other: Party): string {
  const existing = getState().shared.conversations.find(
    (c) => (c.a.id === viewer.id && c.b.id === other.id) || (c.a.id === other.id && c.b.id === viewer.id),
  );
  if (existing) return existing.id;
  const id = newId('cv');
  patchShared((sh) => ({
    ...sh,
    conversations: [...sh.conversations, { id, a: viewer, b: other, messages: [], reads: { [viewer.id]: isoNow() } }],
  }));
  return id;
}

export function sendMessage(conversationId: string, fromId: string, text: string) {
  const body = text.trim();
  if (!body) return;
  const at = isoNow();
  patchShared((sh) => ({
    ...sh,
    conversations: sh.conversations.map((c) =>
      c.id === conversationId
        ? { ...c, messages: [...c.messages, { id: newId('m'), fromId, text: body, at }], reads: { ...c.reads, [fromId]: at } }
        : c,
    ),
  }));
}

export function markRead(conversationId: string, viewerId: string) {
  patchShared((sh) => ({
    ...sh,
    conversations: sh.conversations.map((c) =>
      c.id === conversationId ? { ...c, reads: { ...c.reads, [viewerId]: isoNow() } } : c,
    ),
  }));
}

export function markNotificationsRead(accountId: string) {
  patchShared((sh) => ({
    ...sh,
    notifications: sh.notifications.map((n) => (n.toAccountId === accountId ? { ...n, read: true } : n)),
  }));
}

// ───────────── Uzman: danışan ve plan ─────────────

// Danışanın boy, kilo, alerji gibi bilgilerini günceller. Hesaba bağlı danışanda hesabın verisi güncellenir.
export function updateClient(
  clientId: string,
  patch: Partial<Pick<ClientRecord, 'heightCm' | 'weightKg' | 'allergens' | 'diet' | 'goal' | 'activity' | 'targetWeightKg' | 'note'>>,
) {
  const record = getState().shared.clients[clientId];
  if (!record) return;

  if (record.accountId) {
    const { allergens, weightKg, targetWeightKg, note, ...rest } = patch;
    updateHealth(record.accountId, {
      ...rest,
      ...(allergens !== undefined ? { allergens: allergens ?? [] } : {}),
      ...(weightKg !== undefined ? { weightKg } : {}),
    });
    if (targetWeightKg !== undefined || note !== undefined) {
      patchShared((sh) => ({
        ...sh,
        clients: { ...sh.clients, [clientId]: { ...sh.clients[clientId]!, ...(targetWeightKg !== undefined ? { targetWeightKg } : {}), ...(note !== undefined ? { note } : {}) } },
      }));
    }
    return;
  }

  const today = dateKey(0);
  patchShared((sh) => {
    const current = sh.clients[clientId]!;
    const weights =
      patch.weightKg !== undefined
        ? [...current.weights.filter((w) => w.date !== today), { date: today, kg: patch.weightKg }]
        : current.weights;
    return { ...sh, clients: { ...sh.clients, [clientId]: { ...current, ...patch, weights, lastEntryDaysAgo: 0 } } };
  });
}

export function approvePlan(plan: Omit<Plan, 'id' | 'createdAt'>) {
  const record = getState().shared.clients[plan.clientId];
  patchShared((sh) => ({
    ...sh,
    plans: [{ ...plan, id: newId('plan'), createdAt: isoNow() }, ...sh.plans.filter((p) => p.clientId !== plan.clientId)],
  }));
  if (record?.accountId) {
    notify(record.accountId, 'Yeni beslenme planın hazır', 'Diyetisyenin sana yeni bir plan gönderdi. Beslenme sekmesinden bakabilirsin.');
  }
}

// Mesajlaştığı bir kullanıcıyı danışanı olarak ekler. Yeni danışanın paylaşım izinleri varsayılan olarak kapalıdır;
// uzman, danışanın hangi verileri paylaştığını danışan açana kadar göremez.
export function addClientFromAccount(proAccountId: string, userAccountId: string): { ok: boolean; error?: string } {
  const s = getState();
  const pro = accountById(s, proAccountId);
  const account = accountById(s, userAccountId);
  const data = s.userData[userAccountId];
  if (!pro || !account || !data) return { ok: false, error: 'Kullanıcı bulunamadı.' };
  if (account.roleKey === 'teen' && data.parentalApproval !== 'approved') {
    return { ok: false, error: 'Genç kullanıcıyı danışan yapmak için veli onayı gerekir.' };
  }
  if (activeLinkBetween(s, userAccountId, proAccountId)) return { ok: false, error: 'Bu kişi zaten danışanın.' };

  const recordId = newId('cl');
  const record: ClientRecord = {
    id: recordId,
    accountId: userAccountId,
    name: `${account.firstName} ${account.lastName}`.trim(),
    ageYears: 0,
    sex: account.sex,
    heightCm: data.heightCm,
    weightKg: data.weightKg,
    targetWeightKg: data.weightKg,
    goal: data.goal,
    activity: data.activity,
    allergens: data.allergens,
    diet: data.diet,
    weights: data.weights,
    lastEntryDaysAgo: 0,
    sharing: data.sharing,
    mealsToday: [],
    note: '',
  };
  patchShared((sh) => ({
    ...sh,
    clients: { ...sh.clients, [recordId]: record },
    clientLinks: [
      ...sh.clientLinks,
      { id: newId('lnk'), proId: proAccountId, clientId: recordId, status: 'active', startedAt: isoNow() },
    ],
  }));
  notify(
    userAccountId,
    'Danışan bağlantısı kuruldu',
    `${pro.firstName} ${pro.lastName} seni danışanı olarak ekledi. Hangi verilerini paylaşacağını Profil bölümünden seçebilirsin.`,
  );
  return { ok: true };
}

// Danışanlığı sonlandırır; uzman danışanın verilerine hemen erişimini kaybeder
export function endClientLink(linkId: string) {
  patchShared((sh) => ({
    ...sh,
    clientLinks: sh.clientLinks.map((l) => (l.id === linkId ? { ...l, status: 'ended', endedAt: isoNow() } : l)),
  }));
}

// ───────────── Takvim ─────────────

export function addAppointment(input: Omit<Appointment, 'id'>) {
  patchShared((sh) => ({ ...sh, appointments: [...sh.appointments, { id: newId('apt'), ...input }] }));
}

export function removeAppointment(id: string) {
  patchShared((sh) => ({ ...sh, appointments: sh.appointments.filter((a) => a.id !== id) }));
}

// ───────────── Eğitmen: programlar ─────────────

export function assignProgram(programId: string, clientId: string, trainerId: string) {
  const record = getState().shared.clients[clientId];
  patchShared((sh) => ({
    ...sh,
    assignments: [
      { id: newId('asg'), programId, clientId, trainerId, at: isoNow() },
      ...sh.assignments.filter((a) => !(a.clientId === clientId && a.trainerId === trainerId)),
    ],
  }));
  if (record?.accountId) notify(record.accountId, 'Yeni program', 'Eğitmenin sana bir program atadı.');
}

export function createProgram(input: {
  authorId: string;
  authorName: string;
  title: string;
  description: string;
  weeks: number;
  daysPerWeek: number;
  exerciseIds: string[];
}): Program {
  const exerciseIds = input.exerciseIds.filter((id) => findExercise(id));
  const days: ProgramDay[] = Array.from({ length: input.weeks * input.daysPerWeek }, (_, i) => ({
    title: `Gün ${i + 1}`,
    exerciseIds,
  }));
  const program: Program = {
    id: newId('prog'),
    title: input.title.trim(),
    description: input.description.trim(),
    level: 'beginner',
    weeks: input.weeks,
    daysPerWeek: input.daysPerWeek,
    category: findExercise(exerciseIds[0] ?? '')?.category ?? 'fitness',
    authorId: input.authorId,
    authorName: input.authorName,
    status: 'draft',
    days,
  };
  patchShared((sh) => ({ ...sh, programs: [program, ...sh.programs] }));
  return program;
}

// Herkese açık yayın için admin onayı gerekir: program "onayda" durumuna geçer
export function submitProgram(programId: string) {
  patchShared((sh) => ({
    ...sh,
    programs: sh.programs.map((p) => (p.id === programId && p.status === 'draft' ? { ...p, status: 'pending' } : p)),
  }));
}

// ───────────── Spor salonu ─────────────

export function inviteStaff(input: { gymId: string; name: string; role: GymStaff['role'] }) {
  const staff: GymStaff = {
    id: newId('st'),
    gymId: input.gymId,
    name: input.name.trim(),
    role: input.role,
    shifts: ['09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', '09:00–17:00', 'İzinli', 'İzinli'],
    invited: true,
  };
  patchShared((sh) => ({ ...sh, gymStaff: [...sh.gymStaff, staff] }));
}

export function setShift(staffId: string, dayIndex: number, value: string) {
  patchShared((sh) => ({
    ...sh,
    gymStaff: sh.gymStaff.map((st) =>
      st.id === staffId ? { ...st, shifts: st.shifts.map((s, i) => (i === dayIndex ? value : s)) } : st,
    ),
  }));
}

export function addTask(input: { gymId: string; title: string; assigneeId: string; due: string }) {
  const staff = getState().shared.gymStaff.find((st) => st.id === input.assigneeId);
  patchShared((sh) => ({
    ...sh,
    gymTasks: [{ id: newId('tk'), ...input, title: input.title.trim(), done: false, createdAt: isoNow() }, ...sh.gymTasks],
  }));
  if (staff?.accountId) notify(staff.accountId, 'Yeni görev', `Yönetici sana "${input.title.trim()}" görevini atadı.`);
}

export function toggleTask(taskId: string) {
  patchShared((sh) => ({
    ...sh,
    gymTasks: sh.gymTasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
  }));
}

export function addLesson(input: {
  gymId: string;
  title: string;
  date: string;
  time: string;
  trainerId: string;
  kind: 'group' | 'private';
  memberName?: string;
}) {
  patchShared((sh) => ({ ...sh, gymLessons: [...sh.gymLessons, { id: newId('ls'), ...input }] }));
}
