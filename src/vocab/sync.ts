import type { SheetData } from '../google/sheets'
import { saveBook } from './api'
import { makeWordKey, parseTab, type Mapping } from './parser'

type Options = {
  fileId: string
  data: SheetData
  mappings: Record<string, Mapping>
  askDelete: (bookName: string, count: number) => boolean
}

// Trả về danh sách dòng báo cáo, mỗi quyển một dòng
export async function syncSheet({
  fileId,
  data,
  mappings,
  askDelete,
}: Options): Promise<string[]> {
  const lines: string[] = []

  for (let i = 0; i < data.tabs.length; i++) {
    const tab = data.tabs[i]
    const mapping = mappings[tab.title] ?? {}
    const parsed = parseTab(tab.rows, mapping)

    if (!parsed.ready || parsed.words.length === 0) {
      lines.push(`${tab.title}: bỏ qua (chưa chọn đủ cột hoặc không có từ hợp lệ).`)
      continue
    }

    const words = await Promise.all(
      parsed.words.map(async (w) => ({
        key: await makeWordKey(tab.title, w.unit, w.word),
        unit: w.unit,
        word: w.word,
        meaning: w.meaning,
        example: w.example,
        extra: w.extra,
      })),
    )

    const base = {
      fileId,
      fileName: data.title,
      bookName: tab.title,
      position: i,
      mapping,
      words,
    }

    const first = await saveBook({ ...base, deleteMissing: false })
    let tail = ''
    if (first.missing > 0) {
      if (askDelete(tab.title, first.missing)) {
        const second = await saveBook({ ...base, deleteMissing: true })
        tail = `, đã xóa ${second.deleted} từ không còn trong Sheet`
      } else {
        tail = `, giữ lại ${first.missing} từ không còn trong Sheet`
      }
    }
    lines.push(
      `${tab.title}: thêm ${first.added}, cập nhật ${first.updated}, giữ nguyên ${first.unchanged}${tail}.`,
    )
  }

  return lines
}