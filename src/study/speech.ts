// Đọc bằng giọng có sẵn của trình duyệt (Web Speech API).
// Dùng chung cho học từ vựng và nghe chép để giọng đọc giống nhau.

import type { Synth } from '../dictation/tts'

export const BASE_RATE = 0.9 // tốc độ "1x" (hơi chậm hơn bình thường cho dễ nghe)

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'speechSynthesis' in window &&
    typeof SpeechSynthesisUtterance !== 'undefined'
  )
}

// null = chưa biết (trình duyệt chưa tải xong danh sách giọng)
export function hasEnglishVoice(): boolean | null {
  if (!isSpeechSupported()) return false
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return null
  return voices.some((v) => v.lang.toLowerCase().startsWith('en'))
}

// Giữ tham chiếu để Chrome không thu dọn câu đang đọc giữa chừng
const alive = new Set<SpeechSynthesisUtterance>()

// Đọc một từ hoặc một câu ngắn (dùng ở phần học từ vựng)
export function speak(text: string, lang = 'en-US'): boolean {
  if (!isSpeechSupported()) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = BASE_RATE
    alive.add(u)
    u.onend = () => alive.delete(u)
    u.onerror = () => alive.delete(u)
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}

// Bộ đọc dùng cho phần nghe chép (đọc từng câu, có thể tạm dừng và đổi tốc độ)
let pendingTimer: number | null = null
let justCanceled = false
let cancelTimer: number | undefined

export const browserSynth: Synth = {
  speak(text, { speed, lang, onEnd, onError }) {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = BASE_RATE * speed
    alive.add(u)
    u.onend = () => {
      alive.delete(u)
      onEnd()
    }
    u.onerror = (e) => {
      alive.delete(u)
      if (e.error === 'canceled' || e.error === 'interrupted') return
      onError()
    }
    const go = () => {
      pendingTimer = null
      window.speechSynthesis.speak(u)
    }
    // Ngay sau cancel(), một số trình duyệt bỏ qua speak(): chờ một chút.
    // Lần đọc đầu tiên thì gọi ngay để còn nằm trong thao tác bấm nút (iPhone yêu cầu).
    if (justCanceled) pendingTimer = window.setTimeout(go, 60)
    else go()
  },
  cancel() {
    if (pendingTimer !== null) {
      window.clearTimeout(pendingTimer)
      pendingTimer = null
    }
    window.speechSynthesis.cancel()
    justCanceled = true
    window.clearTimeout(cancelTimer)
    cancelTimer = window.setTimeout(() => {
      justCanceled = false
    }, 100)
  },
}