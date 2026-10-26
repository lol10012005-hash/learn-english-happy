import { describe, expect, it } from 'vitest'
import { countWords, parseScript } from './script'

describe('parseScript', () => {
  it('bỏ dòng ghi chú # và dòng trống', () => {
    const r = parseScript('# Bài 1\n\nHello there.\n  # ghi chú thụt vào\nHow are you?\n')
    expect(r.text).toBe('Hello there.\nHow are you?')
    expect(r.notes).toBe(2)
    expect(r.cues).toEqual([])
  })
  it('xử lý BOM, CRLF và khoảng trắng đặc biệt', () => {
    const r = parseScript('\uFEFFHello\u00a0world.\r\nSecond line.\r\n')
    expect(r.text).toBe('Hello world.\nSecond line.')
  })
  it('đọc mốc thời gian [mm:ss] và [h:mm:ss]', () => {
    const r = parseScript('[0:00] Hello.\n[00:07] How are you?\n[1:02:03] Late line.')
    expect(r.text).toBe('Hello.\nHow are you?\nLate line.')
    expect(r.cues).toEqual([
      { t: 0, text: 'Hello.' },
      { t: 7, text: 'How are you?' },
      { t: 3723, text: 'Late line.' },
    ])
  })
  it('câu nhiều dòng được nối vào mốc trước đó', () => {
    const r = parseScript('[0:05] This is a long\nsentence here.\n[0:12] Next.')
    expect(r.cues).toEqual([
      { t: 5, text: 'This is a long sentence here.' },
      { t: 12, text: 'Next.' },
    ])
    expect(r.text).toBe('This is a long\nsentence here.\nNext.')
  })
  it('mốc sai (giây > 59) hoặc không ở đầu dòng thì giữ nguyên là chữ', () => {
    const r = parseScript('[0:75] Oops.\nSee [0:10] in the text.')
    expect(r.text).toBe('[0:75] Oops.\nSee [0:10] in the text.')
    expect(r.cues).toEqual([])
  })
  it('dòng chỉ có mốc thời gian thì bỏ qua', () => {
    expect(parseScript('[0:01]\nHi.').text).toBe('Hi.')
  })
  it('văn bản trống', () => {
    expect(parseScript('# chỉ có ghi chú\n\n').text).toBe('')
  })
})

describe('countWords', () => {
  it('đếm từ, giữ nguyên từ có dấu nháy và gạch nối', () => {
    expect(countWords("I don't know, well-known 5 times.")).toBe(6)
    expect(countWords('It’s fine.')).toBe(2)
    expect(countWords('')).toBe(0)
    expect(countWords('... !!!')).toBe(0)
  })
})