// Bài gõ dở được lưu trong máy (localStorage), theo từng người dùng và từng bài.

export type Draft = { text: string; listens: number }

const key = (userId: number, lessonId: number) => `leh:dict:${userId}:${lessonId}`

export function loadDraft(userId: number, lessonId: number): Draft {
  try {
    const raw = localStorage.getItem(key(userId, lessonId))
    if (raw) {
      const d = JSON.parse(raw) as Partial<Draft>
      return {
        text: typeof d.text === 'string' ? d.text : '',
        listens: Number.isInteger(d.listens) && (d.listens as number) >= 0 ? (d.listens as number) : 0,
      }
    }
  } catch {
    // dữ liệu hỏng hoặc trình duyệt chặn: bắt đầu bài mới
  }
  return { text: '', listens: 0 }
}

export function saveDraft(userId: number, lessonId: number, draft: Draft): boolean {
  try {
    localStorage.setItem(key(userId, lessonId), JSON.stringify(draft))
    return true
  } catch {
    return false
  }
}

export function clearDraft(userId: number, lessonId: number): void {
  try {
    localStorage.removeItem(key(userId, lessonId))
  } catch {
    // bỏ qua
  }
}