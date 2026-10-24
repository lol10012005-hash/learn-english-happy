import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchSummary, todayIso, type DayStat, type Summary } from '../progress/api'
import { LEVEL_NAMES, type Level } from '../study/engine'
import { addDays } from '../study/srs'

function shortDay(iso: string): string {
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
}

function buildDays(days: DayStat[]): DayStat[] {
  const map = new Map(days.map((d) => [d.day, d]))
  const today = todayIso()
  return Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29)
    return (
      map.get(day) ?? { day, sessions: 0, words: 0, good: 0, mid: 0, bad: 0, score: 0 }
    )
  })
}

export default function Stats() {
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
        <h1>Thống kê</h1>
        <p role="alert">{error}</p>
      </section>
    )
  }
  if (!data) return <p className="loading">Đang tải...</p>

  const days = buildDays(data.days)
  const maxWords = Math.max(1, ...days.map((d) => d.words))
  const activeDays = days.filter((d) => d.words > 0).length

  return (
    <div className="stack">
      <section className="card">
        <h1>Thống kê</h1>
        <ul className="unit-list">
          <li>Chuỗi hiện tại: <strong>{data.streak.current}</strong> ngày</li>
          <li>Kỷ lục: <strong>{data.streak.best}</strong> ngày</li>
          <li>Tổng số lượt học: <strong>{data.totals.sessions}</strong></li>
          <li>Tổng số lượt từ đã luyện: <strong>{data.totals.words}</strong></li>
          <li>Số ngày có học (30 ngày): <strong>{activeDays}</strong></li>
        </ul>
      </section>

      <section className="card">
        <h2 className="h2-tight">30 ngày gần nhất</h2>
        <p className="muted">Mỗi cột là số từ đã luyện trong ngày.</p>
        <div className="chart" role="img" aria-label="Biểu đồ số từ luyện mỗi ngày trong 30 ngày">
          {days.map((d) => (
            <div
              key={d.day}
              className="chart-col"
              title={`${shortDay(d.day)}: ${d.words} từ (thuộc ${d.good}, chưa thuộc ${d.mid}, không thuộc ${d.bad})`}
            >
              <div
                className="chart-stack"
                style={{ height: `${(d.words / maxWords) * 100}%` }}
              >
                <span className="seg seg-bad" style={{ flexGrow: d.bad }} />
                <span className="seg seg-mid" style={{ flexGrow: d.mid }} />
                <span className="seg seg-good" style={{ flexGrow: d.good }} />
              </div>
            </div>
          ))}
        </div>
        <div className="chart-axis">
          <span>{shortDay(days[0].day)}</span>
          <span>{shortDay(days[29].day)}</span>
        </div>
        <ul className="legend">
          <li><span className="swatch seg-good" /> ✓ {LEVEL_NAMES[2]}</li>
          <li><span className="swatch seg-mid" /> △ {LEVEL_NAMES[1]}</li>
          <li><span className="swatch seg-bad" /> ✗ {LEVEL_NAMES[0]}</li>
        </ul>
        <details>
          <summary>Xem dạng bảng</summary>
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Ngày</th>
                  <th>Lượt</th>
                  <th>Từ</th>
                  <th>Thuộc</th>
                  <th>Chưa</th>
                  <th>Không</th>
                  <th>Điểm</th>
                </tr>
              </thead>
              <tbody>
                {days
                  .filter((d) => d.words > 0)
                  .reverse()
                  .map((d) => (
                    <tr key={d.day}>
                      <td>{shortDay(d.day)}</td>
                      <td>{d.sessions}</td>
                      <td>{d.words}</td>
                      <td>{d.good}</td>
                      <td>{d.mid}</td>
                      <td>{d.bad}</td>
                      <td>{d.score}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      <section className="card">
        <h2 className="h2-tight">Từ hay sai</h2>
        {data.weak.length === 0 ? (
          <p>
            Chưa có dữ liệu. <Link to="/study">Học một lượt</Link> để thấy những từ bạn hay nhầm.
          </p>
        ) : (
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Từ</th>
                  <th>Nghĩa</th>
                  <th>Lần sai</th>
                  <th>Lần gợi ý</th>
                  <th>Hiện tại</th>
                </tr>
              </thead>
              <tbody>
                {data.weak.map((w) => (
                  <tr key={w.key}>
                    <td>{w.word}</td>
                    <td>{w.meaning}</td>
                    <td>{w.wrong}</td>
                    <td>{w.hints}</td>
                    <td>{LEVEL_NAMES[w.mastery as Level] ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}