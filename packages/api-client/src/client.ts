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
  FindingDecision,
  FindingItem,
  FindingsResponse,
  GoalItem,
  GoalStatus,
  IntakeQuestionType,
  MeasurementInput,
  MeasurementItem,
  MeasurementKind,
  MyAppointment,
  MyGoal,
  MyPlanListItem,
  MyPlanView,
  NoteItem,
  PlanCheck,
  PlanContent,
  PlanOverview,
  ProAppointment,
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
