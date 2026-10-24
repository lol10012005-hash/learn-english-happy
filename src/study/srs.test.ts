import { describe, expect, it } from 'vitest'
import type { Level } from './engine'
import {
  addDays, isIsoDate, nextProgress, roundHalfEven, streakNow, touchStreak,
  type Progress, type StreakState,
} from './srs'

// Giá trị chuẩn lấy từ chính mã Python của VocabInvaders v3 (data/srs.py)
const run = (levels: Level[]) => {
  let p: Progress | null = null
  return levels.map((l) => {
    const n = nextProgress(p, l, '2026-10-24')
    p = n
    return [n.ef, n.reps, n.iv]
  })
}

describe('SM-2 khớp bản Python', () => {
  it('thuộc liên tục', () => {
    expect(run([2, 2, 2, 2, 2, 2, 2, 2, 2])).toEqual([
      [2.6, 1, 1], [2.7, 2, 6], [2.8, 3, 16], [2.9, 4, 45], [3.0, 5, 130],
      [3.1, 6, 390], [3.2, 7, 1209], [3.3, 8, 3869], [3.4, 9, 12768],
    ])
  })
  it('có lúc chưa thuộc', () => {
    expect(run([2, 2, 1, 2, 2, 2])).toEqual([
      [2.6, 1, 1], [2.7, 2, 6], [2.56, 3, 16], [2.66, 4, 41], [2.76, 5, 109], [2.86, 6, 301],
    ])
  })
  it('quên thì quay lại từ đầu', () => {
    expect(run([0, 2, 2, 2, 0, 1])).toEqual([
      [1.96, 0, 1], [2.06, 1, 1], [2.16, 2, 6], [2.26, 3, 13], [1.72, 0, 1], [1.58, 1, 1],
    ])
  })
  it('chưa thuộc liên tục', () => {
    expect(run([1, 1, 1, 1, 1])).toEqual([
      [2.36, 1, 1], [2.22, 2, 6], [2.08, 3, 13], [1.94, 4, 27], [1.8, 5, 52],
    ])
  })
  it('hệ số EF không xuống dưới 1.3', () => {
    expect(run([2, 2, 2, 0, 0, 0, 0, 0, 0]).slice(3)).toEqual([
      [2.26, 0, 1], [1.72, 0, 1], [1.3, 0, 1], [1.3, 0, 1], [1.3, 0, 1], [1.3, 0, 1],
    ])
  })
  it('ngày ôn = hôm nay + khoảng cách', () => {
    expect(nextProgress(null, 2, '2026-10-24').due).toBe('2026-10-25')
    expect(nextProgress({ ef: 2.5, reps: 1, iv: 1 }, 2, '2026-10-24').due).toBe('2026-10-30')
    expect(nextProgress(null, 0, '2026-12-31').due).toBe('2027-01-01')
  })
})

describe('làm tròn kiểu Python', () => {
  it('.5 làm tròn về số chẵn', () => {
    expect([0.5, 1.5, 2.5, 130.5, 12.4, 12.6].map(roundHalfEven)).toEqual([0, 2, 2, 130, 12, 13])
  })
})

describe('ngày tháng', () => {
  it('addDays qua tháng, năm, năm nhuận', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29')
  })
  it('isIsoDate', () => {
    expect(isIsoDate('2026-10-24')).toBe(true)
    expect(isIsoDate('2026-02-30')).toBe(false)
    expect(isIsoDate('24/10/2026')).toBe(false)
    expect(isIsoDate(20261024)).toBe(false)
  })
})

describe('streak', () => {
  const s0: StreakState = { last: null, count: 0, best: 0 }
  it('ngày đầu tiên bắt đầu chuỗi 1', () => {
    const r = touchStreak(s0, '2026-10-24')
    expect(r).toEqual({ state: { last: '2026-10-24', count: 1, best: 1 }, inc: true })
  })
  it('học lại trong cùng ngày không tăng', () => {
    const s = { last: '2026-10-24', count: 3, best: 5 }
    expect(touchStreak(s, '2026-10-24')).toEqual({ state: s, inc: false })
  })
  it('học ngày liên tiếp thì tăng, cập nhật kỷ lục', () => {
    const r = touchStreak({ last: '2026-10-23', count: 5, best: 5 }, '2026-10-24')
    expect(r.state).toEqual({ last: '2026-10-24', count: 6, best: 6 })
  })
  it('bỏ một ngày thì chuỗi về 1 nhưng giữ kỷ lục', () => {
    const r = touchStreak({ last: '2026-10-22', count: 9, best: 9 }, '2026-10-24')
    expect(r.state).toEqual({ last: '2026-10-24', count: 1, best: 9 })
  })
  it('streakNow: còn hiệu lực hôm nay hoặc hôm qua, quá hạn thì 0', () => {
    expect(streakNow({ last: '2026-10-24', count: 4, best: 4 }, '2026-10-24')).toBe(4)
    expect(streakNow({ last: '2026-10-23', count: 4, best: 4 }, '2026-10-24')).toBe(4)
    expect(streakNow({ last: '2026-10-22', count: 4, best: 4 }, '2026-10-24')).toBe(0)
  })
})