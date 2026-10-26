import {
  GOOGLE_API_KEY,
  GOOGLE_CLIENT_ID,
  GOOGLE_PROJECT_NUMBER,
} from '../config'

const GSI_SRC = 'https://accounts.google.com/gsi/client'
const GAPI_SRC = 'https://apis.google.com/js/api.js'
export const DRIVE_FILE_SCOPE = 'https://www.googleapis.com/auth/drive.file'

const pending = new Map<string, Promise<void>>()

function loadScript(src: string, isReady: () => boolean): Promise<void> {
  if (isReady()) return Promise.resolve()
  const existing = pending.get(src)
  if (existing) return existing
  const promise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      pending.delete(src)
      reject(new Error('Không tải được thư viện Google. Hãy kiểm tra kết nối mạng.'))
    }
    document.head.appendChild(script)
  })
  pending.set(src, promise)
  return promise
}

const gsiReady = () => !!window.google?.accounts?.oauth2

export async function preloadGoogle(): Promise<void> {
  await loadScript(GSI_SRC, gsiReady)
  await loadScript(GAPI_SRC, () => !!window.gapi)
}

// Xin quyền đọc các file người học chọn. Phải gọi từ thao tác bấm nút.
export async function requestAccessToken(): Promise<string> {
  await loadScript(GSI_SRC, gsiReady)
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID,
      scope: DRIVE_FILE_SCOPE,
      callback: (response) => {
        if (response.access_token) resolve(response.access_token)
        else reject(new Error(response.error ?? 'Không lấy được quyền truy cập'))
      },
      error_callback: () =>
        reject(new Error('Bạn đã đóng cửa sổ cấp quyền, hoặc trình duyệt đang chặn cửa sổ bật lên.')),
    })
    client.requestAccessToken()
  })
}

export type PickedFile = { id: string; name: string; mimeType: string }

// sheet = Google Sheet, doc = Google Docs, audio = file âm thanh, any = mọi loại file
export type PickKind = 'sheet' | 'doc' | 'audio' | 'any'

const AUDIO_MIME_TYPES = [
  'audio/mpeg',
  'audio/mp3',
  'audio/mp4',
  'audio/x-m4a',
  'audio/m4a',
  'audio/wav',
  'audio/x-wav',
  'audio/wave',
  'audio/aac',
  'audio/ogg',
  'audio/webm',
].join(',')

export async function pickFile(
  token: string,
  kind: PickKind,
): Promise<PickedFile | null> {
  await loadScript(GAPI_SRC, () => !!window.gapi)
  await new Promise<void>((resolve) => window.gapi!.load('picker', () => resolve()))

  const picker = window.google!.picker!
  const viewId =
    kind === 'sheet'
      ? picker.ViewId.SPREADSHEETS
      : kind === 'doc'
        ? picker.ViewId.DOCUMENTS
        : picker.ViewId.DOCS

  return new Promise((resolve) => {
    const view = new picker.DocsView(viewId)
    if (kind === 'audio') view.setMimeTypes(AUDIO_MIME_TYPES)
    if (kind === 'audio' || kind === 'any') view.setIncludeFolders(true)
    new picker.PickerBuilder()
      .setAppId(GOOGLE_PROJECT_NUMBER)
      .setOAuthToken(token)
      .setDeveloperKey(GOOGLE_API_KEY)
      .setLocale('vi')
      .addView(view)
      .setCallback((data) => {
        if (data.action === picker.Action.PICKED && data.docs?.[0]) {
          const d = data.docs[0]
          resolve({ id: d.id, name: d.name, mimeType: d.mimeType })
        } else if (data.action === picker.Action.CANCEL) {
          resolve(null)
        }
      })
      .build()
      .setVisible(true)
  })
}

export function pickSpreadsheet(token: string): Promise<PickedFile | null> {
  return pickFile(token, 'sheet')
}