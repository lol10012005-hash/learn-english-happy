import { useEffect, useState } from 'react'
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
          <p>Tìm thấy {data.tabs.length} quyển (trang tính).</p>
          {data.tabs.map((tab) => (
            <div key={tab.title} className="tab-box">
              <h3>
                {tab.title} <small>({Math.max(tab.rows.length - 1, 0)} dòng dữ liệu)</small>
              </h3>
              <div className="table-scroll">
                <table>
                  <tbody>
                    {tab.rows.slice(0, 6).map((row, r) => (
                      <tr key={r}>
                        {row.slice(0, 6).map((cell, c) => (
                          <td key={c}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}