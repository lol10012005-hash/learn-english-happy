interface Env {
  DB: D1Database
}

type Row = {
  id: number
  title: string
  original_text: string
  timestamps: string | null
  created_at: string
  audio_file_id: string | null
  audio_name: string | null
}

const parseId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

const notFound = () =>
  Response.json({ error: 'Không tìm thấy bài nghe chép' }, { status: 404 })

function parseCues(text: string | null): unknown[] {
  try {
    const v = text ? JSON.parse(text) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

export const onRequestGet = async ({
  env,
  data,
  params,
}: {
  env: Env
  data: Record<string, unknown>
  params: Record<string, string>
}) => {
  const userId = data.userId as number
  const id = parseId(params.id)
  if (!id) return notFound()

  const row = await env.DB.prepare(
    `SELECT l.id, l.title, l.original_text, l.timestamps, l.created_at,
            a.google_file_id AS audio_file_id, a.name AS audio_name
     FROM dictation_lessons l
     LEFT JOIN sources a ON a.id = l.audio_source_id
     WHERE l.id = ?1 AND l.user_id = ?2`,
  )
    .bind(id, userId)
    .first<Row>()
  if (!row) return notFound()

  return Response.json({
    lesson: {
      id: row.id,
      title: row.title,
      text: row.original_text,
      cues: parseCues(row.timestamps),
      audioFileId: row.audio_file_id,
      audioName: row.audio_name,
      createdAt: row.created_at,
    },
  })
}

export const onRequestDelete = async ({
  env,
  data,
  params,
}: {
  env: Env
  data: Record<string, unknown>
  params: Record<string, string>
}) => {
  const userId = data.userId as number
  const id = parseId(params.id)
  if (!id) return notFound()

  const result = await env.DB.prepare(
    'DELETE FROM dictation_lessons WHERE id = ?1 AND user_id = ?2',
  )
    .bind(id, userId)
    .run()
  if (!result.meta.changes) return notFound()
  return Response.json({ ok: true })
}