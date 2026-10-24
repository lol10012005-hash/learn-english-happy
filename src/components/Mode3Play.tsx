import { useEffect, useRef, useState } from 'react'
import {
  advance,
  checkAnswer,
  currentWord,
  giveUp,
  hint,
  hintText,
  maxHint,
  type Session,
} from '../study/engine'
import { speak } from '../study/speech'

type Props = {
  initial: Session
  onFinish: (session: Session) => void
  onQuit: () => void
}

const CORRECT_MSG = ['Chính xác!', 'Tuyệt vời!', 'Giỏi lắm!', 'Đúng rồi!']
const WRONG_MSG = ['Chưa đúng, thử lại nhé', 'Gần đúng rồi, cố lên!', 'Hãy nhớ lại xem nào']
const CORRECT_DELAY_MS = 900

export default function Mode3Play({ initial, onFinish, onQuit }: Props) {
  const [session, setSession] = useState<Session>(initial)
  const [buf, setBuf] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const word = currentWord(session)

  // Kết thúc lượt học
  useEffect(() => {
    if (session.over) onFinish(session)
  }, [session, onFinish])

  // Đúng thì tự sang từ kế tiếp sau một chút
  useEffect(() => {
    if (session.state !== 'correct') return
    const t = window.setTimeout(() => {
      setSession((s) => advance(s))
      setBuf('')
    }, CORRECT_DELAY_MS)
    return () => window.clearTimeout(t)
  }, [session.state, session.index])

  useEffect(() => {
    inputRef.current?.focus()
  }, [session.index])

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

  if (!word || session.over) return <p className="loading">Đang tổng hợp kết quả...</p>

  const done = session.index + (session.state !== 'ask' ? 1 : 0)
  const percent = Math.round((done / session.words.length) * 100)
  const hints = hintText(session)
  const canHint = session.state === 'ask' && session.hintLevel < maxHint(session)

  return (
    <section className="card play">
      <div className="play-top">
        <span>
          Từ {Math.min(session.index + 1, session.words.length)}/
          {session.words.length}
        </span>
        <span>Điểm: <strong>{session.score}</strong></span>
        <span>Chuỗi đúng: <strong>{session.combo}</strong></span>
        <button className="link-btn" onClick={onQuit}>Thoát</button>
      </div>
      <div
        className="progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="progress-bar" style={{ width: `${percent}%` }} />
      </div>

      <p className="play-label">Gõ từ có nghĩa này:</p>
      <p className="play-prompt">{word.meaning}</p>

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
        <p className="msg-wrong" role="status">
          ✗ <s>{session.lastBad}</s> —{' '}
          {WRONG_MSG[session.wrongN % WRONG_MSG.length]}
        </p>
      )}
      {hints && <p className="hint-text">{hints}</p>}

      {session.state === 'correct' && (
        <p className="msg-correct" role="status">
          ✓ {CORRECT_MSG[(session.index + session.score) % CORRECT_MSG.length]}{' '}
          <strong>+{session.lastPts}</strong>
          {session.events.includes('combo') && (
            <> · Chuỗi đúng ×{session.combo}!</>
          )}
        </p>
      )}
      {session.state === 'failed' && (
        <p className="msg-fail" role="status">
          ✗ Hết lượt. Đáp án đúng là: <strong>{word.word}</strong>
          {word.example && (
            <>
              <br />
              <small>{word.example}</small>
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