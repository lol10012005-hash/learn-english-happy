import { countWords } from '../../../../src/dictation/script'

interface Env {
  DB: D1Database
}

type Row = {
  id: number
  title: string
  original_text: string
  timestamps: string | null
  created_at: string
  audio_name: string | null
}

const MAX_LESSONS = 200
const MAX_TEXT = 60_000
const MAX_CUES = 1000

const bad = (error: string) => Response.json({ error }, { status: 400 })
const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

export const onRequestGet = async ({
  env,
  data,
}: {
  env: Env
  data: Record<string, unknown>
}) => {
  const userId = data.userId as number
  const { results } = await env.DB.prepare(
    `SELECT l.id, l.title, l.original_text, l.timestamps, l.created_at,
            a.name AS audio_name
     FROM dictation_lessons l
     LEFT JOIN sources a ON a.id = l.audio_source_id
     WHERE l.user_id = ?1
     ORDER BY l.id DESC
     LIMIT ${MAX_LESSONS}`,
  )
    .bind(userId)
    .all<Row>()

  return Response.json({
    lessons: results.map((r) => ({
      id: r.id,
      title: r.title,
      words: countWords(r.original_text),
      hasCues: !!r.timestamps && r.timestamps !== '[]',
      audioName: r.audio_name,
      createdAt: r.created_at,
    })),
  })
}

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

  const title = str(body.title, 120)
  const docFileId = str(body.docFileId, 200)
  const docName = str(body.docName, 300) || 'Không tên'
  const audioFileId = str(body.audioFileId, 200)
  const audioName = str(body.audioName, 300) || 'Không tên'
  const text = typeof body.text === 'string' ? body.text.trim() : ''

  if (!title) return bad('Hãy đặt tên cho bài')
  if (!docFileId) return bad('Thiếu file Google Docs')
  if (!text) return bad('Văn bản gốc đang trống')
  if (text.length > MAX_TEXT) return bad('Văn bản quá dài (tối đa 60.000 ký tự)')

  const cues: Array<{ t: number; text: string }> = []
  if (Array.isArray(body.cues)) {
    if (body.cues.length > MAX_CUES) return bad('Quá nhiều mốc thời gian')
    for (const c of body.cues as Array<Record<string, unknown>>) {
      const t = c?.t
      if (typeof t !== 'number' || !Number.isFinite(t) || t < 0 || t > 86_400) {
        return bad('Mốc thời gian không hợp lệ')
      }
      cues.push({ t, text: str(c.text, 2000) })
    }
  }

  const count = await db
    .prepare('SELECT COUNT(*) AS n FROM dictation_lessons WHERE user_id = ?1')
    .bind(userId)
    .first<{ n: number }>()
  if ((count?.n ?? 0) >= MAX_LESSONS) {
    return bad(`Mỗi người tối đa ${MAX_LESSONS} bài nghe chép. Hãy xóa bớt bài cũ.`)
  }

  // File audio là tùy chọn: không có thì bài được đọc bằng giọng đọc của trình duyệt
  const upsertSource = async (kind: 'doc' | 'audio', fileId: string, name: string) => {
    await db
      .prepare(
        `INSERT INTO sources (user_id, kind, google_file_id, name, last_synced_at)
         VALUES (?1, ?2, ?3, ?4, datetime('now'))
         ON CONFLICT(user_id, google_file_id) DO UPDATE
         SET name = excluded.name, last_synced_at = excluded.last_synced_at`,
      )
      .bind(userId, kind, fileId, name)
      .run()
    const row = await db
      .prepare('SELECT id FROM sources WHERE user_id = ?1 AND google_file_id = ?2')
      .bind(userId, fileId)
      .first<{ id: number }>()
    return row?.id ?? null
  }

  const docSourceId = await upsertSource('doc', docFileId, docName)
  const audioSourceId = audioFileId
    ? await upsertSource('audio', audioFileId, audioName)
    : null
  if (docSourceId === null || (audioFileId && audioSourceId === null)) {
    return Response.json({ error: 'Không lưu được file nguồn' }, { status: 500 })
  }

  const result = await db
    .prepare(
      `INSERT INTO dictation_lessons
         (user_id, title, doc_source_id, audio_source_id, original_text, timestamps)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
    )
    .bind(
      userId,
      title,
      docSourceId,
      audioSourceId,
      text,
      cues.length > 0 ? JSON.stringify(cues) : null,
    )
    .run()

  return Response.json({ id: result.meta.last_row_id })
}