import { useEffect, useState } from 'react'
import TabPreview from '../components/TabPreview'
import {
  pickSpreadsheet,
  preloadGoogle,
  requestAccessToken,
} from '../google/picker'
import { readSpreadsheet, type SheetData } from '../google/sheets'

export default function Vocab() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [data, setData] = useState<SheetData | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => {
    preloadGoogle().catch(() => {
      // lỗi sẽ được báo khi người dùng bấm nút
    })
  }, [])

  async function handlePick() {
    setError('')
    setBusy(true)
    try {
      const token = await requestAccessToken()
      const file = await pickSpreadsheet(token)
      if (!file) return
      setData(await readSpreadsheet(file.id, token))
      setVersion((v) => v + 1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Có lỗi xảy ra')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="card">
      <h1>Từ vựng</h1>
      <p>Chọn Google Sheet từ vựng của bạn. Mỗi tab là một quyển.</p>
      <button className="primary-btn" onClick={handlePick} disabled={busy}>
        {busy ? 'Đang xử lý...' : 'Chọn Google Sheet'}
      </button>
      {error && <p role="alert">Lỗi: {error}</p>}

      {data && (
        <div className="sheet-preview">
          <h2>{data.title}</h2>
          <p>
            Tìm thấy {data.tabs.length} quyển (trang tính). Kiểm tra cột được
            nhận, sửa lại nếu sai.
          </p>
          {data.tabs.map((tab) => (
            <TabPreview key={`${version}-${tab.title}`} tab={tab} />
          ))}
        </div>
      )}
    </section>
  )
}