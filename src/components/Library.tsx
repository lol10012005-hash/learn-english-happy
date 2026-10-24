import { useEffect, useState } from 'react'
import { requestAccessToken } from '../google/picker'
import { readSpreadsheet } from '../google/sheets'
import { fetchLibrary, type LibrarySource } from '../vocab/api'
import { detectMapping, type Mapping } from '../vocab/parser'
import { syncSheet } from '../vocab/sync'

type Props = {
  reloadKey: number
  onChanged: () => void
}

function formatTime(value: string | null): string {
  if (!value) return 'chưa có'
  const date = new Date(value.replace(' ', 'T') + 'Z')
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('vi-VN')
}

export default function Library({ reloadKey, onChanged }: Props) {
  const [sources, setSources] = useState<LibrarySource[] | null>(null)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<number | null>(null)
  const [report, setReport] = useState<string[]>([])

  useEffect(() => {
    let cancelled = false
    fetchLibrary()
      .then((d) => {
        if (cancelled) return
        setSources(d.sources)
        setError('')
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Không tải được thư viện')
      })
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  async function handleResync(source: LibrarySource) {
    setError('')
    setReport([])
    setBusyId(source.id)
    try {
      const token = await requestAccessToken()
      const data = await readSpreadsheet(source.fileId, token)

      const mappings: Record<string, Mapping> = {}
      for (const tab of data.tabs) {
        const saved = source.books.find((b) => b.name === tab.title)?.mapping
        mappings[tab.title] =
          saved && Object.keys(saved).length > 0
            ? saved
            : detectMapping(tab.rows[0] ?? [])
      }

      const lines = await syncSheet({
        fileId: source.fileId,
        data,
        mappings,
        askDelete: (book, count) =>
          window.confirm(
            `Quyển "${book}" có ${count} từ không còn trong Sheet (có thể do bạn đã sửa hoặc xóa).\n\nXóa chúng khỏi thư viện?\nBấm OK để xóa, Hủy để giữ lại.`,
          ),
      })
      setReport(lines)
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Đồng bộ thất bại')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="library">
      <h2>Thư viện của bạn</h2>
      {error && <p role="alert">Lỗi: {error}</p>}
      {sources === null && !error && <p className="loading">Đang tải...</p>}
      {sources && sources.length === 0 && (
        <p>Chưa có quyển nào. Hãy thêm Google Sheet ở phần bên dưới.</p>
      )}

      {sources?.map((s) => (
        <div key={s.id} className="source-box">
          <div className="source-head">
            <div>
              <strong>{s.name}</strong>
              <br />
              <small>Đồng bộ lần cuối: {formatTime(s.lastSyncedAt)}</small>
            </div>
            <button
              className="primary-btn"
              onClick={() => handleResync(s)}
              disabled={busyId !== null}
            >
              {busyId === s.id ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
            </button>
          </div>

          {s.books.map((b) => (
            <div key={b.id} className="tab-box">
              <h3>
                {b.name}{' '}
                <small>
                  ({b.units.reduce((sum, u) => sum + u.count, 0)} từ)
                </small>
              </h3>
              <ul className="unit-list">
                {b.units.map((u) => (
                  <li key={u.id}>
                    {u.name}: <strong>{u.count}</strong> từ
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ))}

      {report.length > 0 && (
        <div className="issues">
          <p>
            <strong>Kết quả đồng bộ:</strong>
          </p>
          <ul>
            {report.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}