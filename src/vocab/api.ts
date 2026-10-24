import type { Mapping } from './parser'

export type LibraryUnit = { id: number; name: string; count: number }
export type LibraryBook = {
  id: number
  name: string
  mapping: Mapping
  units: LibraryUnit[]
}
export type LibrarySource = {
  id: number
  name: string
  fileId: string
  lastSyncedAt: string | null
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

export function fetchLibrary() {
  return request<{ sources: LibrarySource[] }>('/api/vocab/library')
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
  return request<SaveBookResult>('/api/vocab/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}