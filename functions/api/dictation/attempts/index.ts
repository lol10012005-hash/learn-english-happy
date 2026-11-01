import { scoreFromCounts, type Counts } from '../../../../src/dictation/diff'
import { countWords } from '../../../../src/dictation/script'

interface Env {
  DB: D1Database
}

const MAX_TEXT = 60_000
const MAX_ERRORS = 1000
const MAX_WORD_LEN = 200
const KEEP_ATTEMPTS = 100
const ERROR_TYPES = new Set(['spelling', 'misheard', 'missing', 'extra'])

const bad = (error: string) => Response.json({ error }, { status: 400 })
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max

type AttemptRow = {
  id: number
  created_at: string
  listen_pct: number
  type_pct: number
  score: number
  listen_count: number
  strict: number | null
}

// Lịch sử các lần làm một bài
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
  const lessonId = Number(new URL(request.url).searchParams.get('lessonId'))
  if (!Number.isInteger(lessonId) || lessonId <= 0) return bad('Thiếu mã bài')

  const { results } = await env.DB.prepare(
    `SELECT t.id, t.created_at, t.listen_pct, t.type_pct, t.score, t.listen_count,
            json_extract(t.word_results, '$.strict') AS strict
     FROM dictation_attempts t
     WHERE t.lesson_id = ?1 AND t.user_id = ?2
     ORDER BY t.id DESC
     LIMIT 20`,
  )
    .bind(lessonId, userId)
    .all<AttemptRow>()

  return Response.json({
    attempts: results.map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      listenPct: r.listen_pct,
      typePct: r.type_pct,
      score: r.score,
      listens: r.listen_count,
      strict: r.strict === 1,
    })),
  })
}

// Lưu một lần nộp bài. Việc chấm điểm chạy ở trình duyệt; máy chủ kiểm tra tính hợp lệ
// và tự tính lại các phần trăm từ số đếm để công thức luôn thống nhất.
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

  const lessonId = body.lessonId
  if (!isInt(lessonId, 1, 2_000_000_000)) return bad('Thiếu mã bài')
  const typedText = typeof body.typedText === 'string' ? body.typedText : ''
  if (typedText.length > MAX_TEXT) return bad('Bài gõ quá dài')
  const listens = isInt(body.listens, 0, 9999) ? body.listens : 0
  const strict = body.strict === true

  const c = body.counts as Record<string, unknown> | undefined
  if (
    !c ||
    !isInt(c.correct, 0, 100_000) ||
    !isInt(c.spelling, 0, 100_000) ||
    !isInt(c.misheard, 0, 100_000) ||
    !isInt(c.missing, 0, 100_000) ||
    !isInt(c.extra, 0, 100_000)
  ) {
    return bad('Kết quả chấm không hợp lệ')
  }
  const counts: Counts = {
    correct: c.correct,
    spelling: c.spelling,
    misheard: c.misheard,
    missing: c.missing,
    extra: c.extra,
  }

  const lesson = await db
    .prepare('SELECT original_text FROM dictation_lessons WHERE id = ?1 AND user_id = ?2')
    .bind(lessonId, userId)
    .first<{ original_text: string }>()
  if (!lesson) {
    return Response.json({ error: 'Không tìm thấy bài nghe chép' }, { status: 404 })
  }

  const pct = scoreFromCounts(counts)
  if (pct.total !== countWords(lesson.original_text)) {
    return bad('Kết quả chấm không khớp với bài (văn bản gốc có thể đã thay đổi)')
  }
  if (counts.extra > countWords(typedText)) return bad('Kết quả chấm không hợp lệ')

  // Chỉ lưu danh sách lỗi (không lưu các từ đúng) để dùng cho thống kê và ôn tập
  const errors: Array<[string, string, string]> = []
  if (Array.isArray(body.errors)) {
    for (const e of body.errors.slice(0, MAX_ERRORS)) {
      if (
        !Array.isArray(e) ||
        typeof e[0] !== 'string' ||
        !ERROR_TYPES.has(e[0]) ||
        typeof e[1] !== 'string' ||
        typeof e[2] !== 'string'
      ) {
        return bad('Danh sách lỗi không hợp lệ')
      }
      errors.push([e[0], e[1].slice(0, MAX_WORD_LEN), e[2].slice(0, MAX_WORD_LEN)])
    }
  }

  const result = await db
    .prepare(
      `INSERT INTO dictation_attempts
         (lesson_id, user_id, typed_text, word_results, listen_pct, type_pct, score, listen_count)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
    )
    .bind(
      lessonId,
      userId,
      typedText,
      JSON.stringify({ v: 1, strict, counts, errors }),
      pct.listenPct,
      pct.typePct,
      pct.score,
      listens,
    )
    .run()

  // Chỉ giữ các lần làm gần nhất của mỗi bài
  await db
    .prepare(
      `DELETE FROM dictation_attempts
       WHERE lesson_id = ?1 AND user_id = ?2
         AND id NOT IN (
           SELECT id FROM dictation_attempts
           WHERE lesson_id = ?1 AND user_id = ?2 ORDER BY id DESC LIMIT ${KEEP_ATTEMPTS}
         )`,
    )
    .bind(lessonId, userId)
    .run()

  return Response.json({
    id: result.meta.last_row_id,
    listenPct: pct.listenPct,
    typePct: pct.typePct,
    score: pct.score,
  })
}