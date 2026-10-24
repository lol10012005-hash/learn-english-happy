import { useEffect, useState } from 'react'
import Library from '../components/Library'
import TabPreview from '../components/TabPreview'
import {
  pickSpreadsheet,
  preloadGoogle,
  requestAccessToken,
  type PickedFile,
} from '../google/picker'
import { readSpreadsheet, type SheetData } from '../google/sheets'
import { fetchLibrary } from '../vocab/api'
import { detectMapping, type Mapping } from '../vocab/parser'
import { syncSheet } from '../vocab/sync'

export default function Vocab() {
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SheetData | null>(null)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [mappings, setMappings] = useState<Record<string, Mapping>>({})
  const [version, setVersion] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)
  const [report, setReport] = useState<string[]>([])

  useEffect(() => {
    preloadGoogle().catch(() => {
      // lỗi sẽ được báo khi người dùng bấm nút
    })
  }, [])

  async function handlePick() {
    setError('')
    setReport([])
    setBusy(true)
    try {
      const token = await requestAccessToken()
      const picked = await pickSpreadsheet(token)
      if (!picked) return
      const sheet = await readSpreadsheet(picked.id, token)

      // Nếu file này đã lưu trước đó thì dùng lại ánh xạ cột đã lưu
      const library = await fetchLibrary().catch(() => null)
      const known = library?.sources.find((s) => s.fileId === picked.id)
      const initial: Record<string, Mapping> = {}
      for (const tab of sheet.tabs) {
        const saved = known?.books.find((b) => b.name === tab.title)?.mapping
        initial[tab.title] =
          saved && Object.keys(saved).length > 0
            ? saved
            : detectMapping(tab.rows[0] ?? [])
      }

      setFile(picked)
      setData(sheet)
      setMappings(initial)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!data || !file) return
    setError('')
    setReport([])
    setSaving(true)
    try {
      const lines = await syncSheet({
        fileId: file.id,
        data,
        mappings,
        askDelete: (book, count) =>
          window.confirm(
            `Quyển "${book}" có ${count} từ không còn trong Sheet.\n\nXóa chúng khỏi thư viện?\nBấm OK để xóa, Hủy để giữ lại.`,
          ),
      })
      setReport(lines)
      setReloadKey((k) => k + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lưu thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="card">
      <h1>Từ vựng</h1>

      <Library
        reloadKey={reloadKey}
        onChanged={() => setReloadKey((k) => k + 1)}
      />

      <hr className="divider" />

      <h2>Thêm Google Sheet</h2>
      <p>Chọn Google Sheet từ vựng của bạn. Mỗi tab là một quyển.</p>
      <button
        className="primary-btn"
        onClick={handlePick}
        disabled={busy || saving}
      >
        {busy ? 'Đang xử lý...' : 'Chọn Google Sheet'}
      </button>
      {error && <p role="alert">Lỗi: {error}</p>}

      {data && (
        <div className="sheet-preview">
          <h2>{data.title}</h2>
          <p>
            Tìm thấy {data.tabs.length} quyển (trang tính). Kiểm tra cột được
            nhận, sửa lại nếu sai, rồi bấm Lưu.
          </p>
          {data.tabs.map((tab) => (
            <TabPreview
              key={`${version}-${tab.title}`}
              tab={tab}
              mapping={mappings[tab.title] ?? {}}
              onMappingChange={(m) =>
                setMappings((prev) => ({ ...prev, [tab.title]: m }))
              }
            />
          ))}
          <p>
            <button
              className="primary-btn"
              onClick={handleSave}
              disabled={saving || busy}
            >
              {saving ? 'Đang lưu...' : 'Lưu vào thư viện'}
            </button>
          </p>
          {report.length > 0 && (
            <div className="issues">
              <p>
                <strong>Kết quả:</strong>
              </p>
              <ul>
                {report.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  )
}