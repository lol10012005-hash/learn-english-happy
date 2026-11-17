interface Env {
  DB: D1Database
}

const notFound = () => Response.json({ error: 'Không tìm thấy file trong thư viện' }, { status: 404 })
const bad = (error: string) => Response.json({ error }, { status: 400 })

const parseId = (value: unknown): number | null => {
  const id = Number(value)
  return Number.isInteger(id) && id > 0 ? id : null
}

function parseTabs(text: string | null): string[] {
  try {
    const v = text ? JSON.parse(text) : []
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
  } catch {
    return []
  }
}

async function findSource(db: D1Database, id: number, userId: number) {
  return db
    .prepare(
      "SELECT id, excluded_tabs FROM sources WHERE id = ?1 AND user_id = ?2 AND kind = 'sheet'",
    )
    .bind(id, userId)
    .first<{ id: number; excluded_tabs: string | null }>()
}

// Ẩn hoặc hiện lại file, hoặc thêm lại một quyển đã xóa
export const onRequestPatch = async ({
  request,
  env,
  data,
  params,
}: {
  request: Request
  env: Env
  data: Record<string, unknown>
  params: Record<string, string>
}) => {
  const userId = data.userId as number
  const id = parseId(params.id)
  if (!id) return notFound()
  const source = await findSource(env.DB, id, userId)
  if (!source) return notFound()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad('Dữ liệu gửi lên không hợp lệ')
  }

  if (typeof body.archived === 'boolean') {
    await env.DB.prepare('UPDATE sources SET archived = ?1 WHERE id = ?2 AND user_id = ?3')
      .bind(body.archived ? 1 : 0, id, userId)
      .run()
  }
  if (typeof body.restoreTab === 'string') {
    const tabs = parseTabs(source.excluded_tabs).filter((t) => t !== body.restoreTab)
    await env.DB.prepare('UPDATE sources SET excluded_tabs = ?1 WHERE id = ?2 AND user_id = ?3')
      .bind(JSON.stringify(tabs), id, userId)
      .run()
  }
  return Response.json({ ok: true })
}

// Xóa file khỏi thư viện (không đụng tới file Google Sheet và tiến trình ôn tập)
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
  if (!(await findSource(env.DB, id, userId))) return notFound()

  const db = env.DB
  await db.batch([
    db
      .prepare(
        `DELETE FROM words WHERE unit_id IN (
           SELECT u.id FROM units u JOIN books b ON b.id = u.book_id WHERE b.source_id = ?1)`,
      )
      .bind(id),
    db
      .prepare(
        'DELETE FROM units WHERE book_id IN (SELECT id FROM books WHERE source_id = ?1)',
      )
      .bind(id),
    db.prepare('DELETE FROM books WHERE source_id = ?1').bind(id),
    db.prepare('DELETE FROM sources WHERE id = ?1 AND user_id = ?2').bind(id, userId),
  ])
  return Response.json({ ok: true })
}