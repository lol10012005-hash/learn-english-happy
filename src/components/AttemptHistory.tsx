import { useEffect, useState } from 'react'
import { fetchAttempts, type AttemptRow } from '../dictation/api'

function formatTime(value: string): string {
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export default function AttemptHistory({
  lessonId,
  reloadKey,
}: {
  lessonId: number
  reloadKey: number
}) {
  const [rows, setRows] = useState<AttemptRow[] | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchAttempts(lessonId)
      .then((d) => {
        if (!cancelled) setRows(d.attempts)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [lessonId, reloadKey])

  if (!rows || rows.length === 0) return null

  return (
    <div className="step-box">
      <h2 className="h2-tight">Lịch sử làm bài</h2>
      <div className="table-scroll">
        <table className="result-table">
          <thead>
            <tr>
              <th>Thời gian</th>
              <th>Nghe đúng</th>
              <th>Gõ đúng</th>
              <th>Điểm</th>
              <th>Lần nghe</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{formatTime(r.createdAt)}</td>
                <td>{r.listenPct}%</td>
                <td>{r.typePct}%</td>
                <td>
                  <strong>{r.score}%</strong>
                  {r.strict ? ' (có dấu câu)' : ''}
                </td>
                <td>{r.listens}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}