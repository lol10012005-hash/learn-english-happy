import type { Cue } from './script'

export type LessonSummary = {
  id: number
  title: string
  words: number
  hasCues: boolean
  audioName: string | null
  createdAt: string
  bestScore: number | null
  attempts: number
  lastAttemptAt: string | null
}

export type Lesson = {
  id: number
  title: string
  text: string
  cues: Cue[]
  audioFileId: string | null
  audioName: string | null
  createdAt: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Lỗi máy chủ (${res.status})`,
    )
  }
  return data as T
}

export function fetchLessons() {
  return request<{ lessons: LessonSummary[] }>('/api/dictation/lessons')
}

export function fetchLesson(id: number) {
  return request<{ lesson: Lesson }>(`/api/dictation/lessons/${id}`)
}

export type CreateLessonPayload = {
  title: string
  docFileId: string
  docName: string
  audioFileId?: string // không có thì bài được đọc bằng giọng đọc của trình duyệt
  audioName?: string
  text: string
  cues: Cue[]
}

export function createLesson(payload: CreateLessonPayload) {
  return request<{ id: number }>('/api/dictation/lessons', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function deleteLesson(id: number) {
  return request<{ ok: true }>(`/api/dictation/lessons/${id}`, { method: 'DELETE' })
}

// ----- Kết quả làm bài

export type AttemptSave =
  | { status: 'saving' }
  | { status: 'saved' }
  | { status: 'error'; message: string }

export type AttemptPayload = {
  lessonId: number
  typedText: string
  listens: number
  strict: boolean
  counts: { correct: number; spelling: number; misheard: number; missing: number; extra: number }
  errors: Array<[string, string, string]> // [loại, từ gốc, từ gõ]
}

export function saveAttempt(payload: AttemptPayload) {
  return request<{ id: number; listenPct: number; typePct: number; score: number }>(
    '/api/dictation/attempts',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
  )
}

export type AttemptRow = {
  id: number
  createdAt: string
  listenPct: number
  typePct: number
  score: number
  listens: number
  strict: boolean
}

export function fetchAttempts(lessonId: number) {
  return request<{ attempts: AttemptRow[] }>(`/api/dictation/attempts?lessonId=${lessonId}`)
}