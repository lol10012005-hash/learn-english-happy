import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/context'
import { fetchSummary, todayIso, type Summary } from '../progress/api'
import { MODES, type Mode } from '../study/engine'

const WEEKDAYS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']

function weekdayLabel(iso: string, offset: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return WEEKDAYS[new Date(y, m - 1, d + offset).getDay()]
}

function formatTime(value: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export default function Overview() {
  const { user } = useAuth()
  const [data, setData] = useState<Summary | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchSummary()
      .then(setData)
      .catch((e) =>
        setError(e instanceof Error ? e.message : 'Không tải được dữ liệu'),
      )
  }, [])

  if (error) {
    return (
      <section className="card">
        <h1>Tổng quan</h1>
        <p role="alert">{error}</p>
      </section>
    )
  }
  if (!data) return <p className="loading">Đang tải...</p>

  const { counts, streak, week, recent } = data
  const today = todayIso()
  const studied = counts.l0 + counts.l1 + counts.l2

  return (
    <div className="stack">
      <section className="card">
        <h1>Xin chào{user ? `, ${user.name}` : ''}!</h1>
        {counts.total === 0 ? (
          <p>
            Bạn chưa có từ vựng nào.{' '}
            <Link to="/vocab">Thêm Google Sheet ở mục Từ vựng</Link> để bắt đầu.
          </p>
        ) : (
          <>
            <p className="big-number">
              <strong>{counts.due}</strong> từ đến hạn ôn
              <small> · {counts.newWords} từ mới chưa học</small>
            </p>
            <div className="play-actions">
              <Link className="primary-btn link-as-btn" to="/study?review=1">
                {counts.due > 0 ? `Ôn ${counts.due} từ đến hạn ➜` : 'Học tiếp ➜'}
              </Link>
              <Link className="ghost-btn link-as-btn" to="/study">
                Chọn bài tự do
              </Link>
            </div>
          </>
        )}
      </section>

      <section className="card">
        <h2 className="h2-tight">
          🔥 Chuỗi {streak.current} ngày
        </h2>
        <p className="muted">
          {streak.playedToday
            ? 'Hôm nay bạn đã học, chuỗi được giữ.'
            : streak.current > 0
              ? 'Hôm nay chưa học. Học một lượt để giữ chuỗi!'
              : 'Học một lượt (đúng ít nhất 1 từ) để bắt đầu chuỗi.'}
          {streak.best > 0 && <> Kỷ lục: {streak.best} ngày.</>}
        </p>
        <ol className="week" aria-label="7 ngày gần nhất">
          {week.map((on, i) => (
            <li key={i} className={on ? 'week-day on' : 'week-day'}>
              <span>{weekdayLabel(today, i - 6)}</span>
              <strong aria-label={on ? 'đã học' : 'chưa học'}>{on ? '✓' : '·'}</strong>
            </li>
          ))}
        </ol>
      </section>

      {studied > 0 && (
        <section className="card">
          <h2 className="h2-tight">Mức độ thuộc</h2>
          <ul className="unit-list">
            <li>✓ Đã thuộc: <strong>{counts.l2}</strong></li>
            <li>△ Chưa thuộc: <strong>{counts.l1}</strong></li>
            <li>✗ Không thuộc: <strong>{counts.l0}</strong></li>
            <li>Mới: <strong>{counts.newWords}</strong></li>
          </ul>
        </section>
      )}

      {recent.length > 0 && (
        <section className="card">
          <h2 className="h2-tight">Lượt học gần đây</h2>
          <ul className="recent">
            {recent.map((r) => (
              <li key={r.id}>
                <span>{formatTime(r.created_at)}</span>
                <span>{MODES[r.mode as Mode]?.name ?? `Chế độ ${r.mode}`}</span>
                <span>{r.words} từ</span>
                <strong>{r.score} điểm</strong>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}