import { evaluate, type Session } from '../study/engine'

// Ngày theo giờ địa phương của người học (YYYY-MM-DD)
export const todayIso = () => new Date().toLocaleDateString('sv-SE')

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

// ----- Lưu kết quả một lượt học

export type SaveInfo = {
  updated: number
  counts: [number, number, number]
  streak: { current: number; best: number; inc: boolean }
}

export type SaveState =
  | { status: 'saving' }
  | { status: 'saved'; info: SaveInfo }
  | { status: 'error'; message: string }

export function saveSession(session: Session, unitIds: number[]) {
  const { evals } = evaluate(session.stats)
  return request<SaveInfo>('/api/study/finish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      today: todayIso(),
      mode: session.mode,
      unitIds,
      score: session.score,
      firstTry: session.firstTry,
      maxCombo: session.maxCombo,
      results: evals.map(({ stat, level }) => ({
        key: stat.word.key,
        level,
        wrong: stat.wrong,
        hints: stat.hints,
      })),
    }),
  })
}

// ----- Tổng quan và thống kê

export type DayStat = {
  day: string
  sessions: number
  words: number
  good: number
  mid: number
  bad: number
  score: number
}

export type Summary = {
  counts: {
    total: number
    newWords: number
    due: number
    l0: number
    l1: number
    l2: number
  }
  streak: { current: number; best: number; playedToday: boolean }
  week: boolean[] // 7 ngày gần nhất, ngày cũ nhất trước, cuối cùng là hôm nay
  days: DayStat[] // 30 ngày gần nhất có học
  weak: Array<{
    key: string
    word: string
    meaning: string
    mastery: number
    wrong: number
    hints: number
  }>
  recent: Array<{
    id: number
    mode: number
    score: number
    words: number
    created_at: string
  }>
  totals: { sessions: number; words: number }
}

export function fetchSummary() {
  return request<Summary>(`/api/progress/summary?today=${todayIso()}`)
}