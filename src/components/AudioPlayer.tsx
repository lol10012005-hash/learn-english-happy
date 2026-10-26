import { useEffect, useRef, useState } from 'react'

type Props = {
  blob: Blob
  onListenStart: () => void // gọi mỗi khi bắt đầu nghe từ đầu bài
}

const SPEEDS = [0.75, 1, 1.25]

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const s = Math.floor(seconds)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

export default function AudioPlayer({ blob, onListenStart }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const listenRef = useRef(onListenStart)
  const [url, setUrl] = useState('')
  const [playing, setPlaying] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [speed, setSpeed] = useState(1)
  const [error, setError] = useState('')

  useEffect(() => {
    listenRef.current = onListenStart
  }, [onListenStart])

  useEffect(() => {
    const objectUrl = URL.createObjectURL(blob)
    setUrl(objectUrl)
    setError('')
    return () => URL.revokeObjectURL(objectUrl)
  }, [blob])

  useEffect(() => {
    if (audioRef.current) audioRef.current.playbackRate = speed
  }, [speed, url])

  function toggle() {
    const a = audioRef.current
    if (!a) return
    if (a.paused) {
      // Phải do người dùng bấm mới phát được trên điện thoại
      a.play().catch(() => setError('Trình duyệt không cho phát. Hãy bấm nút phát lần nữa.'))
    } else {
      a.pause()
    }
  }

  function seekBy(delta: number) {
    const a = audioRef.current
    if (!a) return
    a.currentTime = Math.min(Math.max(0, a.currentTime + delta), a.duration || Infinity)
  }

  return (
    <div className="player">
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration)
          e.currentTarget.playbackRate = speed
        }}
        onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
        onPlay={(e) => {
          setPlaying(true)
          if (e.currentTarget.currentTime < 0.5) listenRef.current()
        }}
        onPause={() => setPlaying(false)}
        onEnded={(e) => {
          setPlaying(false)
          e.currentTarget.currentTime = 0
          setTime(0)
        }}
        onError={() =>
          setError('Không phát được file audio này. Thử file mp3 hoặc m4a khác.')
        }
      />

      <div className="player-main">
        <button
          className="ghost-btn"
          onClick={() => seekBy(-5)}
          aria-label="Tua lại 5 giây"
        >
          ⏪ 5s
        </button>
        <button
          className="primary-btn player-play"
          onClick={toggle}
          aria-label={playing ? 'Tạm dừng' : 'Phát'}
        >
          {playing ? '⏸ Dừng' : '▶ Phát'}
        </button>
        <button
          className="ghost-btn"
          onClick={() => seekBy(5)}
          aria-label="Tua tới 5 giây"
        >
          5s ⏩
        </button>
      </div>

      <div className="player-bar">
        <span>{fmt(time)}</span>
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={Math.min(time, duration || 0)}
          onChange={(e) => {
            const a = audioRef.current
            if (a) a.currentTime = Number(e.target.value)
          }}
          aria-label="Vị trí phát"
        />
        <span>{fmt(duration)}</span>
      </div>

      <div className="speed-btns" role="group" aria-label="Tốc độ phát">
        {SPEEDS.map((s) => (
          <button
            key={s}
            className={s === speed ? 'speed-btn active' : 'speed-btn'}
            aria-pressed={s === speed}
            onClick={() => setSpeed(s)}
          >
            {s}x
          </button>
        ))}
      </div>

      {error && <p role="alert">{error}</p>}
    </div>
  )
}