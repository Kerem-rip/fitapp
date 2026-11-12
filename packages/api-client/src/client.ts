// Sunucuyla konuşan istemci. Erişim anahtarı süresi dolunca yenileme anahtarıyla bir kez yeniler ve isteği tekrarlar.
import type {
  AdminApplicationDetail,
  AgendaResponse,
  AppNotificationItem,
  AppointmentInput,
  AppointmentMode,
  AppointmentStatus,
  AdminApplicationItem,
  ApplicationStatus,
  ApplicationSummary,
  AnamnesisResponse,
  AnswerValue,
  AuditEntry,
  ClientFileSummary,
  ClientPlanChoice,
  AuthResult,
  ClientRelationshipItem,
  DocumentKind,
  ExercisePerformance,
  FindingDecision,
  FindingItem,
  FindingsResponse,
  GoalItem,
  GoalStatus,
  ClientFoodView,
  FoodDay,
  MealEntryItem,
  MealType,
  GymInfo,
  GymInviteItem,
  GymBookingItem,
  GymLessonDetail,
  GymLessonItem,
  GymLessonKind,
  GymMemberLessons,
  GymShiftRow,
  GymTaskItem,
  GymWarning,
  GymMemberDetail,
  GymMemberListItem,
  GymPaymentItem,
  GymPaymentsReport,
  GymStaffItem,
  GymStaffRole,
  GymTodayPanel,
  MembershipItem,
  MembershipPlanItem,
  PaymentMethod,
  IntakeQuestionType,
  MeasurementInput,
  MeasurementItem,
  MeasurementKind,
  MyAppointment,
  MyGoal,
  MyPlanListItem,
  MyProgramListItem,
  MyProgramView,
  MyPlanView,
  NoteItem,
  PlanCheck,
  PlanContent,
  PlanOverview,
  ProAppointment,
  ProgramCheck,
  ProgramContent,
  ProgramOverview,
  ReminderItem,
  ReviewOverviewItem,
  ReviewTask,
  TaskItem,
  Me,
  ProfessionalRelationshipItem,
  RegisterStartInput,
  RegisterStartResult,
  RelationshipBase,
  RelationshipStatus,
  SharedDataType,
  TimelineItem,
  WorkoutLogInput,
  WorkoutLogItem,
  Tokens,
  UploadFile,
} from './types';

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(tokens: Tokens | null): Promise<void>;
}

export interface ApiClientConfig {
  // Sunucu adresi (ör. http://192.168.1.20:3000/api). Her istekte okunur; uygulama içinde değiştirilebilir.
  getBaseUrl: () => string | Promise<string>;
  tokens: TokenStore;
  // Oturum yenilenemeyince çağrılır (kullanıcı tekrar giriş yapmalı)
  onSessionExpired?: () => void;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryAfterSec?: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 90_000;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  form?: FormData;
  auth?: boolean;
  query?: Record<string, string>;
  timeoutMs?: number;
}

function measurementQuery(options: { kind?: MeasurementKind; includeVoided?: boolean }): Record<string, string> {
  return { ...(options.kind ? { kind: options.kind } : {}), ...(options.includeVoided ? { includeVoided: 'true' } : {}) };
}
export function createApiClient(config: ApiClientConfig) {
  const doFetch: typeof fetch = config.fetchImpl ?? ((...args) => fetch(...args));
  let refreshing: Promise<boolean> | null = null;

  async function send(path: string, options: RequestOptions, accessToken?: string): Promise<Response> {
    const base = (await config.getBaseUrl()).replace(/\/+$/, '');
    const query = options.query ? `?${new URLSearchParams(options.query).toString()}` : '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? REQUEST_TIMEOUT_MS);
    try {
      return await doFetch(`${base}${path}${query}`, {
        method: options.method ?? (options.body !== undefined || options.form ? 'POST' : 'GET'),
        headers,
        body: options.form ?? (options.body !== undefined ? JSON.stringify(options.body) : undefined),
        signal: controller.signal,
      });
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      throw new ApiError(
        0,
        aborted ? 'TIMEOUT' : 'NETWORK',
        aborted
          ? 'Sunucu cevap vermedi. Biraz sonra tekrar dene.'
          : 'Sunucuya ulaşılamadı. İnternet bağlantını ve sunucu adresini kontrol et.',
      );
    } finally {
      clearTimeout(timer);
    }
  }

  async function refreshTokens(): Promise<boolean> {
    refreshing ??= (async () => {
      const current = await config.tokens.get();
      if (!current) return false;
      try {
        const response = await send('/auth/refresh', { method: 'POST', body: { refreshToken: current.refreshToken } });
        if (!response.ok) {
          await config.tokens.set(null);
          return false;
        }
        const next = (await response.json()) as Tokens;
        await config.tokens.set({ accessToken: next.accessToken, refreshToken: next.refreshToken, expiresIn: next.expiresIn });
        return true;
      } catch {
        // Bağlantı sorunu: anahtarlar silinmez, sonra tekrar denenir
        return false;
      } finally {
        refreshing = null;
      }
    })();
    return refreshing;
  }

  async function parseError(response: Response): Promise<ApiError> {
    let data: { code?: string; message?: string | string[]; retryAfterSec?: number } = {};
    try {
      data = await response.json();
    } catch {
      // gövde yok
    }
    const message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
    return new ApiError(response.status, data.code ?? `HTTP_${response.status}`, message ?? 'Bir sorun oluştu.', data.retryAfterSec);
  }

  async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const auth = options.auth ?? false;
    let tokens = auth ? await config.tokens.get() : null;
    if (auth && !tokens) {
      throw new ApiError(401, 'UNAUTHENTICATED', 'Oturum geçersiz. Lütfen tekrar giriş yapın.');
    }

    let response = await send(path, options, tokens?.accessToken);
    if (auth && response.status === 401) {
      if (await refreshTokens()) {
        tokens = await config.tokens.get();
        response = await send(path, options, tokens?.accessToken);
      } else {
        const stillHasTokens = await config.tokens.get();
        if (!stillHasTokens) config.onSessionExpired?.();
      }
    }
    if (!response.ok) throw await parseError(response);
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }

  async function storeAuth(result: AuthResult): Promise<AuthResult> {
    await config.tokens.set({ accessToken: result.accessToken, refreshToken: result.refreshToken, expiresIn: result.expiresIn });
    return result;
  }

  function appendFile(form: FormData, field: string, file: UploadFile) {
    if (file.file) {
      form.append(field, file.file, file.name);
    } else {
      // React Native: dosya { uri, name, type } nesnesiyle gönderilir
      form.append(field, { uri: file.uri, name: file.name, type: file.mimeType } as unknown as Blob);
    }
  }

  return {
    // ───────────── Giriş ve kayıt ─────────────
    async login(identifier: string, password: string, deviceName?: string): Promise<AuthResult> {
      return storeAuth(await request<AuthResult>('/auth/login', { method: 'POST', body: { identifier, password, deviceName } }));
    },
    // Yönetici / moderatör girişi (normal girişten ayrı)
    async adminLogin(identifier: string, password: string, deviceName?: string): Promise<AuthResult> {
      return storeAuth(await request<AuthResult>('/auth/admin/login', { method: 'POST', body: { identifier, password, deviceName } }));
    },
    registerStart(input: RegisterStartInput) {
      return request<RegisterStartResult>('/auth/register/start', { method: 'POST', body: input });
    },
    uploadRegistrationDocument(registrationId: string, kind: DocumentKind, file: UploadFile) {
      const form = new FormData();
      form.append('kind', kind);
      appendFile(form, 'file', file);
      return request<{ id: string; kind: DocumentKind; originalName: string; sizeBytes: number }>(
        `/auth/register/${registrationId}/documents`,
        { method: 'POST', form, timeoutMs: UPLOAD_TIMEOUT_MS },
      );
    },
    async registerVerify(registrationId: string, code: string): Promise<AuthResult> {
      return storeAuth(await request<AuthResult>('/auth/register/verify', { method: 'POST', body: { registrationId, code } }));
    },
    // Şifremi unuttum: her durumda aynı cevap; test modunda kod da döner
    forgotPassword(email: string) {
      return request<{ sent: true; codeTtlMinutes: number; devCode?: string }>('/auth/password/forgot', { method: 'POST', body: { email } });
    },
    resetPassword(email: string, code: string, password: string) {
      return request<{ reset: true }>('/auth/password/reset', { method: 'POST', body: { email, code, password } });
    },
    registerResend(registrationId: string) {
      return request<{ codeExpiresAt: string; devCode?: string }>('/auth/register/resend', { method: 'POST', body: { registrationId } });
    },
    async usernameAvailable(username: string): Promise<boolean> {
      const result = await request<{ available: boolean }>('/auth/register/username-available', { query: { username } });
      return result.available;
    },
    async logout(): Promise<void> {
      try {
        await request<void>('/auth/logout', { method: 'POST', auth: true });
      } catch {
        // Sunucuya ulaşılamasa da cihazdaki oturum kapatılır
      }
      await config.tokens.set(null);
    },
    hasSession: async () => (await config.tokens.get()) !== null,

    // ───────────── Hesabım ─────────────
    me: () => request<Me>('/users/me', { auth: true }),
    updateMe: (patch: { firstName?: string | null; lastName?: string | null; username?: string; bio?: string | null; isPrivate?: boolean }) =>
      request<Me>('/users/me', { method: 'PATCH', body: patch, auth: true }),
    requestDeletion: (password: string) =>
      request<{ deletionScheduledFor: string; graceDays: number }>('/users/me/delete', { method: 'POST', body: { password }, auth: true }),
    consents: () => request<{ type: string; textVersion: string; grantedAt: string }[]>('/consents', { auth: true }),
    grantConsent: (type: 'health_data' | 'marketing') => request<unknown[]>(`/consents/${type}`, { method: 'PUT', auth: true }),
    revokeConsent: (type: 'health_data' | 'marketing') => request<unknown[]>(`/consents/${type}`, { method: 'DELETE', auth: true }),

    // ───────────── Profesyonel başvuru ─────────────
    myApplication: () => request<ApplicationSummary>('/applications/me', { auth: true }),
    resubmitApplication(files: { file: UploadFile; kind: DocumentKind }[]) {
      const form = new FormData();
      form.append('kinds', JSON.stringify(files.map((f) => f.kind)));
      for (const f of files) appendFile(form, 'files', f.file);
      return request<{ id: string; status: ApplicationStatus; attemptNumber: number }>('/applications/me/resubmit', {
        method: 'POST',
        form,
        auth: true,
        timeoutMs: UPLOAD_TIMEOUT_MS,
      });
    },

    // ───────────── Danışanlık ve paylaşım ─────────────
    // Profesyonel: kullanıcı adıyla danışan teklifi gönderir
    offerClient: (username: string) =>
      request<ProfessionalRelationshipItem>('/relationships/offer', { method: 'POST', body: { username }, auth: true }),
    relationshipsAsProfessional: (status: RelationshipStatus = 'ACTIVE') =>
      request<ProfessionalRelationshipItem[]>('/relationships/as-professional', { auth: true, query: { status } }),
    // Danışan: bana gelen teklifler ve aktif danışanlıklarım
    relationshipsAsClient: () => request<ClientRelationshipItem[]>('/relationships/as-client', { auth: true }),
    acceptOffer: (id: string, input: { sharedData: SharedDataType[]; sharedUntil: string | null }) =>
      request<RelationshipBase>(`/relationships/${id}/accept`, { method: 'POST', body: input, auth: true }),
    declineOffer: (id: string) => request<{ id: string; status: 'ENDED' }>(`/relationships/${id}/decline`, { method: 'POST', auth: true }),
    updateSharing: (id: string, input: { sharedData?: SharedDataType[]; sharedUntil?: string | null }) =>
      request<RelationshipBase>(`/relationships/${id}/sharing`, { method: 'PATCH', body: input, auth: true }),
    // Danışan da profesyonel de bitirebilir; bittiği an profesyonelin erişimi kapanır
    endRelationship: (id: string) => request<{ id: string; status: 'ENDED' }>(`/relationships/${id}/end`, { method: 'POST', auth: true }),
    // Verime kim ne yaptı (en yeniden eskiye)
    auditLog: (options: { limit?: number; before?: string } = {}) =>
      request<AuditEntry[]>('/relationships/audit', {
        auth: true,
        query: { ...(options.limit ? { limit: String(options.limit) } : {}), ...(options.before ? { before: options.before } : {}) },
      }),

    // ───────────── Danışan dosyası ─────────────
    // Kişinin kendi sağlık bilgileri
    myMeasurements: (options: { kind?: MeasurementKind; includeVoided?: boolean } = {}) =>
      request<MeasurementItem[]>('/me/health/measurements', { auth: true, query: measurementQuery(options) }),
    addMyMeasurement: (input: MeasurementInput) =>
      request<MeasurementItem>('/me/health/measurements', { method: 'POST', body: input, auth: true }),
    voidMyMeasurement: (id: string, reason?: string) =>
      request<MeasurementItem>(`/me/health/measurements/${id}/void`, { method: 'POST', body: { reason }, auth: true }),
    // Öğün ve su günlüğüm (sağlık verisi izni gerekir)
    myFood: (from: string, to: string) => request<FoodDay[]>('/me/health/food', { auth: true, query: { from, to } }),
    addMeal: (input: {
      date?: string;
      mealType: MealType;
      foodKey?: string;
      name: string;
      portion: string;
      servings: number;
      perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number };
    }) => request<MealEntryItem>('/me/health/meals', { method: 'POST', body: input, auth: true }),
    removeMeal: (id: string) => request<{ id: string }>(`/me/health/meals/${id}`, { method: 'DELETE', auth: true }),
    addWater: (amountMl: number) => request<{ date: string; waterMl: number }>('/me/health/water', { method: 'POST', body: { amountMl }, auth: true }),
    // Danışanın öğün ve suyu (sadece paylaşılan kategoriler; bakış denetim kaydına yazılır)
    clientFood: (clientId: string, from: string, to: string) => request<ClientFoodView>(`/clients/${clientId}/food`, { auth: true, query: { from, to } }),
    myAnamnesis: () => request<AnamnesisResponse>('/me/health/anamnesis', { auth: true }),
    answerMyAnamnesis: (questionKey: string, value: AnswerValue) =>
      request<{ changed: boolean }>(`/me/health/anamnesis/${encodeURIComponent(questionKey)}`, { method: 'PUT', body: { value }, auth: true }),

    // Profesyonel: danışanın dosyası (sadece danışanın paylaştıkları gelir)
    clientFile: (clientId: string) => request<ClientFileSummary>(`/clients/${clientId}/file`, { auth: true }),
    clientTimeline: (clientId: string, options: { limit?: number; before?: string } = {}) =>
      request<TimelineItem[]>(`/clients/${clientId}/timeline`, {
        auth: true,
        query: { ...(options.limit ? { limit: String(options.limit) } : {}), ...(options.before ? { before: options.before } : {}) },
      }),
    clientMeasurements: (clientId: string, options: { kind?: MeasurementKind; includeVoided?: boolean } = {}) =>
      request<MeasurementItem[]>(`/clients/${clientId}/measurements`, { auth: true, query: measurementQuery(options) }),
    addClientMeasurement: (clientId: string, input: MeasurementInput) =>
      request<MeasurementItem>(`/clients/${clientId}/measurements`, { method: 'POST', body: input, auth: true }),
    voidClientMeasurement: (clientId: string, id: string, reason?: string) =>
      request<MeasurementItem>(`/clients/${clientId}/measurements/${id}/void`, { method: 'POST', body: { reason }, auth: true }),
    clientAnamnesis: (clientId: string) => request<AnamnesisResponse>(`/clients/${clientId}/anamnesis`, { auth: true }),
    answerClientAnamnesis: (clientId: string, questionKey: string, value: AnswerValue) =>
      request<{ changed: boolean }>(`/clients/${clientId}/anamnesis/${encodeURIComponent(questionKey)}`, { method: 'PUT', body: { value }, auth: true }),
    clientNotes: (clientId: string) => request<NoteItem[]>(`/clients/${clientId}/notes`, { auth: true }),
    addClientNote: (clientId: string, text: string) =>
      request<NoteItem>(`/clients/${clientId}/notes`, { method: 'POST', body: { text }, auth: true }),
    addIntakeQuestion: (input: { text: string; type: IntakeQuestionType; options?: string[] }) =>
      request<{ key: string; text: string; type: IntakeQuestionType; options: string[] }>('/intake/questions', { method: 'POST', body: input, auth: true }),
    deactivateIntakeQuestion: (id: string) =>
      request<{ id: string; active: false }>(`/intake/questions/${id}/deactivate`, { method: 'POST', auth: true }),

    // ───────────── Uzman inceleme özeti ─────────────
    clientFindings: (clientId: string, view: 'open' | 'closed' | 'all' = 'open') =>
      request<FindingsResponse>(`/clients/${clientId}/findings`, { auth: true, query: { view } }),
    addFindingNote: (clientId: string, findingId: string, text: string) =>
      request<{ id: string; kind: 'NOTE'; text: string; createdAt: string }>(`/clients/${clientId}/findings/${findingId}/notes`, { method: 'POST', body: { text }, auth: true }),
    // Kararı ve gerekçesini kaydederek kapatır
    closeFinding: (clientId: string, findingId: string, decision: FindingDecision, reason: string) =>
      request<{ id: string; status: 'CLOSED' }>(`/clients/${clientId}/findings/${findingId}/close`, { method: 'POST', body: { decision, reason }, auth: true }),
    reopenFinding: (clientId: string, findingId: string) =>
      request<{ id: string; status: 'OPEN' }>(`/clients/${clientId}/findings/${findingId}/reopen`, { method: 'POST', auth: true }),
    createFindingTask: (clientId: string, findingId: string, input: { title: string; dueAt?: string }) =>
      request<TaskItem>(`/clients/${clientId}/findings/${findingId}/task`, { method: 'POST', body: input, auth: true }),
    clientTasks: (clientId: string, status: 'OPEN' | 'DONE' = 'OPEN') =>
      request<ReviewTask[]>(`/clients/${clientId}/tasks`, { auth: true, query: { status } }),
    addClientTask: (clientId: string, input: { title: string; dueAt?: string }) =>
      request<TaskItem>(`/clients/${clientId}/tasks`, { method: 'POST', body: input, auth: true }),
    // Panel: danışan başına açık madde sayıları ve tüm görevlerim
    reviewOverview: () => request<ReviewOverviewItem[]>('/review/overview', { auth: true }),
    reviewTasks: (status: 'OPEN' | 'DONE' = 'OPEN') => request<ReviewTask[]>('/review/tasks', { auth: true, query: { status } }),
    completeTask: (taskId: string) => request<{ id: string; status: 'DONE' }>(`/review/tasks/${taskId}/done`, { method: 'POST', auth: true }),

    // ───────────── Beslenme planı ─────────────
    // Uzman: taslak → kontrol → onay (onaylanmadan danışana gitmez)
    clientPlan: (clientId: string) => request<PlanOverview>(`/clients/${clientId}/plan`, { auth: true }),
    createPlanDraft: (clientId: string, input: { content?: PlanContent; fromPublished?: boolean } = {}) =>
      request<{ content: PlanContent; basedOnNumber: number | null; updatedAt: string }>(`/clients/${clientId}/plan/draft`, { method: 'POST', body: input, auth: true }),
    savePlanDraft: (clientId: string, content: PlanContent, changeNote?: string) =>
      request<{ content: PlanContent; changeNote: string | null; updatedAt: string }>(`/clients/${clientId}/plan/draft`, { method: 'PUT', body: { content, changeNote }, auth: true }),
    discardPlanDraft: (clientId: string) => request<{ discarded: true }>(`/clients/${clientId}/plan/draft`, { method: 'DELETE', auth: true }),
    checkPlanDraft: (clientId: string) => request<PlanCheck>(`/clients/${clientId}/plan/draft/check`, { auth: true }),
    approvePlanDraft: (clientId: string, input: { changeNote?: string; confirmWarnings: boolean }) =>
      request<{ number: number; approvedAt: string; summary: string[] }>(`/clients/${clientId}/plan/draft/approve`, { method: 'POST', body: input, auth: true }),
    clientPlanChoices: (clientId: string, from: string, to: string) =>
      request<ClientPlanChoice[]>(`/clients/${clientId}/plan/choices`, { auth: true, query: { from, to } }),
    // Danışan: yayındaki plan ve seçimler
    myPlans: () => request<MyPlanListItem[]>('/me/plans', { auth: true }),
    myPlan: (planId: string, date: string) => request<MyPlanView>(`/me/plans/${planId}`, { auth: true, query: { date } }),
    choosePlanOptions: (planId: string, input: { date: string; mealId: string; optionIds: string[] }) =>
      request<{ date: string; mealId: string; optionIds: string[] }>(`/me/plans/${planId}/choices`, { method: 'PUT', body: input, auth: true }),

    // ───────────── Randevu, hedef, hatırlatma ─────────────
    agenda: (from: string, to: string) => request<AgendaResponse>('/agenda', { auth: true, query: { from, to } }),
    clientAppointments: (clientId: string, from: string, to: string) =>
      request<ProAppointment[]>(`/clients/${clientId}/appointments`, { auth: true, query: { from, to } }),
    addAppointment: (clientId: string, input: AppointmentInput) =>
      request<ProAppointment>(`/clients/${clientId}/appointments`, { method: 'POST', body: input, auth: true }),
    updateAppointment: (id: string, patch: Partial<AppointmentInput>) =>
      request<ProAppointment>(`/appointments/${id}`, { method: 'PATCH', body: patch, auth: true }),
    setAppointmentStatus: (id: string, input: { status: Exclude<AppointmentStatus, 'SCHEDULED'>; outcome?: string; reason?: string }) =>
      request<ProAppointment>(`/appointments/${id}/status`, { method: 'POST', body: input, auth: true }),
    myAppointments: () => request<MyAppointment[]>('/me/appointments', { auth: true }),
    cancelMyAppointment: (id: string, reason?: string) =>
      request<{ id: string; status: 'CANCELLED' }>(`/me/appointments/${id}/cancel`, { method: 'POST', body: { reason }, auth: true }),
    clientGoals: (clientId: string) => request<GoalItem[]>(`/clients/${clientId}/goals`, { auth: true }),
    addGoal: (clientId: string, input: { title: string; measurementKind?: MeasurementKind; targetValue?: number; targetDate?: string; note?: string }) =>
      request<GoalItem>(`/clients/${clientId}/goals`, { method: 'POST', body: input, auth: true }),
    setGoalStatus: (id: string, status: GoalStatus, note?: string) =>
      request<GoalItem>(`/goals/${id}/status`, { method: 'POST', body: { status, note }, auth: true }),
    myGoals: () => request<MyGoal[]>('/me/goals', { auth: true }),
    clientReminders: (clientId: string) => request<ReminderItem[]>(`/clients/${clientId}/reminders`, { auth: true }),
    addReminder: (clientId: string, input: { text: string; remindAt: string }) =>
      request<ReminderItem>(`/clients/${clientId}/reminders`, { method: 'POST', body: input, auth: true }),
    cancelReminder: (id: string) => request<ReminderItem>(`/reminders/${id}/cancel`, { method: 'POST', auth: true }),

    // ───────────── Bildirimler ─────────────
    notifications: (limit = 50) => request<{ unread: number; items: AppNotificationItem[] }>('/notifications', { auth: true, query: { limit: String(limit) } }),
    markNotificationsRead: (ids?: string[]) => request<{ updated: number }>('/notifications/read', { method: 'POST', body: ids ? { ids } : {}, auth: true }),

    // ───────────── Egzersiz programı ve antrenman kayıtları ─────────────
    clientProgram: (clientId: string) => request<ProgramOverview>(`/clients/${clientId}/program`, { auth: true }),
    createProgramDraft: (clientId: string, input: { content?: ProgramContent; fromPublished?: boolean } = {}) =>
      request<{ content: ProgramContent; basedOnNumber: number | null; updatedAt: string }>(`/clients/${clientId}/program/draft`, { method: 'POST', body: input, auth: true }),
    saveProgramDraft: (clientId: string, content: ProgramContent, changeNote?: string) =>
      request<{ content: ProgramContent; changeNote: string | null; updatedAt: string }>(`/clients/${clientId}/program/draft`, { method: 'PUT', body: { content, changeNote }, auth: true }),
    discardProgramDraft: (clientId: string) => request<{ discarded: true }>(`/clients/${clientId}/program/draft`, { method: 'DELETE', auth: true }),
    checkProgramDraft: (clientId: string) => request<ProgramCheck>(`/clients/${clientId}/program/draft/check`, { auth: true }),
    approveProgramDraft: (clientId: string, input: { changeNote?: string; confirmWarnings: boolean }) =>
      request<{ number: number; approvedAt: string; summary: string[] }>(`/clients/${clientId}/program/draft/approve`, { method: 'POST', body: input, auth: true }),
    clientWorkouts: (clientId: string) => request<WorkoutLogItem[]>(`/clients/${clientId}/workouts`, { auth: true }),
    addClientWorkout: (clientId: string, input: WorkoutLogInput) =>
      request<WorkoutLogItem>(`/clients/${clientId}/workouts`, { method: 'POST', body: input, auth: true }),
    clientPerformance: (clientId: string) => request<ExercisePerformance[]>(`/clients/${clientId}/performance`, { auth: true }),
    myPrograms: () => request<MyProgramListItem[]>('/me/programs', { auth: true }),
    myProgram: (programId: string) => request<MyProgramView>(`/me/programs/${programId}`, { auth: true }),
    logProgramDay: (programId: string, input: WorkoutLogInput) =>
      request<WorkoutLogItem>(`/me/programs/${programId}/logs`, { method: 'POST', body: input, auth: true }),
    myWorkouts: () => request<WorkoutLogItem[]>('/me/workouts', { auth: true }),

    // ───────────── Spor salonu (ödemeler sadece kayıttır) ─────────────
    gymMe: () => request<GymInfo>('/gym/me', { auth: true }),
    updateGym: (patch: { name?: string; address?: string | null; city?: string | null; phone?: string | null }) =>
      request<GymInfo['gym']>('/gym/me', { method: 'PATCH', body: patch, auth: true }),
    gymToday: () => request<GymTodayPanel>('/gym/today', { auth: true }),
    gymStaff: () => request<GymStaffItem[]>('/gym/staff', { auth: true }),
    inviteGymStaff: (username: string, role: GymStaffRole) => request<{ id: string }>('/gym/staff/invite', { method: 'POST', body: { username, role }, auth: true }),
    changeGymStaffRole: (id: string, role: GymStaffRole) => request<{ id: string }>(`/gym/staff/${id}`, { method: 'PATCH', body: { role }, auth: true }),
    endGymStaff: (id: string) => request<{ id: string; status: 'ENDED' }>(`/gym/staff/${id}/end`, { method: 'POST', auth: true }),
    gymPlans: (all = false) => request<MembershipPlanItem[]>('/gym/plans', { auth: true, query: all ? { all: 'true' } : {} }),
    addGymPlan: (input: { name: string; durationDays: number; sessionCount?: number; priceKurus: number }) =>
      request<MembershipPlanItem>('/gym/plans', { method: 'POST', body: input, auth: true }),
    updateGymPlan: (id: string, patch: { name?: string; priceKurus?: number; active?: boolean }) =>
      request<MembershipPlanItem>(`/gym/plans/${id}`, { method: 'PATCH', body: patch, auth: true }),
    gymMembers: (options: { q?: string; status?: 'ACTIVE' | 'ARCHIVED' } = {}) =>
      request<GymMemberListItem[]>('/gym/members', { auth: true, query: { ...(options.q ? { q: options.q } : {}), status: options.status ?? 'ACTIVE' } }),
    addGymMember: (input: { fullName: string; phone?: string; note?: string }) => request<{ id: string }>('/gym/members', { method: 'POST', body: input, auth: true }),
    gymMember: (id: string) => request<GymMemberDetail>(`/gym/members/${id}`, { auth: true }),
    updateGymMember: (id: string, patch: { fullName?: string; phone?: string | null; note?: string | null; status?: 'ACTIVE' | 'ARCHIVED' }) =>
      request<{ id: string }>(`/gym/members/${id}`, { method: 'PATCH', body: patch, auth: true }),
    sellMembership: (memberId: string, input: { planId: string; startDate?: string; priceKurus?: number }) =>
      request<MembershipItem>(`/gym/members/${memberId}/memberships`, { method: 'POST', body: input, auth: true }),
    cancelMembership: (id: string, reason: string) => request<MembershipItem>(`/gym/memberships/${id}/cancel`, { method: 'POST', body: { reason }, auth: true }),
    recordGymPayment: (memberId: string, input: { amountKurus: number; method: PaymentMethod; paidAt?: string; membershipId?: string; note?: string }) =>
      request<GymPaymentItem>(`/gym/members/${memberId}/payments`, { method: 'POST', body: input, auth: true }),
    voidGymPayment: (id: string, reason: string) => request<GymPaymentItem>(`/gym/payments/${id}/void`, { method: 'POST', body: { reason }, auth: true }),
    gymPaymentsReport: (from: string, to: string) => request<GymPaymentsReport>('/gym/reports/payments', { auth: true, query: { from, to } }),
    // Dersler ve katılım ("katıldı" ders hakkından düşer, "gelmedi" düşmez)
    gymLessons: (from: string, to: string, mine = false) =>
      request<GymLessonItem[]>('/gym/lessons', { auth: true, query: { from, to, ...(mine ? { mine: 'true' } : {}) } }),
    createGymLesson: (input: {
      kind: GymLessonKind;
      title?: string;
      trainerId: string;
      date: string;
      startTime: string;
      durationMin: number;
      capacity?: number;
      memberId?: string;
      repeatWeeks?: number;
    }) => request<{ lessons: GymLessonItem[]; warning: GymWarning | null }>('/gym/lessons', { method: 'POST', body: input, auth: true }),
    gymLesson: (id: string) => request<GymLessonDetail>(`/gym/lessons/${id}`, { auth: true }),
    cancelGymLesson: (id: string, reason: string, wholeSeries = false) =>
      request<{ cancelled: number }>(`/gym/lessons/${id}/cancel`, { method: 'POST', body: { reason, wholeSeries }, auth: true }),
    bookGymLesson: (id: string, memberId: string) =>
      request<{ booking: { id: string }; warning: GymWarning | null }>(`/gym/lessons/${id}/bookings`, { method: 'POST', body: { memberId }, auth: true }),
    unbookGymLesson: (bookingId: string) => request<{ id: string }>(`/gym/bookings/${bookingId}/cancel`, { method: 'POST', auth: true }),
    markGymBooking: (bookingId: string, status: 'BOOKED' | 'ATTENDED' | 'NO_SHOW') =>
      request<{ booking: { id: string; status: GymBookingItem['status'] }; warning: GymWarning | null }>(`/gym/bookings/${bookingId}/mark`, { method: 'POST', body: { status }, auth: true }),
    gymMemberLessons: (memberId: string) => request<GymMemberLessons>(`/gym/members/${memberId}/lessons`, { auth: true }),
    // Görevler ve vardiyalar
    gymTasks: (options: { status?: 'open' | 'done' | 'all'; mine?: boolean } = {}) =>
      request<GymTaskItem[]>('/gym/tasks', { auth: true, query: { status: options.status ?? 'open', ...(options.mine ? { mine: 'true' } : {}) } }),
    createGymTask: (input: { title: string; assigneeId: string; dueDate?: string }) => request<{ id: string }>('/gym/tasks', { method: 'POST', body: input, auth: true }),
    removeGymTask: (id: string) => request<{ id: string }>(`/gym/tasks/${id}`, { method: 'DELETE', auth: true }),
    setGymTaskDone: (id: string, done: boolean) => request<{ id: string }>(`/gym/tasks/${id}/done`, { method: 'POST', body: { done }, auth: true }),
    gymShifts: () => request<GymShiftRow[]>('/gym/shifts', { auth: true }),
    setGymShift: (userId: string, weekday: number, shift: { start: string; end: string } | null) =>
      request<{ weekday: number }>(`/gym/shifts/${userId}/${weekday}`, { method: 'PUT', body: { shift }, auth: true }),
    myGymInvites: () => request<GymInviteItem[]>('/me/gym-invites', { auth: true }),
    acceptGymInvite: (id: string) => request<{ id: string; status: 'ACTIVE' }>(`/me/gym-invites/${id}/accept`, { method: 'POST', auth: true }),
    declineGymInvite: (id: string) => request<{ id: string; status: 'DECLINED' }>(`/me/gym-invites/${id}/decline`, { method: 'POST', auth: true }),
    leaveGym: () => request<{ id: string; status: 'ENDED' }>('/me/gym-invites/leave', { method: 'POST', auth: true }),

    // ───────────── Yönetici ─────────────
    adminApplications: (status: ApplicationStatus) =>
      request<AdminApplicationItem[]>('/admin/applications', { auth: true, query: { status } }),
    adminApplication: (id: string) => request<AdminApplicationDetail>(`/admin/applications/${id}`, { auth: true }),
    adminApprove: (id: string) => request<{ id: string; status: ApplicationStatus }>(`/admin/applications/${id}/approve`, { method: 'POST', auth: true }),
    adminReject: (id: string, reason: string) =>
      request<{ id: string; status: ApplicationStatus }>(`/admin/applications/${id}/reject`, { method: 'POST', body: { reason }, auth: true }),
    // Belgenin kendisi (yönetici). Her açılış sunucuda kayıt altına alınır.
    async adminDocument(id: string): Promise<{ mimeType: string; data: ArrayBuffer }> {
      let tokens = await config.tokens.get();
      if (!tokens) throw new ApiError(401, 'UNAUTHENTICATED', 'Oturum geçersiz. Lütfen tekrar giriş yapın.');
      let response = await send(`/admin/documents/${id}/file`, { timeoutMs: UPLOAD_TIMEOUT_MS }, tokens.accessToken);
      if (response.status === 401 && (await refreshTokens())) {
        tokens = await config.tokens.get();
        response = await send(`/admin/documents/${id}/file`, { timeoutMs: UPLOAD_TIMEOUT_MS }, tokens?.accessToken);
      }
      if (!response.ok) throw await parseError(response);
      return { mimeType: response.headers.get('content-type') ?? 'application/octet-stream', data: await response.arrayBuffer() };
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
