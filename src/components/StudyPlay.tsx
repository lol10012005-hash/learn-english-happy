import { useEffect, useRef, useState } from 'react'
import {
  advance,
  checkAnswer,
  currentWord,
  exampleFilled,
  giveUp,
  hint,
  hintLines,
  maxHint,
  MODES,
  type Session,
} from '../study/engine'
import { isMuted, playEvent, setMuted } from '../study/sound'
import { speak } from '../study/speech'

type Props = {
  initial: Session
  onFinish: (session: Session) => void
  onQuit: () => void
}

const CORRECT_MSG = ['Chính xác!', 'Tuyệt vời!', 'Giỏi lắm!', 'Đúng rồi!']
const WRONG_MSG = ['Chưa đúng, thử lại nhé', 'Gần đúng rồi, cố lên!', 'Hãy nhớ lại xem nào']
const CORRECT_DELAY_MS = 900

const LABELS = {
  meaning: 'Gõ từ có nghĩa này:',
  sentence: 'Điền từ còn thiếu vào câu:',
  masked: 'Hoàn thành từ còn thiếu chữ:',
} as const

export default function StudyPlay({ initial, onFinish, onQuit }: Props) {
  const [session, setSession] = useState<Session>(initial)
  const [buf, setBuf] = useState('')
  const [muted, setMutedState] = useState(isMuted())
  const inputRef = useRef<HTMLInputElement>(null)
  const word = currentWord(session)

  // Kết thúc lượt học
  useEffect(() => {
    if (session.over) onFinish(session)
  }, [session, onFinish])

  // Phát âm thanh theo sự kiện của thao tác vừa rồi
  useEffect(() => {
    session.events.forEach(playEvent)
  }, [session])

  // Đúng thì tự sang từ kế tiếp sau một chút
  useEffect(() => {
    if (session.state !== 'correct') return
    const t = window.setTimeout(() => {
      setSession((s) => advance(s))
      setBuf('')
    }, CORRECT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [session.state, session.index])

  // Thẻ mới: đưa con trỏ vào ô gõ; chế độ 2 tự đọc từ
  useEffect(() => {
    inputRef.current?.focus()
    if (session.mode === 2) {
      const w = session.words[session.index]
      if (w) speak(w.word)
    }
  }, [session.index, session.mode, session.words])

  function handleChange(value: string) {
    if (session.state !== 'ask') return
    const next = session.settings.autoSubmit
      ? checkAnswer(session, value, false)
      : session
    if (next !== session) setSession(next)
    setBuf(value)
  }

  function handleEnter() {
    if (session.state === 'ask') {
      const next = checkAnswer(session, buf, true)
      if (next !== session) setSession(next)
      if (next.state !== 'ask' || next.wrongN !== session.wrongN) setBuf('')
    } else if (session.state === 'failed') {
      setSession(advance(session))
      setBuf('')
    }
  }

  function toggleMute() {
    setMuted(!muted)
    setMutedState(!muted)
  }

  if (!word || session.over) return <p className="loading">Đang tổng hợp kết quả...</p>

  const done = session.index + (session.state !== 'ask' ? 1 : 0)
  const percent = Math.round((done / session.words.length) * 100)
  const hints = hintLines(session)
  const canHint = session.state === 'ask' && session.hintLevel < maxHint(session)
  const filled = exampleFilled(word)
  const card = session.card

  return (
    <section className="card play">
      <div className="play-top">
        <span>
          Từ {Math.min(session.index + 1, session.words.length)}/
          {session.words.length}
        </span>
        <span>Điểm: <strong>{session.score}</strong></span>
        <span>Chuỗi đúng: <strong>{session.combo}</strong></span>
        <button className="link-btn" onClick={toggleMute}>
          {muted ? '🔇 Âm thanh: Tắt' : '🔊 Âm thanh: Bật'}
        </button>
        <button className="link-btn link-btn-plain" onClick={onQuit}>
          Thoát
        </button>
      </div>
      <p className="mode-tag">Chế độ {session.mode}: {MODES[session.mode].name}</p>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>

      <p className="play-label">{LABELS[card.kind]}</p>
      <p className={card.kind === 'masked' ? 'play-prompt play-masked' : 'play-prompt'}>
        {card.prompt}
      </p>
      {card.kind === 'masked' && card.meaningVisible && (
        <p className="play-meaning">Nghĩa: {word.meaning}</p>
      )}

      <p className="lives" aria-label={`Còn ${session.livesLeft} lần thử`}>
        {Array.from({ length: session.settings.lives }, (_, i) =>
          i < session.livesLeft ? '♥' : '♡',
        ).join(' ')}
        <span className="lives-text"> còn {session.livesLeft} lần thử</span>
      </p>

      <input
        ref={inputRef}
        className="play-input"
        value={buf}
        readOnly={session.state !== 'ask'}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleEnter()
        }}
        placeholder="Gõ đáp án rồi nhấn Enter"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-label="Đáp án"
      />

      {session.state === 'ask' && session.lastBad && (
        <p key={session.bad} className="msg-wrong fx-shake" role="status">
          ✗ <s>{session.lastBad}</s> — {WRONG_MSG[session.wrongN % WRONG_MSG.length]}
        </p>
      )}
      {hints.map((line) => (
        <p key={line} className="hint-text">{line}</p>
      ))}

      {session.state === 'correct' && (
        <p key={session.index} className="msg-correct fx-pop" role="status">
          ✓ {CORRECT_MSG[(session.index + session.score) % CORRECT_MSG.length]}{' '}
          <strong className="pts">+{session.lastPts}</strong>
          {session.events.includes('combo') && <> · Chuỗi đúng ×{session.combo}! 🔥</>}
          {filled && (
            <>
              <br />
              <small>{filled}</small>
            </>
          )}
        </p>
      )}
      {session.state === 'failed' && (
        <p className="msg-fail" role="status">
          ✗ Hết lượt. Đáp án đúng là: <strong>{word.word}</strong>
          {(filled || word.meaning) && (
            <>
              <br />
              <small>{[word.meaning, filled].filter(Boolean).join(' · ')}</small>
            </>
          )}
        </p>
      )}

      <div className="play-actions">
        <button className="ghost-btn" onClick={() => speak(word.word)}>
          🔊 Nghe
        </button>
        <button
          className="ghost-btn"
          disabled={!canHint}
          onClick={() => setSession(hint(session))}
        >
          💡 Gợi ý (trừ 50% điểm)
        </button>
        {session.state === 'ask' && (
          <button className="ghost-btn" onClick={() => setSession(giveUp(session))}>
            🏳️ Hiện đáp án
          </button>
        )}
        {session.state !== 'ask' && (
          <button
            className="primary-btn"
            onClick={() => {
              setSession(advance(session))
              setBuf('')
              inputRef.current?.focus()
            }}
          >
            Tiếp tục ➜
          </button>
        )}
      </div>
    </section>
  )
}