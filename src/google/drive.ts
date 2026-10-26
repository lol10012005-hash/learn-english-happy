// Đọc file Google Drive bằng quyền drive.file (chỉ các file người học đã chọn)

const BASE = 'https://www.googleapis.com/drive/v3/files'

export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document'
export const MAX_AUDIO_BYTES = 50 * 1024 * 1024 // 50 MB

export type DriveMeta = {
  id: string
  name: string
  mimeType: string
  size: number | null // chỉ có với file thường (Google Docs không có)
}

function explain(status: number): string {
  if (status === 401) return 'Quyền truy cập đã hết hạn. Hãy bấm chọn hoặc tải lại.'
  if (status === 403)
    return 'Không có quyền đọc file này, hoặc Google Drive API chưa được bật trong Google Cloud.'
  if (status === 404) return 'Không tìm thấy file. File có thể đã bị xóa hoặc đổi quyền.'
  if (status === 429) return 'Google đang giới hạn tần suất, hãy thử lại sau ít phút.'
  return `Google trả về lỗi ${status}.`
}

export async function getFileMeta(id: string, token: string): Promise<DriveMeta> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(id)}?fields=id,name,mimeType,size`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(explain(res.status))
  const d = (await res.json()) as {
    id: string
    name: string
    mimeType: string
    size?: string
  }
  return {
    id: d.id,
    name: d.name,
    mimeType: d.mimeType,
    size: d.size ? Number(d.size) : null,
  }
}

// Văn bản thuần của một Google Docs
export async function exportDocText(id: string, token: string): Promise<string> {
  const res = await fetch(
    `${BASE}/${encodeURIComponent(id)}/export?mimeType=${encodeURIComponent('text/plain')}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  if (!res.ok) throw new Error(explain(res.status))
  return res.text()
}

const EXT_MIME: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
}

// Kiểu audio dùng cho Blob (trình duyệt, nhất là Safari, cần kiểu đúng để phát)
export function audioMime(meta: Pick<DriveMeta, 'name' | 'mimeType'>): string | null {
  if (meta.mimeType.startsWith('audio/')) return meta.mimeType
  const ext = meta.name.split('.').pop()?.toLowerCase() ?? ''
  return EXT_MIME[ext] ?? null
}

export async function downloadAudio(
  meta: DriveMeta,
  token: string,
  onProgress: (loaded: number, total: number) => void,
  signal?: AbortSignal,
): Promise<Blob> {
  const type = audioMime(meta)
  if (!type) throw new Error('File này không phải audio (mp3, m4a hoặc wav).')
  if (meta.size !== null && meta.size > MAX_AUDIO_BYTES) {
    throw new Error('File audio lớn hơn 50 MB. Hãy dùng file nhỏ hơn.')
  }

  const res = await fetch(`${BASE}/${encodeURIComponent(meta.id)}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  })
  if (!res.ok) throw new Error(explain(res.status))

  const total = meta.size ?? Number(res.headers.get('Content-Length') ?? 0)
  if (!res.body) {
    const blob = await res.blob()
    onProgress(blob.size, blob.size)
    return new Blob([blob], { type })
  }

  const reader = res.body.getReader()
  const chunks: BlobPart[] = []
  let loaded = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value as BlobPart)
    loaded += value.byteLength
    if (loaded > MAX_AUDIO_BYTES) {
      await reader.cancel()
      throw new Error('File audio lớn hơn 50 MB. Hãy dùng file nhỏ hơn.')
    }
    onProgress(loaded, total)
  }
  return new Blob(chunks, { type })
}