import { describe, expect, it } from 'vitest'
import {
  countTokens, errorList, grade, gradeBanded, scoreFromCounts, segments, tokenize,
  type GradeOptions,
} from './diff'

// Danh sách lỗi dạng gọn: [loại, từ gốc, từ gõ]
const errs = (orig: string, typed: string, opt?: GradeOptions) =>
  errorList(grade(orig, typed, opt)).map((e) => [e.type, e.orig, e.typed])

describe('trường hợp cơ bản', () => {
  it('1. giống hệt thì đúng 100%', () => {
    const r = grade('Hello there. How are you?', 'Hello there. How are you?')
    expect(r.counts).toEqual({ correct: 5, spelling: 0, misheard: 0, missing: 0, extra: 0 })
    expect([r.listenPct, r.typePct, r.score]).toEqual([100, 100, 100])
  })
  it('2. mặc định bỏ qua hoa thường, dấu câu, khoảng trắng và xuống dòng', () => {
    expect(errs('Hello, World!\nHow are you?', '  hello   world how\nare YOU')).toEqual([])
  })
  it('3. sai chính tả: necessary -> neccessary', () => {
    expect(errs('It is necessary.', 'It is neccessary.')).toEqual([['spelling', 'necessary', 'neccessary']])
  })
  it('4. nghe sai: there -> their (cùng cách đọc, đánh dấu đồng âm)', () => {
    const r = grade('I went there', 'I went their')
    expect(errorList(r)).toEqual([{ type: 'misheard', orig: 'there', typed: 'their', homophone: true }])
  })
  it('5. thiếu từ', () => {
    expect(errs('I went to the store', 'I went the store')).toEqual([['missing', 'to', '']])
  })
  it('6. thừa từ', () => {
    expect(errs('I went to the store', 'I went to the big store')).toEqual([['extra', '', 'big']])
  })
  it('7. nghe thành từ hoàn toàn khác', () => {
    expect(errs('I like coffee', 'I like banana')).toEqual([['misheard', 'coffee', 'banana']])
  })
  it('8. bỏ trống: tất cả là thiếu, 0%', () => {
    const r = grade('One two three', '')
    expect(r.counts.missing).toBe(3)
    expect([r.listenPct, r.typePct, r.score]).toEqual([0, 0, 0])
  })
  it('9. văn bản gốc trống: tổng 0, không chia cho 0', () => {
    const r = grade('', 'hello world')
    expect(r.total).toBe(0)
    expect(r.counts.extra).toBe(2)
    expect([r.listenPct, r.typePct, r.score]).toEqual([0, 0, 0])
  })
  it('10. cả hai đều trống', () => {
    const r = grade('', '')
    expect(r.items).toEqual([])
    expect(r.score).toBe(0)
  })
})

describe('phân loại sai chính tả và nghe sai', () => {
  it('11. đảo chữ cái: recieve -> receive là sai chính tả', () => {
    expect(errs('I receive it', 'I recieve it')).toEqual([['spelling', 'receive', 'recieve']])
  })
  it('12. từ ngắn khác nhau là từ khác: cat/car, the/they', () => {
    expect(errs('the cat', 'they car')).toEqual([
      ['misheard', 'the', 'they'],
      ['misheard', 'cat', 'car'],
    ])
  })
  it('13. khác đuôi (apple/apples, walk/walked) là nghe sai', () => {
    expect(errs('one apple', 'one apples')).toEqual([['misheard', 'apple', 'apples']])
    expect(errs('we walked home', 'we walk home')).toEqual([['misheard', 'walked', 'walk']])
  })
  it('14. thiếu chữ cái ở từ dài là sai chính tả', () => {
    expect(errs('a beautiful day', 'a beutiful day')).toEqual([['spelling', 'beautiful', 'beutiful']])
  })
  it('15. dấu phụ: café -> cafe là sai chính tả', () => {
    expect(errs('a nice café', 'a nice cafe')).toEqual([['spelling', 'café', 'cafe']])
  })
  it('16. tùy chọn: từ đồng âm tính là sai chính tả', () => {
    expect(errs('over there', 'over their', { homophones: 'spelling' })).toEqual([['spelling', 'there', 'their']])
  })
})

describe('co từ, gạch nối, nháy cong', () => {
  it('17. dấu nháy cong và thẳng như nhau', () => {
    expect(errs('I don’t know', "I don't know")).toEqual([])
    expect(errs("It's fine", 'It’s fine')).toEqual([])
  })
  it('18. thiếu dấu nháy: dont -> sai chính tả', () => {
    expect(errs("I don't know", 'I dont know')).toEqual([['spelling', "don't", 'dont']])
  })
  it('19. its / it\'s: nghe đúng, gõ sai', () => {
    expect(errs("it's late", 'its late')).toEqual([['spelling', "it's", 'its']])
  })
  it('20. gõ đầy đủ thay cho từ rút gọn: I\'m -> I am', () => {
    const r = grade("I'm happy", 'I am happy')
    expect(errorList(r)).toEqual([{ type: 'spelling', orig: "I'm", typed: 'I am', homophone: false }])
    expect(r.counts).toMatchObject({ correct: 1, spelling: 1 })
  })
  it('21. gõ rút gọn thay cho dạng đầy đủ: do not -> don\'t', () => {
    const r = grade('I do not know', "I don't know")
    expect(errorList(r)).toEqual([{ type: 'spelling', orig: 'do not', typed: "don't", homophone: false }])
    expect(r.counts).toMatchObject({ correct: 2, spelling: 2 })
  })
  it('22. cannot / can\'t / can not', () => {
    expect(errs('I cannot go', "I can't go")).toEqual([['spelling', 'cannot', "can't"]])
    expect(errs("I can't go", 'I can not go')).toEqual([['spelling', "can't", 'can not']])
  })
  it('23. will not / won\'t', () => {
    expect(errs("I won't go", 'I will not go')).toEqual([['spelling', "won't", 'will not']])
  })
  it('24. gạch nối: well-known khớp, well known hoặc wellknown là sai chính tả', () => {
    expect(errs('a well-known actor', 'a well-known actor')).toEqual([])
    expect(errs('a well-known actor', 'a well known actor')).toEqual([['spelling', 'well-known', 'well known']])
    expect(errs('a well-known actor', 'a wellknown actor')).toEqual([['spelling', 'well-known', 'wellknown']])
  })
  it('25. chữ viết tắt: U.S. gõ là US, Dr. gõ là Dr', () => {
    expect(errs('the U.S. today', 'the US today')).toEqual([['spelling', 'U S', 'US']])
    expect(errs('Dr. Smith', 'Dr Smith')).toEqual([])
  })
})

describe('số và chữ', () => {
  it('26. 5 và five tương đương', () => {
    expect(errs('I have five cats', 'I have 5 cats')).toEqual([])
    expect(errs('I have 5 cats', 'I have five cats')).toEqual([])
  })
  it('27. số ghép: twenty-one, twenty one, 21', () => {
    expect(errs('I am twenty-one', 'I am 21')).toEqual([])
    expect(errs('I am 21', 'I am twenty one')).toEqual([])
    expect(errs('I am twenty one', 'I am 21')).toEqual([])
  })
  it('28. số lớn: 1,000 / one thousand / one hundred', () => {
    expect(errs('it costs one thousand dollars', 'it costs 1,000 dollars')).toEqual([])
    expect(errs('it costs 100 dollars', 'it costs one hundred dollars')).toEqual([])
    expect(errs('one hundred and five', '105')).toEqual([])
    expect(errs('105 people', 'one hundred and five people')).toEqual([])
    expect(errs('twenty five thousand', '25,000')).toEqual([])
    expect(errs('one hundred and five', '106')).not.toEqual([])
  })
  it('29. số khác giá trị là nghe sai, hai số rời nhau không gộp thành một', () => {
    expect(errs('I have 5 cats', 'I have 6 cats')).toEqual([['misheard', '5', '6']])
    const e = errs('one two', '3').map((x) => x[0]).sort()
    expect(e).toEqual(['misheard', 'missing'])
  })
  it('30. số thập phân và phần trăm', () => {
    expect(errs('it is 3.5 meters', 'it is 3.5 meters')).toEqual([])
    expect(countTokens('3.5 and 1,000 and 2nd')).toBe(5)
  })
})

describe('công thức phần trăm', () => {
  it('31. đếm đủ từng loại lỗi trong một câu', () => {
    const orig = 'the quick brown fox jumps over the lazy sleeping dog'
    const typed = 'the quick brown fox jumpz over the lazy big banana'
    const r = grade(orig, typed)
    // jumps -> jumpz (sai chính tả), sleeping -> big và dog -> banana (nghe sai)
    expect(r.counts).toEqual({ correct: 7, spelling: 1, misheard: 2, missing: 0, extra: 0 })
    expect(r.total).toBe(10)
    const r2 = grade('the quick brown fox', 'the quick very brown')
    expect(r2.counts).toEqual({ correct: 3, spelling: 0, misheard: 0, missing: 1, extra: 1 })
  })
  it('32. công thức đúng theo đề xuất', () => {
    const c = { correct: 7, spelling: 1, misheard: 1, missing: 1, extra: 1 }
    expect(scoreFromCounts(c)).toEqual({ total: 10, listenPct: 80, typePct: 70, score: 68.2 })
  })
  it('33. làm tròn 1 chữ số thập phân', () => {
    const r = scoreFromCounts({ correct: 1, spelling: 0, misheard: 2, missing: 0, extra: 0 })
    expect([r.listenPct, r.typePct, r.score]).toEqual([33.3, 33.3, 33.3])
  })
  it('34. nghe đúng luôn >= gõ đúng', () => {
    const r = grade("it's a necessary thing", 'its a neccessary thing')
    expect(r.listenPct).toBeGreaterThanOrEqual(r.typePct)
    expect(r.typePct).toBe(50)
    expect(r.listenPct).toBe(100)
    expect(r.score).toBe(75)
  })
})

describe('chế độ chấm cả dấu câu và chữ hoa', () => {
  const strict = { strict: true }
  it('35. giống hệt thì đúng hết', () => {
    expect(errs('Hello, World!', 'Hello, World!', strict)).toEqual([])
  })
  it('36. sai chữ hoa là sai chính tả (nghe đúng, gõ sai)', () => {
    expect(errs('Hello, World!', 'hello, World!', strict)).toEqual([['spelling', 'Hello', 'hello']])
  })
  it('37. thiếu dấu câu là sai chính tả', () => {
    expect(errs('Hello, World!', 'Hello World!', strict)).toEqual([['spelling', 'Hello', 'Hello']])
    expect(errs('Hello, World!', 'Hello, World', strict)).toEqual([['spelling', 'World', 'World']])
  })
  it('38. chế độ thường vẫn bỏ qua các khác biệt đó', () => {
    expect(errs('Hello, World!', 'hello world')).toEqual([])
  })
})

describe('căn chỉnh', () => {
  it('39. lặp từ: gõ thiếu một từ "the"', () => {
    expect(errs('the the cat', 'the cat')).toEqual([['missing', 'the', '']])
  })
  it('40. nhiều lỗi liền nhau vẫn khớp phần còn lại', () => {
    const r = grade('a b c d e f g', 'a x y z e f g')
    expect(r.counts.correct).toBe(4)
    expect(r.counts.misheard + r.counts.missing).toBe(3)
  })
  it('41. đổi chỗ hai từ liền nhau', () => {
    const r = grade('red green blue', 'red blue green')
    expect(r.counts.correct).toBeGreaterThanOrEqual(1)
    expect(r.counts.correct + r.counts.spelling + r.counts.misheard + r.counts.missing).toBe(3)
  })
  it('42. gõ thêm cả câu thừa ở cuối', () => {
    const r = grade('hello world', 'hello world and more words here')
    expect(r.counts).toMatchObject({ correct: 2, extra: 4 })
    expect(r.score).toBeCloseTo(33.3, 1)
  })
})

describe('hiển thị (segments)', () => {
  it('43. ghép lại đúng bài gõ, giữ nguyên dấu câu và xuống dòng', () => {
    const typed = 'Hello,  wrold!\n\nHow  are you?'
    const r = grade('Hello, world! How are you?', typed)
    const segs = segments(typed, r, 'typed')
    expect(segs.map((s) => s.text).join('')).toBe(typed)
    expect(segs.some((s) => s.kind === 'item' && s.item.type === 'spelling')).toBe(true)
  })
  it('44. từ thiếu hiện ở bài gõ dưới dạng đoạn rỗng đúng vị trí', () => {
    const r = grade('I went to the store', 'I went the store')
    const segs = segments('I went the store', r, 'typed')
    const idx = segs.findIndex((s) => s.kind === 'item' && s.item.type === 'missing')
    expect(idx).toBeGreaterThan(0)
    expect(segs[idx].text).toBe('')
  })
  it('45. văn bản gốc không hiện từ thừa và ghép lại đúng', () => {
    const orig = 'Go home, now.'
    const r = grade(orig, 'go big home')
    const segs = segments(orig, r, 'orig')
    expect(segs.map((s) => s.text).join('')).toBe(orig)
    expect(segs.some((s) => s.kind === 'item' && s.item.type === 'extra')).toBe(false)
  })
})

describe('tách từ', () => {
  it('46. đếm từ khớp với cách chấm', () => {
    const text = "I don't know well-known 5 times, it's 3.5."
    expect(countTokens(text)).toBe(tokenize(text).length)
    expect(countTokens(text)).toBe(8)
  })
  it('47. ký tự Unicode và số', () => {
    expect(tokenize('Naïve café 2nd').map((t) => t.raw)).toEqual(['Naïve', 'café', '2nd'])
  })
})

// ---------------------------------------------------------------- kiểm thử ngẫu nhiên

function rng(seed: number) {
  return () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
}
const VOCAB = ('the a an cat dog house tree river mountain beautiful necessary because quick brown fox jumps over lazy ' +
  "sleeping morning evening coffee don't it's there their two to too five 21 well-known airport passport ticket").split(' ')

function randomText(rand: () => number, n: number) {
  const words: string[] = []
  for (let i = 0; i < n; i++) words.push(VOCAB[Math.floor(rand() * VOCAB.length)])
  return words.join(' ')
}

function mutate(rand: () => number, text: string, rate: number) {
  const out: string[] = []
  for (const w of text.split(' ')) {
    const r = rand()
    if (r < rate / 4) continue // thiếu
    if (r < rate / 2) out.push(w, VOCAB[Math.floor(rand() * VOCAB.length)]) // thừa
    else if (r < rate * 0.75) out.push(w.slice(0, -1) + 'x') // đổi chữ cuối
    else if (r < rate) out.push(VOCAB[Math.floor(rand() * VOCAB.length)]) // thay từ khác
    else out.push(w)
  }
  return out.join(' ')
}

describe('kiểm thử ngẫu nhiên (bất biến)', () => {
  it('48. các từ được phủ đúng một lần, theo thứ tự, và tổng khớp', () => {
    const rand = rng(42)
    for (let t = 0; t < 150; t++) {
      const orig = randomText(rand, 5 + Math.floor(rand() * 60))
      const typed = mutate(rand, orig, 0.05 + rand() * 0.5)
      const r = grade(orig, typed, { strict: rand() < 0.3 })
      let o = 0
      let ty = 0
      for (const it of r.items) {
        expect(it.origRange[0]).toBe(o)
        expect(it.typedRange[0]).toBe(ty)
        o = it.origRange[1]
        ty = it.typedRange[1]
      }
      expect(o).toBe(r.origTokens.length)
      expect(ty).toBe(r.typedTokens.length)
      const c = r.counts
      expect(c.correct + c.spelling + c.misheard + c.missing).toBe(r.total)
      expect(r.total).toBe(countTokens(orig))
      expect(c.extra).toBeLessThanOrEqual(countTokens(typed))
      for (const p of [r.listenPct, r.typePct, r.score]) {
        expect(p).toBeGreaterThanOrEqual(0)
        expect(p).toBeLessThanOrEqual(100)
      }
      expect(r.listenPct).toBeGreaterThanOrEqual(r.typePct)
      expect(segments(typed, r, 'typed').map((s) => s.text).join('')).toBe(typed)
      expect(segments(orig, r, 'orig').map((s) => s.text).join('')).toBe(orig)
    }
  })
  it('49. văn bản giống hệt luôn 100% dù ở chế độ nào', () => {
    const rand = rng(7)
    for (let t = 0; t < 30; t++) {
      const text = randomText(rand, 40)
      expect(grade(text, text).score).toBe(100)
      expect(grade(text, text, { strict: true }).score).toBe(100)
    }
  })
  it('50. căn chỉnh theo dải hẹp cho kết quả như đầy đủ khi lỗi nằm gần đường chéo', () => {
    const rand = rng(99)
    for (let t = 0; t < 20; t++) {
      const orig = randomText(rand, 150)
      const typed = mutate(rand, orig, 0.15)
      const full = grade(orig, typed)
      const banded = gradeBanded(orig, typed, 60)
      expect(banded.counts).toEqual(full.counts)
    }
  })
})

describe('hiệu năng', () => {
  it('51. bài 1.500 từ có lỗi chấm trong dưới 2 giây', () => {
    const rand = rng(5)
    const orig = randomText(rand, 1500)
    const typed = mutate(rand, orig, 0.1)
    const t0 = performance.now()
    const r = grade(orig, typed)
    expect(performance.now() - t0).toBeLessThan(2000)
    expect(r.total).toBe(1500)
  })
  it('52. bài rất dài (4.000 từ) tự chuyển sang căn chỉnh theo dải và vẫn đúng bất biến', () => {
    const rand = rng(11)
    const orig = randomText(rand, 4000)
    const typed = mutate(rand, orig, 0.08)
    const t0 = performance.now()
    const r = grade(orig, typed)
    expect(performance.now() - t0).toBeLessThan(5000)
    const c = r.counts
    expect(c.correct + c.spelling + c.misheard + c.missing).toBe(r.total)
    expect(r.typePct).toBeGreaterThan(60)
  })
})