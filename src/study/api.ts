import type { StudyWord } from './engine'

export async function fetchStudyWords(unitIds: number[]): Promise<StudyWord[]> {
  const res = await fetch(`/api/study/words?units=${unitIds.join(',')}`)
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `Lỗi máy chủ (${res.status})`,
    )
  }
  return (data as { words: StudyWord[] }).words
}