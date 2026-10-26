// Lưu audio đã tải vào bộ nhớ của trình duyệt (Cache API) để lần sau không cần tải lại
// và nghe được cả khi không có mạng. Audio KHÔNG được gửi lên máy chủ của ứng dụng.

const CACHE_NAME = 'leh-audio-v1'
const keyFor = (fileId: string) => `/__audio-cache/${encodeURIComponent(fileId)}`

export async function getCachedAudio(fileId: string): Promise<Blob | null> {
  try {
    if (!('caches' in window)) return null
    const cache = await caches.open(CACHE_NAME)
    const res = await cache.match(keyFor(fileId))
    return res ? await res.blob() : null
  } catch {
    return null
  }
}

export async function putCachedAudio(fileId: string, blob: Blob): Promise<boolean> {
  try {
    if (!('caches' in window)) return false
    const cache = await caches.open(CACHE_NAME)
    await cache.put(
      keyFor(fileId),
      new Response(blob, { headers: { 'Content-Type': blob.type } }),
    )
    return true
  } catch {
    return false // hết dung lượng hoặc trình duyệt chặn
  }
}

export async function deleteCachedAudio(fileId: string): Promise<void> {
  try {
    if (!('caches' in window)) return
    const cache = await caches.open(CACHE_NAME)
    await cache.delete(keyFor(fileId))
  } catch {
    // bỏ qua
  }
}