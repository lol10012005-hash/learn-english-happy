import type { Mapping } from './parser'

export type LibraryUnit = { id: number; name: string; count: number }
export type LibraryBook = {
  id: number
  name: string
  mapping: Mapping
  archived: boolean
  units: LibraryUnit[]
}
export type LibrarySource = {
  id: number
  name: string
  fileId: string
  lastSyncedAt: string | null
  archived: boolean
  excludedTabs: string[] // các quyển đã xóa: Đồng bộ lại sẽ không thêm lại
  books: LibraryBook[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Lỗi máy chủ (${res.status})`,
    )
  }
  return data as T
}

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: body === undefined ? undefined : JSON.stringify(body),
})

export function fetchLibrary() {
  return request<{ sources: LibrarySource[] }>('/api/vocab/library')
}

// Phần đang học: bỏ file và quyển đang ẩn, bỏ file không còn quyển nào
export function visibleSources(sources: LibrarySource[]): LibrarySource[] {
  return sources
    .filter((s) => !s.archived)
    .map((s) => ({ ...s, books: s.books.filter((b) => !b.archived) }))
    .filter((s) => s.books.length > 0)
}

export type SaveBookPayload = {
  fileId: string
  fileName: string
  bookName: string
  position: number
  mapping: Mapping
  words: Array<{
    key: string
    unit: string
    word: string
    meaning: string
    example: string
    extra: string
  }>
  deleteMissing: boolean
}

export type SaveBookResult = {
  bookId: number
  added: number
  updated: number
  unchanged: number
  missing: number
  deleted: number
}

export function saveBook(payload: SaveBookPayload) {
  return request<SaveBookResult>('/api/vocab/sync', jsonInit('POST', payload))
}

// ----- Quản lý thư viện

export function setSourceArchived(id: number, archived: boolean) {
  return request<{ ok: true }>(`/api/vocab/sources/${id}`, jsonInit('PATCH', { archived }))
}

export function setBookArchived(id: number, archived: boolean) {
  return request<{ ok: true }>(`/api/vocab/books/${id}`, jsonInit('PATCH', { archived }))
}

export function deleteSource(id: number) {
  return request<{ ok: true }>(`/api/vocab/sources/${id}`, jsonInit('DELETE'))
}

export function deleteBook(id: number) {
  return request<{ ok: true }>(`/api/vocab/books/${id}`, jsonInit('DELETE'))
}

// Cho phép thêm lại một quyển đã xóa (lần Đồng bộ lại kế tiếp sẽ thêm nó)
export function restoreTab(sourceId: number, tab: string) {
  return request<{ ok: true }>(
    `/api/vocab/sources/${sourceId}`,
    jsonInit('PATCH', { restoreTab: tab }),
  )
}

// Ghi nhớ các tab người học không muốn thêm khi chọn Google Sheet
export function saveExcludedTabs(fileId: string, tabs: string[]) {
  return request<{ ok: true }>('/api/vocab/excluded', jsonInit('POST', { fileId, tabs }))
}