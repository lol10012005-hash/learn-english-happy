import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createLesson } from '../dictation/api'
import { putCachedAudio } from '../dictation/audioCache'
import { countWords, parseScript, type ParsedScript } from '../dictation/script'
import { splitSentences } from '../dictation/sentences'
import {
  audioMime,
  downloadAudio,
  exportDocText,
  getFileMeta,
  GOOGLE_DOC_MIME,
  MAX_AUDIO_BYTES,
} from '../google/drive'
import {
  pickFile,
  preloadGoogle,
  requestAccessToken,
  type PickedFile,
} from '../google/picker'
import { isSpeechSupported, speak } from '../study/speech'

type Doc = { file: PickedFile; parsed: ParsedScript }
type Audio = { file: PickedFile; blob: Blob; cached: boolean }
type Busy = null | 'doc' | 'audio' | 'save'

const TOKEN_TTL_MS = 45 * 60 * 1000
const mb = (n: number) => (n / 1048576).toFixed(1)

function AudioPreview({ blob }: { blob: Blob }) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return <audio controls src={url} className="audio-preview" />
}

export default function DictationNew() {
  const navigate = useNavigate()
  const tokenRef = useRef<{ value: string; at: number } | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState('')
  const [doc, setDoc] = useState<Doc | null>(null)
  const [audio, setAudio] = useState<Audio | null>(null)
  const [progress, setProgress] = useState<{ loaded: number; total: number } | null>(null)
  const [title, setTitle] = useState('')

  useEffect(() => {
    preloadGoogle().catch(() => {
      // lỗi sẽ được báo khi người dùng bấm nút
    })
    return () => abortRef.current?.abort()
  }, [])

  // Dùng lại quyền đã cấp trong 45 phút để không phải bật cửa sổ cấp quyền nhiều lần
  async function getToken(): Promise<string> {
    const t = tokenRef.current
    if (t && Date.now() - t.at < TOKEN_TTL_MS) return t.value
    const value = await requestAccessToken()
    tokenRef.current = { value, at: Date.now() }
    return value
  }

  async function handlePickDoc() {
    setError('')
    setBusy('doc')
    try {
      const token = await getToken()
      const file = await pickFile(token, 'doc')
      if (!file) return
      if (file.mimeType !== GOOGLE_DOC_MIME) {
        throw new Error(
          'Hãy chọn một Google Docs. File Word (.docx) cần được mở bằng Google Docs rồi lưu dưới dạng Google Docs trước.',
        )
      }
      const parsed = parseScript(await exportDocText(file.id, token))
      if (!parsed.text) {
        throw new Error('Docs này không có nội dung để chấm (trống, hoặc chỉ có dòng ghi chú bắt đầu bằng #).')
      }
      setDoc({ file, parsed })
      setTitle((t) => t || file.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(null)
    }
  }

  async function handlePickAudio(anyType: boolean) {
    setError('')
    setBusy('audio')
    try {
      const token = await getToken()
      const file = await pickFile(token, anyType ? 'any' : 'audio')
      if (!file) return
      const meta = await getFileMeta(file.id, token)
      if (!audioMime(meta)) {
        throw new Error('File này không phải audio. Hãy chọn file mp3, m4a hoặc wav.')
      }
      if (meta.size !== null && meta.size > MAX_AUDIO_BYTES) {
        throw new Error(`File audio nặng ${mb(meta.size)} MB, vượt giới hạn 50 MB.`)
      }

      setAudio(null)
      setProgress({ loaded: 0, total: meta.size ?? 0 })
      abortRef.current?.abort()
      abortRef.current = new AbortController()
      const blob = await downloadAudio(
        meta,
        token,
        (loaded, total) => setProgress({ loaded, total }),
        abortRef.current.signal,
      )
      const cached = await putCachedAudio(file.id, blob)
      setAudio({ file, blob, cached })
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setProgress(null)
      setBusy(null)
    }
  }

  async function handleSave() {
    if (!doc) return
    setError('')
    setBusy('save')
    try {
      const { id } = await createLesson({
        title: title.trim(),
        docFileId: doc.file.id,
        docName: doc.file.name,
        // Không chọn audio thì bài được đọc bằng giọng đọc của trình duyệt
        ...(audio
          ? { audioFileId: audio.file.id, audioName: audio.file.name }
          : {}),
        text: doc.parsed.text,
        cues: doc.parsed.cues,
      })
      navigate(`/dictation/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Không lưu được bài')
      setBusy(null)
    }
  }

  const ready = !!doc && title.trim().length > 0
  const pct =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.loaded / progress.total) * 100))
      : null

  return (
    <section className="card">
      <p>
        <Link to="/dictation">← Danh sách bài</Link>
      </p>
      <h1>Thêm bài nghe chép</h1>
      <p>
        Mỗi bài cần <strong>1 Google Docs</strong> (văn bản gốc). File audio là{' '}
        <strong>tùy chọn</strong>: nếu không chọn, web sẽ đọc văn bản bằng giọng đọc
        của trình duyệt (giống phần học từ vựng).
      </p>

      <div className="step-box">
        <h2 className="h2-tight">Bước 1. Văn bản gốc (Google Docs)</h2>
        <button
          className="primary-btn"
          onClick={handlePickDoc}
          disabled={busy !== null}
        >
          {busy === 'doc' ? 'Đang đọc...' : doc ? 'Chọn Docs khác' : 'Chọn Google Docs'}
        </button>
        {doc && (
          <div className="step-result">
            <p>
              ✓ <strong>{doc.file.name}</strong>: {countWords(doc.parsed.text)} từ
              {doc.parsed.cues.length > 0 && `, ${doc.parsed.cues.length} mốc thời gian`}
              {doc.parsed.notes > 0 && `, bỏ qua ${doc.parsed.notes} dòng ghi chú`}
            </p>
            <pre className="script-preview">
              {doc.parsed.text.slice(0, 500)}
              {doc.parsed.text.length > 500 ? '…' : ''}
            </pre>
          </div>
        )}
      </div>

      <div className="step-box">
        <h2 className="h2-tight">Bước 2. File audio (không bắt buộc)</h2>
        <p className="muted">
          Có audio thật thì nghe tự nhiên hơn (mp3, m4a hoặc wav, tối đa 50 MB). Bỏ
          qua bước này để dùng giọng đọc của trình duyệt.
        </p>
        <button
          className="primary-btn"
          onClick={() => handlePickAudio(false)}
          disabled={busy !== null}
        >
          {busy === 'audio' ? 'Đang tải...' : audio ? 'Chọn audio khác' : 'Chọn file audio'}
        </button>{' '}
        <button
          className="link-btn link-btn-plain"
          onClick={() => handlePickAudio(true)}
          disabled={busy !== null}
        >
          Không thấy file? Hiện mọi loại file
        </button>
        {progress && (
          <p role="status">
            Đang tải audio về máy...{' '}
            {pct !== null ? `${pct}% (${mb(progress.loaded)}/${mb(progress.total)} MB)` : `${mb(progress.loaded)} MB`}
            <br />
            <progress value={pct ?? undefined} max={100} />
          </p>
        )}
        {audio && (
          <div className="step-result">
            <p>
              ✓ <strong>{audio.file.name}</strong> ({mb(audio.blob.size)} MB)
              {audio.cached
                ? ' đã lưu vào bộ nhớ máy.'
                : ' đã tải, nhưng chưa lưu được vào bộ nhớ máy (lần sau sẽ phải tải lại).'}
            </p>
            <AudioPreview blob={audio.blob} />
            <button
              className="link-btn link-btn-plain"
              onClick={() => setAudio(null)}
              disabled={busy !== null}
            >
              Bỏ audio, dùng giọng đọc của trình duyệt
            </button>
          </div>
        )}
        {!audio && doc && (
          <div className="step-result">
            <p>
              Không chọn audio: bài sẽ được đọc bằng giọng đọc của trình duyệt.
            </p>
            {isSpeechSupported() ? (
              <button
                className="ghost-btn"
                onClick={() => speak(splitSentences(doc.parsed.text)[0] ?? '')}
              >
                🔊 Nghe thử giọng đọc
              </button>
            ) : (
              <p role="alert">
                Trình duyệt này chưa hỗ trợ giọng đọc. Hãy dùng Chrome, Edge hoặc Safari,
                hoặc chọn một file audio.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="step-box">
        <h2 className="h2-tight">Bước 3. Đặt tên và lưu</h2>
        <label className="map-field">
          <span>Tên bài</span>
          <input
            type="text"
            value={title}
            maxLength={120}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ví dụ: Bài 1 - Hội thoại ở sân bay"
          />
        </label>
        <p>
          <button className="primary-btn" onClick={handleSave} disabled={!ready || busy !== null}>
            {busy === 'save' ? 'Đang lưu...' : 'Lưu bài'}
          </button>
        </p>
      </div>

      {error && <p role="alert">Lỗi: {error}</p>}
    </section>
  )
}