import type { Level } from '../../../src/study/engine'
import {
  isIsoDate,
  nextProgress,
  streakNow,
  touchStreak,
  type Progress,
  type StreakState,
} from '../../../src/study/srs'

interface Env {
  DB: D1Database
}

type Item = { key: string; level: Level; wrong: number; hints: number }

const MAX_RESULTS = 200
const KEY_CHUNK = 80 // D1 chỉ cho tối đa 100 tham số mỗi câu lệnh

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

const bad = (error: string) => Response.json({ error }, { status: 400 })

export const onRequestPost = async ({
  request,
  env,
  data,
}: {
  request: Request
  env: Env
  data: Record<string, unknown>
}) => {
  const userId = data.userId as number
  const db = env.DB

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad('Dữ liệu gửi lên không hợp lệ')
  }

  // Ngày theo giờ địa phương của người học, chỉ nhận ngày gần với ngày của máy chủ
  const today = body.today
  if (
    !isIsoDate(today) ||
    Math.abs(Date.parse(today + 'T00:00:00Z') - Date.now()) > 2 * 86_400_000
  ) {
    return bad('Ngày không hợp lệ')
  }
  const mode = body.mode
  if (!isInt(mode, 1, 3)) return bad('Chế độ học không hợp lệ')
  const score = isInt(body.score, 0, 1_000_000) ? body.score : 0

  if (!Array.isArray(body.results) || body.results.length === 0) {
    return bad('Chưa có kết quả nào để lưu')
  }
  if (body.results.length > MAX_RESULTS) {
    return bad(`Mỗi lượt tối đa ${MAX_RESULTS} từ`)
  }

  // Làm sạch kết quả, mỗi từ chỉ tính một lần trong một lượt
  const byKey = new Map<string, Item>()
  for (const raw of body.results as Array<Record<string, unknown>>) {
    const key = typeof raw?.key === 'string' ? raw.key.slice(0, 64) : ''
    if (!key || !isInt(raw.level, 0, 2)) return bad('Kết quả không hợp lệ')
    byKey.set(key, {
      key,
      level: raw.level as Level,
      wrong: isInt(raw.wrong, 0, 99) ? raw.wrong : 0,
      hints: isInt(raw.hints, 0, 99) ? raw.hints : 0,
    })
  }
  const items = [...byKey.values()]
  const counts = [0, 0, 0]
  for (const it of items) counts[it.level]++

  const unitIds = Array.isArray(body.unitIds)
    ? body.unitIds.filter((n): n is number => isInt(n, 1, 2_000_000_000)).slice(0, 100)
    : []

  // Tiến trình hiện có của các từ trong lượt này
  const prev = new Map<string, Progress>()
  for (let i = 0; i < items.length; i += KEY_CHUNK) {
    const part = items.slice(i, i + KEY_CHUNK).map((it) => it.key)
    const placeholders = part.map((_, j) => `?${j + 2}`).join(',')
    const { results } = await db
      .prepare(
        `SELECT word_key, ef, reps, iv FROM word_progress
         WHERE user_id = ?1 AND word_key IN (${placeholders})`,
      )
      .bind(userId, ...part)
      .all<{ word_key: string; ef: number; reps: number; iv: number }>()
    for (const r of results) {
      prev.set(r.word_key, { ef: r.ef, reps: r.reps, iv: r.iv })
    }
  }

  // Chuỗi ngày học: cần trả lời đúng ít nhất 1 từ
  const row = await db
    .prepare(
      'SELECT last_study_date, current_streak, best_streak FROM streaks WHERE user_id = ?1',
    )
    .bind(userId)
    .first<{ last_study_date: string | null; current_streak: number; best_streak: number }>()
  const before: StreakState = {
    last: row?.last_study_date ?? null,
    count: row?.current_streak ?? 0,
    best: row?.best_streak ?? 0,
  }
  const played = items.some((it) => it.level >= 1)
  const touched = played ? touchStreak(before, today) : { state: before, inc: false }

  // Ghi tất cả trong một lần (hoặc thành công hết, hoặc không ghi gì)
  const stmts: D1PreparedStatement[] = []
  for (const it of items) {
    const next = nextProgress(prev.get(it.key) ?? null, it.level, today)
    stmts.push(
      db
        .prepare(
          `INSERT INTO word_progress
             (user_id, word_key, ef, reps, iv, due, mastery, wrong_count, hint_count)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
           ON CONFLICT(user_id, word_key) DO UPDATE SET
             ef = excluded.ef, reps = excluded.reps, iv = excluded.iv,
             due = excluded.due, mastery = excluded.mastery,
             wrong_count = word_progress.wrong_count + excluded.wrong_count,
             hint_count = word_progress.hint_count + excluded.hint_count`,
        )
        .bind(userId, it.key, next.ef, next.reps, next.iv, next.due, it.level, it.wrong, it.hints),
    )
  }

  stmts.push(
    db
      .prepare(
        `INSERT INTO study_sessions (user_id, mode, unit_scope, score, results, words)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        userId,
        mode,
        JSON.stringify(unitIds),
        score,
        JSON.stringify(items.map((it) => [it.key, it.level, it.wrong, it.hints])),
        items.length,
      ),
  )

  stmts.push(
    db
      .prepare(
        `INSERT INTO study_days (user_id, day, sessions, words, good, mid, bad, score)
         VALUES (?1, ?2, 1, ?3, ?4, ?5, ?6, ?7)
         ON CONFLICT(user_id, day) DO UPDATE SET
           sessions = study_days.sessions + 1,
           words = study_days.words + excluded.words,
           good = study_days.good + excluded.good,
           mid = study_days.mid + excluded.mid,
           bad = study_days.bad + excluded.bad,
           score = study_days.score + excluded.score`,
      )
      .bind(userId, today, items.length, counts[2], counts[1], counts[0], score),
  )

  if (touched.inc) {
    stmts.push(
      db
        .prepare(
          `INSERT INTO streaks (user_id, last_study_date, current_streak, best_streak)
           VALUES (?1, ?2, ?3, ?4)
           ON CONFLICT(user_id) DO UPDATE SET
             last_study_date = excluded.last_study_date,
             current_streak = excluded.current_streak,
             best_streak = excluded.best_streak`,
        )
        .bind(userId, touched.state.last, touched.state.count, touched.state.best),
    )
  }

  await db.batch(stmts)

  return Response.json({
    updated: items.length,
    counts, // [không thuộc, chưa thuộc, đã thuộc]
    streak: {
      current: streakNow(touched.state, today),
      best: touched.state.best,
      inc: touched.inc,
    },
  })
}