interface Env {
  DB: D1Database
}

const MAX_TABS = 200

// Ghi nhớ các tab người học không muốn thêm khi chọn Google Sheet
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

  let body: { fileId?: unknown; tabs?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Dữ liệu gửi lên không hợp lệ' }, { status: 400 })
  }

  const fileId = typeof body.fileId === 'string' ? body.fileId.trim().slice(0, 200) : ''
  if (!fileId || !Array.isArray(body.tabs) || body.tabs.length > MAX_TABS) {
    return Response.json({ error: 'Thiếu thông tin file' }, { status: 400 })
  }
  const tabs = [
    ...new Set(
      body.tabs
        .filter((t): t is string => typeof t === 'string')
        .map((t) => t.slice(0, 200)),
    ),
  ]

  await env.DB.prepare(
    `UPDATE sources SET excluded_tabs = ?1
     WHERE user_id = ?2 AND google_file_id = ?3 AND kind = 'sheet'`,
  )
    .bind(JSON.stringify(tabs), userId, fileId)
    .run()
  return Response.json({ ok: true })
}