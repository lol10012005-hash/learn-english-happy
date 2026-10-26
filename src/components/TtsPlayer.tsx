import { useEffect, useMemo, useRef, useState } from 'react'
import { splitSentences } from '../dictation/sentences'
import { SentencePlayer, type PlayerState } from '../dictation/tts'
import { browserSynth, hasEnglishVoice, isSpeechSupported } from '../study/speech'

type Props = {
  text: string
  onListenStart: () => void // gọi mỗi khi bắt đầu nghe từ câu đầu tiên
}

const SPEEDS = [0.75, 1, 1.25]

export default function TtsPlayer({ text, onListenStart }: Props) {
  const sentences = useMemo(() => splitSentences(text), [text])
  const supported = isSpeechSupported()
  const playerRef = useRef<SentencePlayer | null>(null)
  const listenRef = useRef(onListenStart)
  const [view, setView] = useState<PlayerState>({
    index: 0,
    total: sentences.length,
    playing: false,
    finished: false,
    mode: 'step',
    speed: 1,
  })
  const [error, setError] = useState('')
  const [voice, setVoice] = useState<boolean | null>(hasEnglishVoice())

  useEffect(() => {
    listenRef.current = onListenStart
  }, [onListenStart])

  useEffect(() => {
    if (!supported) return
    const player = new SentencePlayer(sentences, browserSynth, {
      onChange: setView,
      onListenStart: () => listenRef.current(),
      onError: () =>
        setError('Giọng đọc của trình duyệt bị lỗi. Hãy bấm phát lần nữa, hoặc thử trình duyệt khác.'),
    })
    playerRef.current = player
    setView(player.state)
    return () => {
      player.destroy()
      playerRef.current = null
    }
  }, [sentences, supported])

  // Danh sách giọng đọc thường tải chậm sau khi mở trang
  useEffect(() => {
    if (!supported) return
    const synth = window.speechSynthesis
    const update = () => setVoice(hasEnglishVoice())
    update()
    synth.addEventListener('voiceschanged', update)
    return () => synth.removeEventListener('voiceschanged', update)
  }, [supported])

  if (!supported) {
    return (
      <p className="step-box" role="alert">
        Trình duyệt này chưa hỗ trợ giọng đọc. Hãy dùng Chrome, Edge hoặc Safari.
      </p>
    )
  }
  if (sentences.length === 0) {
    return <p role="alert">Văn bản của bài này không có câu nào để đọc.</p>
  }

  const p = playerRef.current
  const done = view.index + (view.finished ? 1 : 0)

  return (
    <div className="player">
      <div className="mode-switch" role="group" aria-label="Cách đọc">
        <button
          className={view.mode === 'step' ? 'speed-btn active' : 'speed-btn'}
          aria-pressed={view.mode === 'step'}
          onClick={() => p?.setMode('step')}
        >
          Từng câu
        </button>
        <button
          className={view.mode === 'flow' ? 'speed-btn active' : 'speed-btn'}
          aria-pressed={view.mode === 'flow'}
          onClick={() => p?.setMode('flow')}
        >
          Liền mạch
        </button>
      </div>
      <p className="muted tts-hint">
        {view.mode === 'step'
          ? 'Đọc một câu rồi dừng để bạn gõ. Bấm ▶ để nghe câu kế, ↺ để nghe lại câu.'
          : 'Đọc liền các câu từ đầu đến cuối. Bấm ⏸ để dừng.'}
      </p>

      <div className="player-main">
        <button
          className="ghost-btn"
          onClick={() => p?.prev()}
          disabled={view.index === 0 && !view.playing}
          aria-label="Câu trước"
        >
          ⏮
        </button>
        <button
          className="primary-btn player-play"
          onClick={() => p?.toggle()}
          aria-label={view.playing ? 'Tạm dừng' : 'Phát'}
        >
          {view.playing ? '⏸ Dừng' : '▶ Phát'}
        </button>
        <button
          className="ghost-btn"
          onClick={() => p?.next()}
          disabled={view.index + 1 >= view.total}
          aria-label="Câu sau"
        >
          ⏭
        </button>
        <button
          className="ghost-btn"
          onClick={() => p?.replay()}
          aria-label="Nghe lại câu này"
        >
          ↺ Nghe lại câu
        </button>
      </div>

      <div className="player-bar">
        <span>
          Câu {Math.min(view.index + 1, view.total)}/{view.total}
        </span>
        <progress value={done} max={view.total} aria-label="Tiến độ" />
      </div>

      <div className="speed-btns" role="group" aria-label="Tốc độ đọc">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={s === view.speed ? 'speed-btn active' : 'speed-btn'}
            aria-pressed={s === view.speed}
            onClick={() => p?.setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {voice === false && (
        <p role="alert">
          Thiết bị chưa có giọng đọc tiếng Anh. Hãy thêm giọng tiếng Anh trong cài đặt
          hệ thống (Văn bản sang giọng nói), hoặc dùng audio.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}