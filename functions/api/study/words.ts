interface Env {
  DB: D1Database
}

type Row = {
  id: number
  word_key: string
  word: string
  meaning: string
  example: string | null
  extra: string | null
  unit: string
  book: string
  due: string | null
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
  const raw = new URL(request.url).searchParams.get('units') ?? ''
  const ids = [
    ...new Set(
      raw
        .split(',')
        .map(Number)
        .filter((n) => Number.isInteger(n) && n > 0),
    ),
  ]
  if (ids.length === 0) {
    return Response.json({ error: 'Chưa chọn unit nào' }, { status: 400 })
  }
  if (ids.length > 100) {
    return Response.json({ error: 'Chọn quá nhiều unit' }, { status: 400 })
  }

  const placeholders = ids.map((_, i) => `?${i + 2}`).join(',')
  const { results } = await env.DB.prepare(
    `SELECT w.id, w.word_key, w.word, w.meaning, w.example, w.extra,
            u.name AS unit, b.name AS book, p.due AS due
     FROM words w
     JOIN units u ON u.id = w.unit_id
     JOIN books b ON b.id = u.book_id
     LEFT JOIN word_progress p
       ON p.user_id = b.user_id AND p.word_key = w.word_key
     WHERE b.user_id = ?1 AND w.unit_id IN (${placeholders})
     ORDER BY b.position, u.position, w.position`,
  )
    .bind(userId, ...ids)
    .all<Row>()

  const words = results.map((r) => ({
    id: r.id,
    key: r.word_key,
    word: r.word,
    meaning: r.meaning,
    example: r.example ?? '',
    extra: r.extra ?? '',
    unit: r.unit,
    book: r.book,
    due: r.due,
  }))
  return Response.json({ words })
}