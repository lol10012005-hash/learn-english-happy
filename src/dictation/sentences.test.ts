import { describe, expect, it } from 'vitest'
import { splitSentences } from './sentences'

describe('splitSentences', () => {
  it('tách theo dấu kết thúc câu và theo dòng', () => {
    expect(splitSentences('Hello there. How are you?\nSecond line')).toEqual([
      'Hello there.',
      'How are you?',
      'Second line',
    ])
  })
  it('không tách sau từ viết tắt hoặc chữ cái đầu tên', () => {
    expect(splitSentences('Mr. Smith lives in the U.S. with Dr. Brown.')).toEqual([
      'Mr. Smith lives in the U.S. with Dr. Brown.',
    ])
    expect(splitSentences('J. K. Rowling wrote it. She is famous.')).toEqual([
      'J. K. Rowling wrote it.',
      'She is famous.',
    ])
  })
  it('"I." và "a." là từ thật nên vẫn kết thúc câu', () => {
    expect(splitSentences('So do I. Right.')).toEqual(['So do I.', 'Right.'])
  })
  it('số thập phân và dấu ba chấm', () => {
    expect(splitSentences('It costs 3.5 dollars. Wait... Really?')).toEqual([
      'It costs 3.5 dollars.',
      'Wait...',
      'Really?',
    ])
  })
  it('dấu ngoặc kép đóng sau dấu kết thúc câu', () => {
    expect(splitSentences('She said "Go." Then left.')).toEqual(['She said "Go."', 'Then left.'])
  })
  it('bỏ dòng trống và câu chỉ có dấu câu', () => {
    expect(splitSentences('\n  Hi.  \n\n...\n')).toEqual(['Hi.'])
    expect(splitSentences('')).toEqual([])
  })
  it('cắt câu quá dài tại dấu phẩy', () => {
    const long = 'one two three four five, six seven eight nine ten eleven twelve thirteen fourteen'
    const parts = splitSentences(long, 40)
    expect(parts.every((p) => p.length <= 40)).toBe(true)
    expect(parts.join(' ')).toBe(long)
    expect(parts[0].endsWith(',')).toBe(true)
  })
})