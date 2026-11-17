import { describe, expect, it } from 'vitest'
import { visibleSources, type LibrarySource } from './api'

const book = (id: number, archived = false) => ({
  id, name: `Tab ${id}`, mapping: {}, archived, units: [{ id, name: 'Unit 1', count: 3 }],
})
const source = (id: number, archived: boolean, books: ReturnType<typeof book>[]): LibrarySource => ({
  id, name: `File ${id}`, fileId: `F${id}`, lastSyncedAt: null, archived, excludedTabs: [], books,
})

describe('visibleSources', () => {
  it('bỏ file ẩn, quyển ẩn và file không còn quyển nào', () => {
    const all = [
      source(1, false, [book(1), book(2, true)]),
      source(2, true, [book(3)]),
      source(3, false, [book(4, true)]),
      source(4, false, []),
    ]
    const v = visibleSources(all)
    expect(v.map((s) => s.id)).toEqual([1])
    expect(v[0].books.map((b) => b.id)).toEqual([1])
  })
  it('không làm thay đổi dữ liệu gốc', () => {
    const all = [source(1, false, [book(1), book(2, true)])]
    visibleSources(all)
    expect(all[0].books).toHaveLength(2)
  })
  it('danh sách rỗng', () => {
    expect(visibleSources([])).toEqual([])
  })
})