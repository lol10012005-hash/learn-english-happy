import { useMemo, useState } from 'react'
import type { SheetTab } from '../google/sheets'
import {
  COLUMN_LABELS,
  COLUMN_ORDER,
  detectMapping,
  parseTab,
  type ColumnKey,
  type Mapping,
} from '../vocab/parser'

function columnLetter(i: number): string {
  return String.fromCharCode(65 + (i % 26))
}

export default function TabPreview({ tab }: { tab: SheetTab }) {
  const header = tab.rows[0] ?? []
  const [mapping, setMapping] = useState<Mapping>(() => detectMapping(header))
  const result = useMemo(() => parseTab(tab.rows, mapping), [tab.rows, mapping])

  function change(key: ColumnKey, value: string) {
    setMapping((prev) => {
      const next = { ...prev }
      if (value === '') delete next[key]
      else next[key] = Number(value)
      return next
    })
  }

  return (
    <div className="tab-box">
      <h3>
        {tab.title}{' '}
        <small>
          {result.ready
            ? `(${result.words.length} từ hợp lệ, ${result.units.length} unit)`
            : '(chưa chọn đủ cột)'}
        </small>
      </h3>

      <div className="mapping-grid">
        {COLUMN_ORDER.map((key) => (
          <label key={key} className="map-field">
            <span>{COLUMN_LABELS[key]}</span>
            <select
              value={mapping[key] ?? ''}
              onChange={(e) => change(key, e.target.value)}
            >
              <option value="">— Không dùng —</option>
              {header.map((h, i) => (
                <option key={i} value={i}>
                  Cột {columnLetter(i)}: {h || '(trống)'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {!result.ready && (
        <p role="alert">
          Hãy chọn cột <strong>Từ vựng</strong> và cột <strong>Nghĩa</strong>{' '}
          để tiếp tục.
        </p>
      )}

      {result.ready && (
        <>
          <ul className="unit-list">
            {result.units.map((u) => (
              <li key={u.name}>
                {u.name}: <strong>{u.count}</strong> từ
              </li>
            ))}
          </ul>

          {result.issues.length > 0 && (
            <div className="issues">
              <p>
                <strong>{result.issues.length} dòng có vấn đề</strong> (các
                dòng này sẽ bị bỏ qua):
              </p>
              <ul>
                {result.issues.slice(0, 10).map((issue, i) => (
                  <li key={i}>
                    Dòng {issue.row}: {issue.text}
                  </li>
                ))}
              </ul>
              {result.issues.length > 10 && (
                <p>... và {result.issues.length - 10} dòng nữa.</p>
              )}
            </div>
          )}

          <details>
            <summary>Xem 5 từ đầu tiên</summary>
            <div className="table-scroll">
              <table>
                <tbody>
                  <tr>
                    <td>Từ</td>
                    <td>Nghĩa</td>
                    <td>Ví dụ</td>
                    <td>Unit</td>
                  </tr>
                  {result.words.slice(0, 5).map((w) => (
                    <tr key={w.row}>
                      <td>{w.word}</td>
                      <td>{w.meaning}</td>
                      <td>{w.example}</td>
                      <td>{w.unit}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </div>
  )
}