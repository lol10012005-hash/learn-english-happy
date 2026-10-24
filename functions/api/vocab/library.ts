interface Env {
  DB: D1Database
}

type Row = {
  source_id: number
  source_name: string
  google_file_id: string
  last_synced_at: string | null
  book_id: number
  book_name: string
  column_mapping: string | null
  unit_id: number | null
  unit_name: string | null
  word_count: number
}

type Unit = { id: number; name: string; count: number }
type Book = { id: number; name: string; mapping: unknown; units: Unit[] }
type Source = {
  id: number
  name: string
  fileId: string
  lastSyncedAt: string | null
  books: Book[]
}

function parseMapping(text: string | null): unknown {
  try {
    return text ? JSON.parse(text) : {}
  } catch {
    return {}
  }
}

export const onRequestGet = async ({
  env,
  data,
}: {
  env: Env
  data: Record<string, unknown>
}) => {
  const userId = data.userId as number

  const { results } = await env.DB.prepare(
    `SELECT s.id AS source_id, s.name AS source_name, s.google_file_id,
            s.last_synced_at, b.id AS book_id, b.name AS book_name,
            b.column_mapping, u.id AS unit_id, u.name AS unit_name,
            COUNT(w.id) AS word_count
     FROM books b
     JOIN sources s ON s.id = b.source_id
     LEFT JOIN units u ON u.book_id = b.id
     LEFT JOIN words w ON w.unit_id = u.id
     WHERE b.user_id = ?1
     GROUP BY b.id, u.id
     ORDER BY s.id, b.position, u.position`,
  )
    .bind(userId)
    .all<Row>()

  const sources: Source[] = []
  for (const r of results) {
    let source = sources.find((s) => s.id === r.source_id)
    if (!source) {
      source = {
        id: r.source_id,
        name: r.source_name,
        fileId: r.google_file_id,
        lastSyncedAt: r.last_synced_at,
        books: [],
      }
      sources.push(source)
    }
    let book = source.books.find((b) => b.id === r.book_id)
    if (!book) {
      book = {
        id: r.book_id,
        name: r.book_name,
        mapping: parseMapping(r.column_mapping),
        units: [],
      }
      source.books.push(book)
    }
    if (r.unit_id !== null && r.unit_name !== null) {
      book.units.push({ id: r.unit_id, name: r.unit_name, count: r.word_count })
    }
  }

  return Response.json({ sources })
}