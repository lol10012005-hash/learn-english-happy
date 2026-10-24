// Lặp lại ngắt quãng SM-2 và chuỗi ngày học, port từ data/srs.py và data/storage.py.
// Chạy được cả ở trình duyệt lẫn ở máy chủ (không dùng React hay DOM).

import type { Level } from './engine'

export type Progress = { ef: number; reps: number; iv: number }
export type NextProgress = Progress & { due: string }

export const NEW_PROGRESS: Progress = { ef: 2.5, reps: 0, iv: 0 }

// Làm tròn kiểu Python (.5 làm tròn về số chẵn) để lịch ôn khớp bản desktop
export function roundHalfEven(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d < 0.5) return f
  if (d > 0.5) return f + 1
  return f % 2 === 0 ? f : f + 1
}

export function isIsoDate(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = new Date(s + 'T00:00:00Z')
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10)
}

// SM-2: q = 5 (đã thuộc), 3 (chưa thuộc), 1 (không thuộc)
export function nextProgress(
  prev: Progress | null,
  level: Level,
  today: string,
): NextProgress {
  const q = [1, 3, 5][level]
  let { ef, reps, iv } = prev ?? NEW_PROGRESS
  if (q < 3) {
    reps = 0
    iv = 1
  } else {
    reps += 1
    iv = reps === 1 ? 1 : reps === 2 ? 6 : Math.max(1, roundHalfEven(iv * ef))
  }
  ef = Math.max(1.3, ef + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  ef = Number(ef.toFixed(3))
  return { ef, reps, iv, due: addDays(today, iv) }
}

// ----- Chuỗi ngày học (streak)

export type StreakState = { last: string | null; count: number; best: number }

export function streakNow(s: StreakState, today: string): number {
  return s.last === today || s.last === addDays(today, -1) ? s.count : 0
}

// Ghi nhận hôm nay đã học. inc = true nếu đây là lần đầu trong ngày.
export function touchStreak(
  s: StreakState,
  today: string,
): { state: StreakState; inc: boolean } {
  if (s.last === today) return { state: s, inc: false }
  const count = s.last === addDays(today, -1) ? s.count + 1 : 1
  return { state: { last: today, count, best: Math.max(s.best, count) }, inc: true }
}