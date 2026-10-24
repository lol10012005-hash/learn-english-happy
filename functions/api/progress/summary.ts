import { addDays, isIsoDate, streakNow } from '../../../src/study/srs'

interface Env {
  DB: D1Database
}

const MINE = `mine AS (
  SELECT DISTINCT w.word_key
  FROM words w
  JOIN units u ON u.id = w.unit_id
  JOIN books b ON b.id = u.book_id
  WHERE b.user_id = ?1
)`

type DayRow = {
  day: string
  sessions: number
  words: number
  good: number
  mid: number
  bad: number
  score: number
}

export const onRequestGet = async ({
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

  const today = new URL(request.url).searchParams.get('today')
  if (!isIsoDate(today)) {
    return Response.json({ error: 'Ngày không hợp lệ' }, { status: 400 })
  }
  const from = addDays(today, -29)

  const [total, levels, streakRows, days, weak, recent, totals] = await db.batch([
    db.prepare(`WITH ${MINE} SELECT COUNT(*) AS n FROM mine`).bind(userId),
    db
      .prepare(
        `WITH ${MINE}
         SELECT COUNT(*) AS studied,
                COALESCE(SUM(CASE WHEN p.mastery = 0 THEN 1 ELSE 0 END), 0) AS l0,
                COALESCE(SUM(CASE WHEN p.mastery = 1 THEN 1 ELSE 0 END), 0) AS l1,
                COALESCE(SUM(CASE WHEN p.mastery = 2 THEN 1 ELSE 0 END), 0) AS l2,
                COALESCE(SUM(CASE WHEN p.due <= ?2 THEN 1 ELSE 0 END), 0) AS due
         FROM mine m
         JOIN word_progress p ON p.user_id = ?1 AND p.word_key = m.word_key`,
      )
      .bind(userId, today),
    db
      .prepare(
        'SELECT last_study_date, current_streak, best_streak FROM streaks WHERE user_id = ?1',
      )
      .bind(userId),
    db
      .prepare(
        `SELECT day, sessions, words, good, mid, bad, score FROM study_days
         WHERE user_id = ?1 AND day >= ?2 AND day <= ?3 ORDER BY day`,
      )
      .bind(userId, from, today),
    db
      .prepare(
        `SELECT p.word_key AS key, MIN(w.word) AS word, MIN(w.meaning) AS meaning,
                p.mastery AS mastery, p.wrong_count AS wrong, p.hint_count AS hints
         FROM word_progress p
         JOIN words w ON w.word_key = p.word_key
         JOIN units u ON u.id = w.unit_id
         JOIN books b ON b.id = u.book_id AND b.user_id = p.user_id
         WHERE p.user_id = ?1 AND p.wrong_count + p.hint_count > 0
         GROUP BY p.word_key
         ORDER BY p.wrong_count + p.hint_count DESC, p.word_key
         LIMIT 10`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT id, mode, score, words, created_at FROM study_sessions
         WHERE user_id = ?1 ORDER BY id DESC LIMIT 5`,
      )
      .bind(userId),
    db
      .prepare(
        `SELECT COUNT(*) AS sessions, COALESCE(SUM(words), 0) AS words
         FROM study_sessions WHERE user_id = ?1`,
      )
      .bind(userId),
  ])

  const totalWords = (total.results[0] as { n: number }).n
  const lv = levels.results[0] as {
    studied: number
    l0: number
    l1: number
    l2: number
    due: number
  }
  const s = streakRows.results[0] as
    | { last_study_date: string | null; current_streak: number; best_streak: number }
    | undefined
  const streak = {
    last: s?.last_study_date ?? null,
    count: s?.current_streak ?? 0,
    best: s?.best_streak ?? 0,
  }

  const dayRows = days.results as DayRow[]
  const studiedDays = new Set(dayRows.map((d) => d.day))
  const week = Array.from({ length: 7 }, (_, i) => studiedDays.has(addDays(today, i - 6)))

  return Response.json({
    counts: {
      total: totalWords,
      newWords: Math.max(0, totalWords - lv.studied),
      due: lv.due,
      l0: lv.l0,
      l1: lv.l1,
      l2: lv.l2,
    },
    streak: {
      current: streakNow(streak, today),
      best: streak.best,
      playedToday: streak.last === today,
    },
    week,
    days: dayRows,
    weak: weak.results,
    recent: recent.results,
    totals: totals.results[0],
  })
}