interface Env {
  DB: D1Database
}

const notFound = () => Response.json({ error: 'Không tìm thấy quyển trong thư viện' }, { status: 404 })
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

type BookRow = { id: number; name: string; source_id: number; excluded_tabs: string | null }

async function findBook(db: D1Database, id: number, userId: number) {
  return db
    .prepare(
      `SELECT b.id, b.name, b.source_id, s.excluded_tabs
       FROM books b JOIN sources s ON s.id = b.source_id
       WHERE b.id = ?1 AND b.user_id = ?2`,
    )
    .bind(id, userId)
    .first<BookRow>()
}

// Ẩn hoặc hiện lại quyển
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
  if (!(await findBook(env.DB, id, userId))) return notFound()

  let body: Record<string, unknown>
  try {
    body = (await request.json()) as Record<string, unknown>
  } catch {
    return bad('Dữ liệu gửi lên không hợp lệ')
  }
  if (typeof body.archived !== 'boolean') return bad('Thiếu trạng thái ẩn hoặc hiện')

  await env.DB.prepare('UPDATE books SET archived = ?1 WHERE id = ?2 AND user_id = ?3')
    .bind(body.archived ? 1 : 0, id, userId)
    .run()
  return Response.json({ ok: true })
}

// Xóa quyển. Tên quyển được ghi nhớ để Đồng bộ lại không thêm lại; tiến trình ôn tập được giữ.
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
  const book = await findBook(env.DB, id, userId)
  if (!book) return notFound()

  const tabs = parseTabs(book.excluded_tabs)
  if (!tabs.includes(book.name)) tabs.push(book.name)

  const db = env.DB
  await db.batch([
    db
      .prepare('DELETE FROM words WHERE unit_id IN (SELECT id FROM units WHERE book_id = ?1)')
      .bind(id),
    db.prepare('DELETE FROM units WHERE book_id = ?1').bind(id),
    db.prepare('DELETE FROM books WHERE id = ?1 AND user_id = ?2').bind(id, userId),
    db
      .prepare('UPDATE sources SET excluded_tabs = ?1 WHERE id = ?2 AND user_id = ?3')
      .bind(JSON.stringify(tabs), book.source_id, userId),
  ])
  return Response.json({ ok: true })
}