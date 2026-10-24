export type SheetTab = { title: string; rows: string[][] }
export type SheetData = { title: string; tabs: SheetTab[] }

const BASE = 'https://sheets.googleapis.com/v4/spreadsheets'

function explain(status: number): string {
  if (status === 401) return 'Quyền truy cập đã hết hạn. Hãy bấm chọn file lại.'
  if (status === 403)
    return 'Không có quyền đọc file này, hoặc Google Sheets API chưa được bật trong Google Cloud.'
  if (status === 404) return 'Không tìm thấy file. File có thể đã bị xóa hoặc đổi quyền.'
  return `Google trả về lỗi ${status}.`
}

export async function readSpreadsheet(
  id: string,
  token: string,
): Promise<SheetData> {
  const headers = { Authorization: `Bearer ${token}` }

  const metaRes = await fetch(
    `${BASE}/${id}?fields=properties.title,sheets.properties.title`,
    { headers },
  )
  if (!metaRes.ok) throw new Error(explain(metaRes.status))
  const meta = (await metaRes.json()) as {
    properties?: { title?: string }
    sheets?: Array<{ properties?: { title?: string } }>
  }

  const titles = (meta.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter(Boolean)
  if (titles.length === 0) throw new Error('File này không có trang tính nào.')

  const ranges = titles
    .map((t) => `ranges=${encodeURIComponent(`'${t.replace(/'/g, "''")}'`)}`)
    .join('&')
  const valRes = await fetch(
    `${BASE}/${id}/values:batchGet?${ranges}&majorDimension=ROWS`,
    { headers },
  )
  if (!valRes.ok) throw new Error(explain(valRes.status))
  const vals = (await valRes.json()) as {
    valueRanges?: Array<{ values?: unknown[][] }>
  }

  const tabs: SheetTab[] = titles.map((title, i) => ({
    title,
    rows: (vals.valueRanges?.[i]?.values ?? []).map((row) =>
      row.map((cell) => String(cell ?? '')),
    ),
  }))

  return { title: meta.properties?.title ?? 'Không tên', tabs }
}