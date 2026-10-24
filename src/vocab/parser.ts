export type ColumnKey = 'word' | 'meaning' | 'example' | 'unit' | 'extra'
export type Mapping = Partial<Record<ColumnKey, number>>

export const COLUMN_ORDER: ColumnKey[] = [
  'word',
  'meaning',
  'example',
  'unit',
  'extra',
]

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  word: 'Từ vựng (bắt buộc)',
  meaning: 'Nghĩa (bắt buộc)',
  example: 'Ví dụ',
  unit: 'Unit',
  extra: 'Khác (phiên âm, ghi chú)',
}

// Tên tiêu đề được nhận (đã bỏ dấu, viết thường)
const ALIASES: Record<ColumnKey, string[]> = {
  word: ['tu vung', 'tu', 'word', 'vocabulary', 'vocab', 'term'],
  meaning: ['nghia', 'y nghia', 'meaning', 'definition', 'translation'],
  example: ['vi du', 'cau vi du', 'example', 'sentence', 'example sentence'],
  unit: ['unit', 'bai', 'chu de', 'lesson', 'topic'],
  extra: ['khac', 'ghi chu', 'note', 'notes', 'phien am', 'pronunciation', 'loai tu', 'pos'],
}

export function normalizeHeader(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeWord(s: string): string {
  return s.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

// Tự nhận cột từ dòng tiêu đề
export function detectMapping(header: string[]): Mapping {
  const mapping: Mapping = {}
  header.forEach((cell, index) => {
    const name = normalizeHeader(cell)
    if (!name) return
    for (const key of COLUMN_ORDER) {
      if (mapping[key] === undefined && ALIASES[key].includes(name)) {
        mapping[key] = index
        break
      }
    }
  })
  return mapping
}

export type ParsedWord = {
  word: string
  meaning: string
  example: string
  unit: string
  extra: string
  row: number // số dòng trong Google Sheet (dòng 1 là tiêu đề)
}

export type Issue = {
  row: number
  kind: 'missing' | 'duplicate'
  text: string
}

export type ParseResult = {
  ready: boolean
  words: ParsedWord[]
  units: Array<{ name: string; count: number }>
  issues: Issue[]
}

export const NO_UNIT = 'Chưa phân unit'
export const ALL_UNIT = 'Tất cả'

export function parseTab(rows: string[][], mapping: Mapping): ParseResult {
  const empty: ParseResult = { ready: false, words: [], units: [], issues: [] }
  if (mapping.word === undefined || mapping.meaning === undefined) return empty

  const cell = (row: string[], idx: number | undefined) =>
    idx === undefined ? '' : (row[idx] ?? '').trim()

  const words: ParsedWord[] = []
  const issues: Issue[] = []
  const seen = new Set<string>()
  let currentUnit = ''

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    const sheetRow = r + 1
    if (row.every((c) => c.trim() === '')) continue // bỏ dòng trống

    // Unit trống thì dùng unit của dòng trên (cũng xử lý ô gộp)
    const unitCell = cell(row, mapping.unit)
    if (unitCell) currentUnit = unitCell
    const unit =
      mapping.unit === undefined ? ALL_UNIT : currentUnit || NO_UNIT

    const word = cell(row, mapping.word)
    const meaning = cell(row, mapping.meaning)

    if (!word || !meaning) {
      issues.push({
        row: sheetRow,
        kind: 'missing',
        text: !word ? 'Thiếu từ vựng' : `Thiếu nghĩa của "${word}"`,
      })
      continue
    }

    const dupKey = `${normalizeWord(unit)}|${normalizeWord(word)}`
    if (seen.has(dupKey)) {
      issues.push({
        row: sheetRow,
        kind: 'duplicate',
        text: `Từ "${word}" bị trùng trong ${unit}`,
      })
      continue
    }
    seen.add(dupKey)

    words.push({
      word,
      meaning,
      example: cell(row, mapping.example),
      unit,
      extra: cell(row, mapping.extra),
      row: sheetRow,
    })
  }

  const counts = new Map<string, number>()
  for (const w of words) counts.set(w.unit, (counts.get(w.unit) ?? 0) + 1)
  const units = [...counts].map(([name, count]) => ({ name, count }))

  return { ready: true, words, units, issues }
}

// Khóa của từ: không đổi khi người học chèn hoặc xóa dòng trong Sheet.
// Dùng ở bước lưu dữ liệu (bước 15).
export async function makeWordKey(
  book: string,
  unit: string,
  word: string,
): Promise<string> {
  const text = [book, unit, word].map(normalizeWord).join('|')
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 24)
}