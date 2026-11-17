import { useEffect, useState } from 'react'
import { requestAccessToken } from '../google/picker'
import { readSpreadsheet } from '../google/sheets'
import {
  deleteBook,
  deleteSource,
  fetchLibrary,
  restoreTab,
  setBookArchived,
  setSourceArchived,
  type LibrarySource,
} from '../vocab/api'
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
  const [acting, setActing] = useState(false)
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

  const locked = busyId !== null || acting

  // Chạy một thao tác quản lý (ẩn, hiện, xóa) rồi tải lại thư viện
  async function manage(action: () => Promise<unknown>) {
    setError('')
    setReport([])
    setActing(true)
    try {
      await action()
      onChanged()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Thao tác thất bại')
    } finally {
      setActing(false)
    }
  }

  function confirmDeleteSource(s: LibrarySource) {
    if (
      !window.confirm(
        `Xóa "${s.name}" khỏi thư viện?\n\nTất cả quyển và từ của file này sẽ bị xóa khỏi web. File Google Sheet của bạn không bị ảnh hưởng, và tiến trình ôn tập vẫn được giữ lại nếu bạn thêm lại sau này.`,
      )
    ) {
      return
    }
    void manage(() => deleteSource(s.id))
  }

  function confirmDeleteBook(name: string, id: number) {
    if (
      !window.confirm(
        `Xóa quyển "${name}" khỏi thư viện?\n\nĐồng bộ lại sẽ không thêm quyển này nữa (bạn có thể bấm "Thêm lại" bất cứ lúc nào). Tiến trình ôn tập được giữ lại.`,
      )
    ) {
      return
    }
    void manage(() => deleteBook(id))
  }

  // Đọc lại Google Sheet rồi đồng bộ. restore: thêm lại một quyển đã xóa.
  async function resync(source: LibrarySource, restore?: string) {
    setError('')
    setReport([])
    setBusyId(source.id)
    try {
      const token = await requestAccessToken() // phải mở ngay sau thao tác bấm nút
      if (restore) await restoreTab(source.id, restore)
      const skip = source.excludedTabs.filter((t) => t !== restore)
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
        skip,
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
      <p className="muted">
        <strong>Ẩn</strong> để tạm không học (có thể hiện lại), <strong>Xóa</strong> để bỏ hẳn
        khỏi web. File Google Sheet của bạn không bao giờ bị thay đổi.
      </p>
      {error && <p role="alert">Lỗi: {error}</p>}
      {sources === null && !error && <p className="loading">Đang tải...</p>}
      {sources && sources.length === 0 && (
        <p>Chưa có quyển nào. Hãy thêm Google Sheet ở phần bên dưới.</p>
      )}

      {sources?.map((s) => (
        <div key={s.id} className={s.archived ? 'source-box dim' : 'source-box'}>
          <div className="source-head">
            <div>
              <strong>{s.name}</strong>
              {s.archived && <span className="badge">Đang ẩn (không học)</span>}
              <br />
              <small>Đồng bộ lần cuối: {formatTime(s.lastSyncedAt)}</small>
            </div>
            <div className="row-actions">
              <button
                className="primary-btn"
                onClick={() => void resync(s)}
                disabled={locked}
              >
                {busyId === s.id ? 'Đang đồng bộ...' : 'Đồng bộ lại'}
              </button>
              <button
                className="ghost-btn"
                onClick={() => void manage(() => setSourceArchived(s.id, !s.archived))}
                disabled={locked}
              >
                {s.archived ? 'Hiện lại' : 'Ẩn'}
              </button>
              <button
                className="ghost-btn danger"
                onClick={() => confirmDeleteSource(s)}
                disabled={locked}
              >
                Xóa
              </button>
            </div>
          </div>

          {s.books.length === 0 && (
            <p className="muted">Không còn quyển nào trong file này.</p>
          )}

          {s.books.map((b) => (
            <div key={b.id} className={b.archived ? 'tab-box dim' : 'tab-box'}>
              <div className="source-head">
                <h3>
                  {b.name}{' '}
                  <small>({b.units.reduce((sum, u) => sum + u.count, 0)} từ)</small>
                  {b.archived && <span className="badge">Đang ẩn</span>}
                </h3>
                <div className="row-actions">
                  <button
                    className="ghost-btn small"
                    onClick={() => void manage(() => setBookArchived(b.id, !b.archived))}
                    disabled={locked}
                  >
                    {b.archived ? 'Hiện lại' : 'Ẩn'}
                  </button>
                  <button
                    className="ghost-btn small danger"
                    onClick={() => confirmDeleteBook(b.name, b.id)}
                    disabled={locked}
                  >
                    Xóa quyển
                  </button>
                </div>
              </div>
              <ul className="unit-list">
                {b.units.map((u) => (
                  <li key={u.id}>
                    {u.name}: <strong>{u.count}</strong> từ
                  </li>
                ))}
              </ul>
            </div>
          ))}

          {s.excludedTabs.length > 0 && (
            <div className="excluded">
              <small>Quyển đã xóa hoặc không thêm:</small>
              <ul className="unit-list">
                {s.excludedTabs.map((name) => (
                  <li key={name}>
                    {name}{' '}
                    <button
                      className="link-btn link-btn-plain"
                      onClick={() => void resync(s, name)}
                      disabled={locked}
                    >
                      Thêm lại
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
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