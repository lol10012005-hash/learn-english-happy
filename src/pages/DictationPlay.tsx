import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/context'
import AttemptHistory from '../components/AttemptHistory'
import AudioPlayer from '../components/AudioPlayer'
import DictationResult from '../components/DictationResult'
import TtsPlayer from '../components/TtsPlayer'
import { fetchLesson, saveAttempt, type AttemptSave, type Lesson } from '../dictation/api'
import {
  deleteCachedAudio,
  getCachedAudio,
  putCachedAudio,
} from '../dictation/audioCache'
import { errorList, grade, type GradeResult } from '../dictation/diff'
import { clearDraft, loadDraft, loadStrict, saveDraft, saveStrict } from '../dictation/draft'
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

type Submitted = { typed: string; listens: number; result: GradeResult }

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
  const [strict, setStrict] = useState(loadStrict)
  const [submitted, setSubmitted] = useState<Submitted | null>(null)
  const [save, setSave] = useState<AttemptSave>({ status: 'saving' })
  const [historyKey, setHistoryKey] = useState(0)
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

  async function persistAttempt(s: Submitted) {
    setSave({ status: 'saving' })
    try {
      await saveAttempt({
        lessonId,
        typedText: s.typed,
        listens: s.listens,
        strict: s.result.strict,
        counts: s.result.counts,
        errors: errorList(s.result)
          .slice(0, 1000)
          .map((x) => [x.type, x.orig, x.typed]),
      })
      setSave({ status: 'saved' })
      setHistoryKey((k) => k + 1)
    } catch (e) {
      setSave({
        status: 'error',
        message: e instanceof Error ? e.message : 'Lỗi không xác định',
      })
    }
  }

  function handleSubmit() {
    if (!lesson) return
    saveDraft(userId, lessonId, { text, listens })
    if (countWords(text) === 0) {
      setNotice('Bạn chưa gõ gì cả.')
      return
    }
    setNotice('')
    // Chấm bài ngay trong trình duyệt
    const result = grade(lesson.text, text, { strict })
    const s: Submitted = { typed: text, listens, result }
    setSubmitted(s)
    void persistAttempt(s)
  }

  function handleReset() {
    if (!window.confirm('Xóa bài đã gõ và số lần nghe để làm lại từ đầu?')) return
    clearDraft(userId, lessonId)
    setText('')
    setListens(0)
    setNotice('')
    setSubmitted(null)
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

  if (submitted) {
    return (
      <>
        <DictationResult
          title={lesson.title}
          origText={lesson.text}
          typedText={submitted.typed}
          result={submitted.result}
          save={save}
          onRetrySave={() => void persistAttempt(submitted)}
          onEdit={() => setSubmitted(null)}
          onRestart={handleReset}
        />
        <AttemptHistory lessonId={lessonId} reloadKey={historyKey} />
      </>
    )
  }

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
      <label className="check">
        <input
          type="checkbox"
          checked={strict}
          onChange={(e) => {
            setStrict(e.target.checked)
            saveStrict(e.target.checked)
          }}
        />
        <span>Chấm cả dấu câu và chữ hoa</span>
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
      <AttemptHistory lessonId={lessonId} reloadKey={historyKey} />
    </section>
  )
}