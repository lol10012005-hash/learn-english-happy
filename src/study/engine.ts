// Logic học từ vựng, port từ VocabInvaders v3 (core/session.py và data/srs.py).
// File này KHÔNG dùng React, chỉ là các hàm thuần để dễ kiểm thử.

export type StudyWord = {
  id: number
  key: string
  word: string
  meaning: string
  example: string
  extra: string
  unit: string
  book: string
  due: string | null // ngày ôn kế tiếp (YYYY-MM-DD), null = từ mới
}

export type GameSettings = {
  lives: number // số lần thử mỗi từ
  points: number[] // điểm khi đúng ở lần thử 1, 2, 3...
  hintPenalty: number // hệ số điểm nếu đã dùng gợi ý
  autoHintAfterWrong: number // sai mấy lần thì tự hiện gợi ý (0 = tắt)
  autoSubmit: boolean // gõ đúng là tự chấm
  shuffle: boolean
}

export const DEFAULT_GAME: GameSettings = {
  lives: 3,
  points: [100, 60, 30],
  hintPenalty: 0.5,
  autoHintAfterWrong: 2,
  autoSubmit: true,
  shuffle: true,
}

export type MasterySettings = {
  goodPct: number
  forgotMaxPct: number
  badGoodPct: number
  badForgotPct: number
}

export const DEFAULT_MASTERY: MasterySettings = {
  goodPct: 80,
  forgotMaxPct: 10,
  badGoodPct: 40,
  badForgotPct: 40,
}

export type Level = 0 | 1 | 2 // 0 Không thuộc, 1 Chưa thuộc, 2 Đã thuộc
export const LEVEL_NAMES = ['Không thuộc', 'Chưa thuộc', 'Đã thuộc'] as const

export type Stat = {
  word: StudyWord
  wrong: number
  hints: number
  failed: boolean
  done: boolean
}

export type CardState = 'ask' | 'correct' | 'failed'
export type GameEvent = 'correct' | 'wrong' | 'fail' | 'combo' | 'done' | 'click'

export type Session = {
  settings: GameSettings
  words: StudyWord[]
  stats: Stat[]
  index: number
  state: CardState
  over: boolean
  livesLeft: number
  wrongN: number
  hintLevel: number
  cardHints: number
  score: number
  combo: number
  maxCombo: number
  firstTry: number
  bad: number
  lastPts: number
  lastBad: string
  events: GameEvent[] // sự kiện của thao tác vừa rồi (để phát âm thanh)
}

export type Rng = () => number

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function normalize(s: string): string {
  return s.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')
}

function cardReset(settings: GameSettings) {
  return {
    state: 'ask' as CardState,
    livesLeft: settings.lives,
    wrongN: 0,
    hintLevel: 0,
    cardHints: 0,
    lastPts: 0,
    lastBad: '',
  }
}

export function createSession(
  words: StudyWord[],
  settings: GameSettings = DEFAULT_GAME,
  rng: Rng = Math.random,
): Session {
  const list = settings.shuffle ? shuffle(words, rng) : [...words]
  return {
    settings,
    words: list,
    stats: list.map((word) => ({
      word,
      wrong: 0,
      hints: 0,
      failed: false,
      done: false,
    })),
    index: 0,
    over: list.length === 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    firstTry: 0,
    bad: 0,
    events: [],
    ...cardReset(settings),
  }
}

export function currentWord(s: Session): StudyWord | null {
  return s.words[s.index] ?? null
}

// Số gợi ý tối đa: hiện dần từng chữ, chừa lại ít nhất 1 chữ
export function maxHint(s: Session): number {
  const w = currentWord(s)
  return w ? Math.max(0, Array.from(w.word).length - 1) : 0
}

export function hintText(s: Session): string {
  const w = currentWord(s)
  if (!w || s.hintLevel <= 0) return ''
  const chars = Array.from(w.word)
  return `Gợi ý: ${chars.slice(0, s.hintLevel).join(' ')} …  (${chars.length} chữ)`
}

function patchStat(s: Session, patch: Partial<Stat>): Stat[] {
  return s.stats.map((st, i) => (i === s.index ? { ...st, ...patch } : st))
}

export function hint(s: Session): Session {
  if (s.over || s.state !== 'ask' || s.hintLevel >= maxHint(s)) return s
  const st = s.stats[s.index]
  return {
    ...s,
    hintLevel: s.hintLevel + 1,
    cardHints: s.cardHints + 1,
    stats: patchStat(s, { hints: st.hints + 1 }),
    events: ['click'],
  }
}

function markCorrect(s: Session): Session {
  const pts = s.settings.points.length ? s.settings.points : [100]
  const base = pts[Math.min(s.wrongN, pts.length - 1)]
  const last = Math.trunc(base * (s.cardHints > 0 ? s.settings.hintPenalty : 1))
  const combo = s.combo + 1
  const events: GameEvent[] = ['correct']
  if (combo % 5 === 0) events.push('combo')
  return {
    ...s,
    state: 'correct',
    stats: patchStat(s, { done: true }),
    lastPts: last,
    score: s.score + last,
    combo,
    maxCombo: Math.max(s.maxCombo, combo),
    firstTry: s.firstTry + (s.wrongN === 0 && s.cardHints === 0 ? 1 : 0),
    events,
  }
}

function markFailed(s: Session, events: GameEvent[]): Session {
  return {
    ...s,
    state: 'failed',
    livesLeft: 0,
    combo: 0,
    stats: patchStat(s, { failed: true, done: true }),
    events,
  }
}

function markWrong(s: Session, typed: string): Session {
  const st = s.stats[s.index]
  const next: Session = {
    ...s,
    bad: s.bad + 1,
    combo: 0,
    wrongN: s.wrongN + 1,
    livesLeft: s.livesLeft - 1,
    lastBad: typed.trim(),
    stats: patchStat(s, { wrong: st.wrong + 1 }),
    events: ['wrong'],
  }
  if (next.livesLeft <= 0) return markFailed(next, ['wrong', 'fail'])
  const after = s.settings.autoHintAfterWrong
  if (after > 0 && after <= next.wrongN && next.hintLevel < maxHint(next)) {
    // Tự gợi ý sau khi sai nhiều lần (không bị tính là xin gợi ý)
    return { ...next, hintLevel: next.hintLevel + 1 }
  }
  return next
}

// force = true khi người học nhấn Enter; false khi đang gõ (tự chấm nếu đúng)
export function checkAnswer(s: Session, input: string, force: boolean): Session {
  const w = currentWord(s)
  if (!w || s.over || s.state !== 'ask') return s
  const v = normalize(input)
  if (!v) return s
  if (v === normalize(w.word)) return markCorrect(s)
  if (force) return markWrong(s, input)
  return s
}

export function giveUp(s: Session): Session {
  if (s.over || s.state !== 'ask') return s
  return markFailed(s, ['fail'])
}

export function advance(s: Session): Session {
  if (s.over || s.state === 'ask') return s
  const index = s.index + 1
  if (index >= s.words.length) return { ...s, index, over: true, events: ['done'] }
  return { ...s, index, events: [], ...cardReset(s.settings) }
}

// ----- Đánh giá mức độ thuộc (port từ data/srs.py)

export function classify(st: Stat): Level {
  if (st.failed) return 0
  return st.wrong === 0 && st.hints === 0 ? 2 : 1
}

export type Evaluation = { stat: Stat; level: Level }

export function evaluate(stats: Stat[]): {
  evals: Evaluation[]
  counts: [number, number, number]
} {
  const counts: [number, number, number] = [0, 0, 0]
  const evals: Evaluation[] = []
  for (const stat of stats) {
    if (!stat.done) continue
    const level = classify(stat)
    evals.push({ stat, level })
    counts[level]++
  }
  // Từ yếu nhất lên đầu
  evals.sort(
    (a, b) =>
      a.level - b.level ||
      b.stat.wrong + b.stat.hints - (a.stat.wrong + a.stat.hints),
  )
  return { evals, counts }
}

export function verdict(
  counts: [number, number, number],
  m: MasterySettings = DEFAULT_MASTERY,
): Level | null {
  const n = counts[0] + counts[1] + counts[2]
  if (!n) return null
  const good = (counts[2] / n) * 100
  const bad = (counts[0] / n) * 100
  if (good >= m.goodPct && bad <= m.forgotMaxPct) return 2
  if (good < m.badGoodPct || bad >= m.badForgotPct) return 0
  return 1
}

export const VERDICTS: Record<Level, { title: string; text: string }> = {
  2: {
    title: 'ĐÃ THUỘC BÀI',
    text: 'Bạn nhớ chắc phần lớn từ. Hệ thống sẽ giãn lịch ôn các từ này.',
  },
  1: {
    title: 'CHƯA THUỘC BÀI',
    text: 'Bạn mới nhớ một phần, còn nhầm hoặc cần gợi ý. Hãy luyện lại các từ chưa thuộc.',
  },
  0: {
    title: 'KHÔNG THUỘC BÀI',
    text: 'Nhiều từ chưa vào trí nhớ. Hãy xem lại bộ từ và học lại từ đầu.',
  },
}

// ----- Chọn từ cho lượt học: từ đến hạn ôn trước, rồi đến từ mới
export function pickSession(
  deck: StudyWord[],
  today: string,
  limit: number,
  includeAll = false,
): StudyWord[] {
  const due = deck
    .filter((w) => w.due !== null && w.due <= today)
    .sort((a, b) => (a.due as string).localeCompare(b.due as string))
  const fresh = deck.filter((w) => w.due === null)
  const picked = [...due, ...fresh]
  if (includeAll) {
    const rest = deck.filter((w) => w.due !== null && w.due > today)
    picked.push(...rest)
  }
  return picked.slice(0, Math.max(1, limit))
}