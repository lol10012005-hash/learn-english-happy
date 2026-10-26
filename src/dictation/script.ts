// Đọc văn bản gốc của bài nghe chép từ Google Docs.
// - Dòng bắt đầu bằng # là ghi chú, không chấm.
// - Dòng bắt đầu bằng [mm:ss] (hoặc [h:mm:ss]) đánh dấu thời điểm câu bắt đầu trong audio.

export type Cue = { t: number; text: string } // t = giây

export type ParsedScript = {
  text: string // văn bản dùng để chấm (không có ghi chú, không có mốc thời gian)
  cues: Cue[] // rỗng nếu Docs không có mốc thời gian
  notes: number // số dòng ghi chú đã bỏ qua
}

const TIME_TAG = /^\[(?:(\d{1,2}):)?(\d{1,3}):(\d{2})\]\s*/

function parseTag(line: string): { t: number; rest: string } | null {
  const m = TIME_TAG.exec(line)
  if (!m) return null
  const hours = m[1] ? Number(m[1]) : 0
  const minutes = Number(m[2])
  const seconds = Number(m[3])
  if (seconds > 59) return null
  return { t: hours * 3600 + minutes * 60 + seconds, rest: line.slice(m[0].length) }
}

export function parseScript(raw: string): ParsedScript {
  const lines = raw
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u00a0\u200b]/g, ' ')
    .split('\n')

  const out: string[] = []
  const cues: Cue[] = []
  let notes = 0

  for (const original of lines) {
    const line = original.trim()
    if (!line) continue
    if (line.startsWith('#')) {
      notes++
      continue
    }
    const tag = parseTag(line)
    if (tag) {
      const text = tag.rest.trim()
      if (!text) continue
      out.push(text)
      cues.push({ t: tag.t, text })
    } else {
      out.push(line)
      // Câu dài viết trên nhiều dòng: nối vào câu trước đó
      if (cues.length > 0) cues[cues.length - 1].text += ' ' + line
    }
  }

  return { text: out.join('\n'), cues, notes }
}

// Đếm số từ: chuỗi chữ hoặc số, giữ nguyên từ có dấu nháy hoặc gạch nối (don't, well-known)
export function countWords(text: string): number {
  return text.match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu)?.length ?? 0
}