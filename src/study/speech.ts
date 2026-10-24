// Đọc từ bằng giọng có sẵn của trình duyệt (Web Speech API)
export function speak(text: string, lang = 'en-US'): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  try {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = lang
    u.rate = 0.9
    window.speechSynthesis.speak(u)
    return true
  } catch {
    return false
  }
}