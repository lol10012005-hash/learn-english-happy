interface Env {
  DB: D1Database
}

type WordIn = {
  key?: unknown
  unit?: unknown
  word?: unknown
  meaning?: unknown
  example?: unknown
  extra?: unknown
}

type Clean = {
  key: string
  unit: string
  word: string
  meaning: string
  example: string
  extra: string
  position: number
}

type ExistingRow = {
  id: number
  word_key: string
  unit: string
  word: string
  meaning: string
  example: string | null
  extra: string | null
  position: number
}

const MAX_WORDS = 3000
const CHUNK = 100

const str = (v: unknown, max: number) =>
  typeof v === 'string' ? v.trim().slice(0, max) : ''

async function runBatches(db: D1Database, stmts: D1PreparedStatement[]) {
  for (let i = 0; i < stmts.length; i += CHUNK) {
    await db.batch(stmts.slice(i, i + CHUNK))
  }
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

  let body: {
    fileId?: unknown
    fileName?: unknown
    bookName?: unknown
    position?: unknown
    mapping?: unknown
    words?: WordIn[]
    deleteMissing?: unknown
  }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ' }, { status: 400 })
  }

  const fileId = str(body.fileId, 200)
  const fileName = str(body.fileName, 300) || 'Không tên'
  const bookName = str(body.bookName, 200)
  if (!fileId || !bookName || !Array.isArray(body.words)) {
    return Response.json({ error: 'Thiếu thông tin quyển' }, { status: 400 })
  }
  if (body.words.length > MAX_WORDS) {
    return Response.json(
      { error: `Mỗi quyển tối đa ${MAX_WORDS} từ. Hãy tách thành nhiều tab.` },
      { status: 400 },
    )
  }

  // Làm sạch dữ liệu, bỏ từ trùng khóa
  const incoming = new Map<string, Clean>()
  body.words.forEach((w, i) => {
    const item: Clean = {
      key: str(w.key, 64),
      unit: str(w.unit, 200),
      word: str(w.word, 300),
      meaning: str(w.meaning, 1000),
      example: str(w.example, 1000),
      extra: str(w.extra, 1000),
      position: i,
    }
    if (item.key && item.unit && item.word && item.meaning) {
      incoming.set(item.key, item)
    }
  })
  if (incoming.size === 0) {
    return Response.json({ error: 'Quyển này không có từ hợp lệ' }, { status: 400 })
  }

  const mappingJson = JSON.stringify(body.mapping ?? {}).slice(0, 500)
  const deleteMissing = body.deleteMissing === true
  const bookPosition = Number.isInteger(body.position) ? (body.position as number) : 0

  // 1. File nguồn
  await db
    .prepare(
      `INSERT INTO sources (user_id, kind, google_file_id, name, last_synced_at)
       VALUES (?1, 'sheet', ?2, ?3, datetime('now'))
       ON CONFLICT(user_id, google_file_id) DO UPDATE
       SET name = excluded.name, last_synced_at = excluded.last_synced_at`,
    )
    .bind(userId, fileId, fileName)
    .run()
  const source = await db
    .prepare('SELECT id FROM sources WHERE user_id = ?1 AND google_file_id = ?2')
    .bind(userId, fileId)
    .first<{ id: number }>()
  if (!source) {
    return Response.json({ error: 'Không lưu được file nguồn' }, { status: 500 })
  }

  // 2. Quyển
  await db
    .prepare(
      `INSERT INTO books (user_id, source_id, name, position, column_mapping)
       VALUES (?1, ?2, ?3, ?4, ?5)
       ON CONFLICT(source_id, name) DO UPDATE
       SET position = excluded.position, column_mapping = excluded.column_mapping`,
    )
    .bind(userId, source.id, bookName, bookPosition, mappingJson)
    .run()
  const book = await db
    .prepare('SELECT id FROM books WHERE source_id = ?1 AND name = ?2')
    .bind(source.id, bookName)
    .first<{ id: number }>()
  if (!book) {
    return Response.json({ error: 'Không lưu được quyển' }, { status: 500 })
  }

  // 3. Unit (giữ thứ tự xuất hiện trong Sheet)
  const unitNames = [...new Set([...incoming.values()].map((w) => w.unit))]
  await runBatches(
    db,
    unitNames.map((name, i) =>
      db
        .prepare(
          `INSERT INTO units (book_id, name, position) VALUES (?1, ?2, ?3)
           ON CONFLICT(book_id, name) DO UPDATE SET position = excluded.position`,
        )
        .bind(book.id, name, i),
    ),
  )
  const unitRows = await db
    .prepare('SELECT id, name FROM units WHERE book_id = ?1')
    .bind(book.id)
    .all<{ id: number; name: string }>()
  const unitId = new Map(unitRows.results.map((u) => [u.name, u.id]))

  // 4. Từ: chỉ ghi những từ mới hoặc đã thay đổi
  const existingRows = await db
    .prepare(
      `SELECT w.id, w.word_key, u.name AS unit, w.word, w.meaning,
              w.example, w.extra, w.position
       FROM words w JOIN units u ON u.id = w.unit_id
       WHERE u.book_id = ?1`,
    )
    .bind(book.id)
    .all<ExistingRow>()
  const existing = new Map(existingRows.results.map((r) => [r.word_key, r]))

  const writes: D1PreparedStatement[] = []
  let added = 0
  let updated = 0
  let unchanged = 0

  for (const w of incoming.values()) {
    const old = existing.get(w.key)
    const sameContent =
      !!old &&
      old.unit === w.unit &&
      old.word === w.word &&
      old.meaning === w.meaning &&
      (old.example ?? '') === w.example &&
      (old.extra ?? '') === w.extra

    if (old && sameContent && old.position === w.position) {
      unchanged++
      continue
    }
    if (!old) added++
    else if (!sameContent) updated++
    else unchanged++ // chỉ đổi vị trí dòng

    writes.push(
      db
        .prepare(
          `INSERT INTO words (unit_id, word_key, word, meaning, example, extra, position)
           VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
           ON CONFLICT(unit_id, word_key) DO UPDATE SET
             word = excluded.word, meaning = excluded.meaning,
             example = excluded.example, extra = excluded.extra,
             position = excluded.position`,
        )
        .bind(unitId.get(w.unit), w.key, w.word, w.meaning, w.example, w.extra, w.position),
    )
  }
  await runBatches(db, writes)

  // 5. Từ không còn trong Sheet: chỉ xóa khi người học đồng ý
  const missingRows = existingRows.results.filter((r) => !incoming.has(r.word_key))
  let deleted = 0
  if (deleteMissing && missingRows.length > 0) {
    await runBatches(
      db,
      missingRows.map((r) => db.prepare('DELETE FROM words WHERE id = ?1').bind(r.id)),
    )
    deleted = missingRows.length
    await db
      .prepare(
        'DELETE FROM units WHERE book_id = ?1 AND id NOT IN (SELECT unit_id FROM words)',
      )
      .bind(book.id)
      .run()
  }

  return Response.json({
    bookId: book.id,
    added,
    updated,
    unchanged,
    missing: deleteMissing ? 0 : missingRows.length,
    deleted,
  })
}