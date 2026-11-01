import type { AttemptSave } from '../dictation/api'
import { errorList, segments, type GradeItem, type GradeResult, type Segment } from '../dictation/diff'

type Props = {
  title: string
  origText: string
  typedText: string
  result: GradeResult
  save: AttemptSave
  onRetrySave: () => void
  onEdit: () => void
  onRestart: () => void
}

const TYPE_LABEL = {
  spelling: 'Sai chính tả',
  misheard: 'Nghe sai',
  missing: 'Thiếu từ',
  extra: 'Thừa từ',
} as const

const TYPE_MARK = { spelling: '✎', misheard: '✗', missing: '＋', extra: '－' } as const

// Bài gõ đã sửa tại chỗ: từ sai gạch ngang, từ đúng viết bên cạnh
function TypedView({ segs }: { segs: Segment[] }) {
  return (
    <div className="grade-text" lang="en">
      {segs.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.text}</span>
        const { item } = s
        if (item.type === 'correct') return <span key={i}>{s.text}</span>
        const label = TYPE_LABEL[item.type]
        if (item.type === 'missing') {
          return (
            <ins key={i} className="w w-missing" title={label}>
              <sup aria-hidden="true">{TYPE_MARK.missing}</sup>
              {item.orig.join(' ')}
              <span className="sr-only"> ({label})</span>
            </ins>
          )
        }
        if (item.type === 'extra') {
          return (
            <del key={i} className="w w-extra" title={label}>
              <sup aria-hidden="true">{TYPE_MARK.extra}</sup>
              {s.text}
              <span className="sr-only"> ({label})</span>
            </del>
          )
        }
        return (
          <span
            key={i}
            className={`w w-${item.type}`}
            title={item.homophone ? `${label} (từ đồng âm)` : label}
          >
            <sup aria-hidden="true">{TYPE_MARK[item.type]}</sup>
            <del>{s.text}</del> <ins>{item.orig.join(' ')}</ins>
            <span className="sr-only"> ({label})</span>
          </span>
        )
      })}
    </div>
  )
}

function OrigView({ segs }: { segs: Segment[] }) {
  return (
    <div className="grade-text" lang="en">
      {segs.map((s, i) => {
        if (s.kind === 'text') return <span key={i}>{s.text}</span>
        const t = s.item.type
        if (t === 'correct' || t === 'extra') return <span key={i}>{s.text}</span>
        return (
          <mark key={i} className={`m m-${t}`} title={TYPE_LABEL[t]}>
            {s.text}
            <span className="sr-only"> ({TYPE_LABEL[t]})</span>
          </mark>
        )
      })}
    </div>
  )
}

const hasHomophone = (items: GradeItem[]) => items.some((i) => i.homophone)

export default function DictationResult({
  title,
  origText,
  typedText,
  result,
  save,
  onRetrySave,
  onEdit,
  onRestart,
}: Props) {
  const c = result.counts
  const errors = errorList(result)

  return (
    <section className="card">
      <h1>Kết quả: {title}</h1>

      <div className="metrics">
        <div className="metric">
          <strong>{result.listenPct}%</strong>
          <span>Nghe đúng</span>
          <small>Từ bạn nghe ra đúng (kể cả khi gõ sai chính tả)</small>
        </div>
        <div className="metric">
          <strong>{result.typePct}%</strong>
          <span>Gõ đúng</span>
          <small>Từ viết đúng hoàn toàn</small>
        </div>
        <div className="metric">
          <strong>{result.score}%</strong>
          <span>Điểm</span>
          <small>Có trừ nhẹ khi gõ thừa từ</small>
        </div>
      </div>
      <p className="muted">
        Chấm {result.total} từ{result.strict ? ', có tính dấu câu và chữ hoa' : ' (bỏ qua dấu câu và chữ hoa)'}.
      </p>

      <ul className="unit-list">
        <li>✓ Đúng: <strong>{c.correct}</strong></li>
        <li>{TYPE_MARK.spelling} Sai chính tả: <strong>{c.spelling}</strong></li>
        <li>{TYPE_MARK.misheard} Nghe sai: <strong>{c.misheard}</strong></li>
        <li>{TYPE_MARK.missing} Thiếu từ: <strong>{c.missing}</strong></li>
        <li>{TYPE_MARK.extra} Thừa từ: <strong>{c.extra}</strong></li>
      </ul>

      <div className="save-box" role="status">
        {save.status === 'saving' && <p>Đang lưu kết quả...</p>}
        {save.status === 'saved' && <p>✓ Đã lưu kết quả vào lịch sử.</p>}
        {save.status === 'error' && (
          <>
            <p role="alert">Chưa lưu được kết quả: {save.message}</p>
            <button className="ghost-btn" onClick={onRetrySave}>
              Thử lưu lại
            </button>
          </>
        )}
      </div>

      <h2 className="h2-tight">Bài của bạn (đã sửa lỗi)</h2>
      <ul className="legend grade-legend">
        <li><span className="w w-spelling"><sup>✎</sup><del>gõ</del> <ins>đúng</ins></span> sai chính tả</li>
        <li><span className="w w-misheard"><sup>✗</sup><del>gõ</del> <ins>đúng</ins></span> nghe sai</li>
        <li><ins className="w w-missing"><sup>＋</sup>từ</ins> thiếu từ</li>
        <li><del className="w w-extra"><sup>－</sup>từ</del> thừa từ</li>
      </ul>
      <TypedView segs={segments(typedText, result, 'typed')} />

      <h2 className="h2-tight">Đối chiếu với văn bản gốc</h2>
      <div className="compare">
        <div>
          <h3>Bài của bạn</h3>
          <div className="grade-text" lang="en">{typedText}</div>
        </div>
        <div>
          <h3>Văn bản gốc</h3>
          <OrigView segs={segments(origText, result, 'orig')} />
        </div>
      </div>

      {errors.length > 0 && (
        <>
          <h2 className="h2-tight">Danh sách lỗi ({errors.length})</h2>
          <div className="table-scroll">
            <table className="result-table">
              <thead>
                <tr>
                  <th>Loại lỗi</th>
                  <th>Bạn gõ</th>
                  <th>Đáp án</th>
                </tr>
              </thead>
              <tbody>
                {errors.map((e, i) => (
                  <tr key={i}>
                    <td>
                      {TYPE_MARK[e.type]} {TYPE_LABEL[e.type]}
                      {e.homophone ? ' (đồng âm)' : ''}
                    </td>
                    <td>{e.typed || '—'}</td>
                    <td>{e.orig || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasHomophone(result.items) && (
            <p className="muted">
              Từ đồng âm đọc giống nhau (như there/their), nên cần dựa vào ngữ cảnh để chọn từ đúng.
            </p>
          )}
        </>
      )}
      {errors.length === 0 && <p>🎉 Không có lỗi nào. Bạn chép đúng hoàn toàn!</p>}

      <div className="play-actions">
        <button className="primary-btn" onClick={onRestart}>
          Làm lại từ đầu
        </button>
        <button className="ghost-btn" onClick={onEdit}>
          Quay lại sửa bài
        </button>
      </div>
    </section>
  )
}