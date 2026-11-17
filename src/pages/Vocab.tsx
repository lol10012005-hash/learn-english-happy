import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Library from '../components/Library'
import TabPreview from '../components/TabPreview'
import {
  pickSpreadsheet,
  preloadGoogle,
  requestAccessToken,
  type PickedFile,
} from '../google/picker'
import { readSpreadsheet, type SheetData } from '../google/sheets'
import { fetchLibrary, saveExcludedTabs } from '../vocab/api'
import { detectMapping, type Mapping } from '../vocab/parser'
import { syncSheet } from '../vocab/sync'

export default function Vocab() {
  const [busy, setBusy] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SheetData | null>(null)
  const [file, setFile] = useState<PickedFile | null>(null)
  const [mappings, setMappings] = useState<Record<string, Mapping>>({})
  const [included, setIncluded] = useState<Record<string, boolean>>({})
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

      // Nếu file này đã lưu trước đó thì dùng lại ánh xạ cột và danh sách quyển đã bỏ
      const library = await fetchLibrary().catch(() => null)
      const known = library?.sources.find((s) => s.fileId === picked.id)
      const initial: Record<string, Mapping> = {}
      const include: Record<string, boolean> = {}
      for (const tab of sheet.tabs) {
        const saved = known?.books.find((b) => b.name === tab.title)?.mapping
        initial[tab.title] =
          saved && Object.keys(saved).length > 0
            ? saved
            : detectMapping(tab.rows[0] ?? [])
        include[tab.title] = !known?.excludedTabs.includes(tab.title)
      }

      setFile(picked)
      setData(sheet)
      setMappings(initial)
      setIncluded(include)
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  async function handleSave() {
    if (!data || !file) return
    const skip = data.tabs.filter((t) => included[t.title] === false).map((t) => t.title)
    if (skip.length === data.tabs.length) {
      setError('Hãy chọn ít nhất một quyển để thêm vào thư viện.')
      return
    }
    setError('')
    setReport([])
    setSaving(true)
    try {
      const lines = await syncSheet({
        fileId: file.id,
        data,
        mappings,
        skip,
        askDelete: (book, count) =>
          window.confirm(
            `Quyển "${book}" có ${count} từ không còn trong Sheet.\n\nXóa chúng khỏi thư viện?\nBấm OK để xóa, Hủy để giữ lại.`,
          ),
      })
      // Ghi nhớ các quyển bỏ chọn để Đồng bộ lại không thêm vào
      await saveExcludedTabs(file.id, skip)
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
      <p>
        <Link className="primary-btn link-as-btn" to="/study">
          Bắt đầu học ➜
        </Link>
      </p>

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
      {error && <p role="alert">{error}</p>}

      {data && (
        <div className="sheet-preview">
          <h2>{data.title}</h2>
          <p>
            Tìm thấy {data.tabs.length} quyển (trang tính). Tích chọn quyển cần thêm,
            bỏ tích quyển không học. Kiểm tra cột được nhận, sửa lại nếu sai, rồi bấm Lưu.
          </p>
          {data.tabs.map((tab) => {
            const on = included[tab.title] !== false
            return (
              <div key={`${version}-${tab.title}`} className="tab-pick">
                <label className="check">
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={(e) =>
                      setIncluded((prev) => ({ ...prev, [tab.title]: e.target.checked }))
                    }
                  />
                  <span>
                    Thêm quyển <strong>{tab.title}</strong> vào thư viện
                  </span>
                </label>
                {on && (
                  <TabPreview
                    tab={tab}
                    mapping={mappings[tab.title] ?? {}}
                    onMappingChange={(m) =>
                      setMappings((prev) => ({ ...prev, [tab.title]: m }))
                    }
                  />
                )}
              </div>
            )
          })}
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