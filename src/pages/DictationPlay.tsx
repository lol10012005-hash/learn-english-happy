import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import AudioPlayer from '../components/AudioPlayer'
import TtsPlayer from '../components/TtsPlayer'
import { fetchLesson, type Lesson } from '../dictation/api'
import {
  deleteCachedAudio,
  getCachedAudio,
  putCachedAudio,
} from '../dictation/audioCache'
import { clearDraft, loadDraft, saveDraft } from '../dictation/draft'
import { countWords } from '../dictation/script'
import { downloadAudio, getFileMeta } from '../google/drive'
import { requestAccessToken } from '../google/picker'

type AudioState =
  | { status: 'checking' }
  | { status: 'tts' } // đọc bằng giọng đọc của trình duyệt
  | { status: 'missing' } // chưa có trong máy, cần tải từ Google Drive
  | { status: 'downloading'; loaded: number; total: number }
  | { status: 'ready'; blob: Blob }
  | { status: 'error'; message: string }

const mb = (n: number) => (n / 1048576).toFixed(1)

export default function DictationPlay() {
  const lessonId = Number(useParams().id)
  const { user } = useAuth()
  const userId = user?.id ?? 0

  const [lesson, setLesson] = useState<Lesson | null>(null)
  const [error, setError] = useState('')
  const [audio, setAudio] = useState<AudioState>({ status: 'checking' })
  const [text, setText] = useState('')
  const [listens, setListens] = useState(0)
  const [draftReady, setDraftReady] = useState(false)
  const [showTotal, setShowTotal] = useState(true)
  const [notice, setNotice] = useState('')
  const latest = useRef({ text: '', listens: 0 })

  // Tải bài
  useEffect(() => {
    let cancelled = false
    fetchLesson(lessonId)
      .then((d) => {
        if (cancelled) return
        setLesson(d.lesson)
        const draft = loadDraft(userId, lessonId)
        setText(draft.text)
        setListens(draft.listens)
        setDraftReady(true)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Không tải được bài')
      })
    return () => {
      cancelled = true
    }
  }, [lessonId, userId])

  // Bài không có audio: dùng giọng đọc của trình duyệt. Có audio: kiểm tra đã có trong máy chưa.
  const checkAudio = useCallback(async (l: Lesson) => {
    if (!l.audioFileId) {
      setAudio({ status: 'tts' })
      return
    }
    setAudio({ status: 'checking' })
    const blob = await getCachedAudio(l.audioFileId)
    setAudio(blob ? { status: 'ready', blob } : { status: 'missing' })
  }, [])

  useEffect(() => {
    if (lesson) void checkAudio(lesson)
  }, [lesson, checkAudio])

  // Tự lưu nháp sau khi ngừng gõ 0,4 giây
  useEffect(() => {
    latest.current = { text, listens }
    if (!draftReady) return
    const t = window.setTimeout(() => saveDraft(userId, lessonId, { text, listens }), 400)
    return () => window.clearTimeout(t)
  }, [text, listens, draftReady, userId, lessonId])

  // Lưu ngay khi đóng tab hoặc chuyển ứng dụng
  useEffect(() => {
    if (!draftReady) return
    const flush = () => saveDraft(userId, lessonId, latest.current)
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flush()
    }
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      flush()
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [draftReady, userId, lessonId])

  const handleListen = useCallback(() => setListens((n) => n + 1), [])

  async function handleDownload(force: boolean) {
    const fileId = lesson?.audioFileId
    if (!fileId) return
    setNotice('')
    setAudio({ status: 'downloading', loaded: 0, total: 0 })
    try {
      // Hộp cấp quyền phải được mở ngay sau thao tác bấm nút
      const token = await requestAccessToken()
      if (force) await deleteCachedAudio(fileId)
      const meta = await getFileMeta(fileId, token)
      const blob = await downloadAudio(meta, token, (loaded, total) =>
        setAudio({ status: 'downloading', loaded, total }),
      )
      if (!(await putCachedAudio(fileId, blob))) {
        setNotice('Chưa lưu được audio vào bộ nhớ máy, lần sau sẽ phải tải lại.')
      }
      setAudio({ status: 'ready', blob })
    } catch (e) {
      setAudio({
        status: 'error',
        message: e instanceof Error ? e.message : 'Không tải được audio',
      })
    }
  }

  function handleSubmit() {
    saveDraft(userId, lessonId, { text, listens })
    const n = countWords(text)
    setNotice(
      n === 0
        ? 'Bạn chưa gõ gì cả.'
        : `Đã lưu bản nháp (${n} từ). Chức năng chấm điểm sẽ có ở bước sau.`,
    )
  }

  function handleReset() {
    if (!window.confirm('Xóa bài đã gõ và số lần nghe để làm lại từ đầu?')) return
    clearDraft(userId, lessonId)
    setText('')
    setListens(0)
    setNotice('')
  }

  if (error) {
    return (
      <section className="card">
        <p>
          <Link to="/dictation">← Danh sách bài</Link>
        </p>
        <p role="alert">{error}</p>
      </section>
    )
  }
  if (!lesson) return <p className="loading">Đang tải...</p>

  const typed = countWords(text)
  const total = countWords(lesson.text)

  return (
    <section className="card">
      <p>
        <Link to="/dictation">← Danh sách bài</Link>
      </p>
      <h1>{lesson.title}</h1>

      {audio.status === 'checking' && <p className="loading">Đang kiểm tra audio...</p>}

      {audio.status === 'missing' && (
        <div className="step-box">
          <p>
            Audio chưa có trong máy này. Bấm nút bên dưới để tải về từ Google Drive
            của bạn (chỉ cần tải một lần).
          </p>
          <button className="primary-btn" onClick={() => handleDownload(false)}>
            Tải audio về máy
          </button>{' '}
          <button className="ghost-btn" onClick={() => setAudio({ status: 'tts' })}>
            Dùng giọng đọc của trình duyệt
          </button>
        </div>
      )}

      {audio.status === 'downloading' && (
        <p role="status">
          Đang tải audio...{' '}
          {audio.total > 0
            ? `${Math.round((audio.loaded / audio.total) * 100)}% (${mb(audio.loaded)}/${mb(audio.total)} MB)`
            : `${mb(audio.loaded)} MB`}
          <br />
          <progress
            value={audio.total > 0 ? audio.loaded : undefined}
            max={audio.total > 0 ? audio.total : undefined}
          />
        </p>
      )}

      {audio.status === 'error' && (
        <div className="step-box">
          <p role="alert">{audio.message}</p>
          {lesson.audioFileId && (
            <button className="primary-btn" onClick={() => handleDownload(true)}>
              Thử tải lại
            </button>
          )}{' '}
          <button className="ghost-btn" onClick={() => setAudio({ status: 'tts' })}>
            Dùng giọng đọc của trình duyệt
          </button>
        </div>
      )}

      {audio.status === 'tts' && (
        <>
          <TtsPlayer text={lesson.text} onListenStart={handleListen} />
          <p className="muted">
            Số lần nghe: <strong>{listens}</strong>
            {lesson.audioFileId && (
              <>
                {' '}
                <button
                  className="link-btn link-btn-plain"
                  onClick={() => void checkAudio(lesson)}
                >
                  Dùng audio của bài
                </button>
              </>
            )}
          </p>
        </>
      )}

      {audio.status === 'ready' && (
        <>
          <AudioPlayer blob={audio.blob} onListenStart={handleListen} />
          <p className="muted">
            Số lần nghe: <strong>{listens}</strong>{' '}
            <button
              className="link-btn link-btn-plain"
              onClick={() => handleDownload(true)}
            >
              Tải lại audio
            </button>
          </p>
        </>
      )}

      <label className="map-field typing-label">
        <span>Gõ lại những gì bạn nghe được</span>
        <textarea
          className="typing-box"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Nghe rồi gõ vào đây. Bài gõ dở được tự lưu."
          lang="en"
          spellCheck={false}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="none"
          rows={10}
        />
      </label>

      <p className="muted" role="status">
        Đã gõ <strong>{typed}</strong>
        {showTotal && <> / {total}</>} từ
      </p>
      <label className="check">
        <input
          type="checkbox"
          checked={showTotal}
          onChange={(e) => setShowTotal(e.target.checked)}
        />
        <span>Hiện số từ cần gõ</span>
      </label>

      <div className="play-actions">
        <button className="primary-btn" onClick={handleSubmit}>
          Nộp bài
        </button>
        <button className="ghost-btn" onClick={handleReset}>
          Làm lại từ đầu
        </button>
      </div>
      {notice && (
        <p className="save-box" role="status">
          {notice}
        </p>
      )}
    </section>
  )
}