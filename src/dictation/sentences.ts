// Chia văn bản gốc thành các câu để giọng đọc của trình duyệt đọc từng câu một.

const ABBREVIATIONS = new Set([
  'mr', 'mrs', 'ms', 'dr', 'prof', 'sr', 'jr', 'st', 'vs', 'etc',
  'e.g', 'i.e', 'a.m', 'p.m', 'no', 'inc', 'ltd', 'co', 'mt', 'fig',
])

const SENTENCE_END = /[.!?…]+["'”’)\]]*$/

function endsSentence(token: string): boolean {
  if (!SENTENCE_END.test(token)) return false
  const core = token.replace(/["'”’)\]]+$/, '')
  // Dấu chấm của từ viết tắt (Mr., U.S., e.g.) hoặc chữ cái đầu tên (J.) không kết thúc câu
  if (core.endsWith('.') && !/[!?…]$/.test(core)) {
    const base = core.replace(/\.+$/, '').toLowerCase()
    if (ABBREVIATIONS.has(base)) return false
    if (/^[b-hj-z]$/.test(base)) return false // "J." (chừa lại "a" và "I" là từ thật)
    if (/^[a-z](\.[a-z])+$/.test(base)) return false // "U.S."
  }
  return true
}

// Câu quá dài (giọng đọc của một số trình duyệt bị ngắt giữa chừng) thì cắt tại dấu phẩy hoặc khoảng trắng
function chunkLong(sentence: string, max: number): string[] {
  if (sentence.length <= max) return [sentence]
  const words = sentence.split(' ')
  const out: string[] = []
  let cur: string[] = []
  let len = 0
  for (const w of words) {
    if (cur.length > 0 && len + 1 + w.length > max) {
      let cut = cur.length
      for (let i = cur.length - 1; i >= Math.floor(cur.length / 2); i--) {
        if (/[,;:]$/.test(cur[i])) {
          cut = i + 1
          break
        }
      }
      out.push(cur.slice(0, cut).join(' '))
      cur = cur.slice(cut)
      len = cur.join(' ').length
    }
    cur.push(w)
    len = cur.join(' ').length
  }
  if (cur.length) out.push(cur.join(' '))
  return out
}

export function splitSentences(text: string, maxLen = 200): string[] {
  const sentences: string[] = []
  for (const line of text.split('\n')) {
    const words = line.trim().split(/\s+/).filter(Boolean)
    let cur: string[] = []
    for (const w of words) {
      cur.push(w)
      if (endsSentence(w)) {
        sentences.push(cur.join(' '))
        cur = []
      }
    }
    if (cur.length) sentences.push(cur.join(' '))
  }
  return sentences
    .flatMap((s) => chunkLong(s, maxLen))
    .filter((s) => /[\p{L}\p{N}]/u.test(s)) // bỏ câu chỉ có dấu câu
}