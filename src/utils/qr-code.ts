/**
 * Tiny local QR encoder for Spaces TOTP setup.
 * Fixed to QR Version 9 / ECC-L, which safely fits normal otpauth:// URIs
 * (up to 230 UTF-8 bytes) and avoids any network or third-party runtime dependency.
 */

const VERSION = 9
const SIZE = VERSION * 4 + 17 // 53
const DATA_CODEWORDS = 232
const ECC_CODEWORDS_PER_BLOCK = 30
const NUM_BLOCKS = 2
const DATA_CODEWORDS_PER_BLOCK = 116

type Matrix = boolean[][]

function gfMultiply(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}

function reedSolomonDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMultiply(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMultiply(root, 0x02)
  }
  return result
}

function reedSolomonRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0)
  for (const byte of data) {
    const factor = byte ^ result[0]
    result.shift()
    result.push(0)
    for (let i = 0; i < divisor.length; i++) {
      result[i] ^= gfMultiply(divisor[i], factor)
    }
  }
  return result
}

function appendBits(target: number[], value: number, length: number) {
  for (let i = length - 1; i >= 0; i--) target.push((value >>> i) & 1)
}

function makeCodewords(text: string): number[] {
  const bytes = Array.from(new TextEncoder().encode(text))
  if (bytes.length > 230) {
    throw new Error('This authenticator setup URI is too long for the built-in QR renderer.')
  }

  const bits: number[] = []
  appendBits(bits, 0b0100, 4) // Byte mode
  appendBits(bits, bytes.length, 8) // Version 1-9 byte-mode count field
  for (const byte of bytes) appendBits(bits, byte, 8)

  const capacityBits = DATA_CODEWORDS * 8
  appendBits(bits, 0, Math.min(4, capacityBits - bits.length))
  while (bits.length % 8 !== 0) bits.push(0)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let value = 0
    for (let j = 0; j < 8; j++) value = (value << 1) | bits[i + j]
    data.push(value)
  }

  for (let pad = 0; data.length < DATA_CODEWORDS; pad++) {
    data.push((pad & 1) === 0 ? 0xec : 0x11)
  }

  const divisor = reedSolomonDivisor(ECC_CODEWORDS_PER_BLOCK)
  const blocks: number[][] = []
  const eccBlocks: number[][] = []
  for (let block = 0; block < NUM_BLOCKS; block++) {
    const chunk = data.slice(block * DATA_CODEWORDS_PER_BLOCK, (block + 1) * DATA_CODEWORDS_PER_BLOCK)
    blocks.push(chunk)
    eccBlocks.push(reedSolomonRemainder(chunk, divisor))
  }

  const result: number[] = []
  for (let i = 0; i < DATA_CODEWORDS_PER_BLOCK; i++) {
    for (let block = 0; block < NUM_BLOCKS; block++) result.push(blocks[block][i])
  }
  for (let i = 0; i < ECC_CODEWORDS_PER_BLOCK; i++) {
    for (let block = 0; block < NUM_BLOCKS; block++) result.push(eccBlocks[block][i])
  }
  return result
}

function emptyMatrix(): Matrix {
  return Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
}

function emptyFunctionMap(): boolean[][] {
  return Array.from({ length: SIZE }, () => new Array<boolean>(SIZE).fill(false))
}

function setFunction(modules: Matrix, isFunction: boolean[][], x: number, y: number, dark: boolean) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return
  modules[y][x] = dark
  isFunction[y][x] = true
}

function drawFinder(modules: Matrix, isFunction: boolean[][], cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      setFunction(modules, isFunction, x, y, dist !== 2 && dist !== 4)
    }
  }
}

function drawAlignment(modules: Matrix, isFunction: boolean[][], cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFunction(modules, isFunction, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }
}

function formatBits(mask: number): number {
  // ECC level L has format bits 01.
  const data = (0b01 << 3) | mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ (((rem >>> 9) & 1) * 0x537)
  return ((data << 10) | rem) ^ 0x5412
}

function drawFormat(modules: Matrix, isFunction: boolean[][], mask: number) {
  const bits = formatBits(mask)
  const bit = (i: number) => ((bits >>> i) & 1) !== 0

  for (let i = 0; i <= 5; i++) setFunction(modules, isFunction, 8, i, bit(i))
  setFunction(modules, isFunction, 8, 7, bit(6))
  setFunction(modules, isFunction, 8, 8, bit(7))
  setFunction(modules, isFunction, 7, 8, bit(8))
  for (let i = 9; i < 15; i++) setFunction(modules, isFunction, 14 - i, 8, bit(i))

  for (let i = 0; i < 8; i++) setFunction(modules, isFunction, SIZE - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) setFunction(modules, isFunction, 8, SIZE - 15 + i, bit(i))
  setFunction(modules, isFunction, 8, SIZE - 8, true)
}

function drawVersion(modules: Matrix, isFunction: boolean[][]) {
  let rem = VERSION
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ (((rem >>> 11) & 1) * 0x1f25)
  const bits = (VERSION << 12) | rem
  for (let i = 0; i < 18; i++) {
    const dark = ((bits >>> i) & 1) !== 0
    const a = SIZE - 11 + (i % 3)
    const b = Math.floor(i / 3)
    setFunction(modules, isFunction, a, b, dark)
    setFunction(modules, isFunction, b, a, dark)
  }
}

function drawFunctionPatterns(modules: Matrix, isFunction: boolean[][]) {
  // Timing first; finder patterns overwrite their ends.
  for (let i = 0; i < SIZE; i++) {
    setFunction(modules, isFunction, 6, i, (i & 1) === 0)
    setFunction(modules, isFunction, i, 6, (i & 1) === 0)
  }

  drawFinder(modules, isFunction, 3, 3)
  drawFinder(modules, isFunction, SIZE - 4, 3)
  drawFinder(modules, isFunction, 3, SIZE - 4)

  // Version 9 alignment centers.
  const align = [6, 26, 46]
  for (const y of align) {
    for (const x of align) {
      const overlapsFinder =
        (x === 6 && y === 6) ||
        (x === 6 && y === 46) ||
        (x === 46 && y === 6)
      if (!overlapsFinder) drawAlignment(modules, isFunction, x, y)
    }
  }

  // Reserve format/version areas before data placement.
  drawFormat(modules, isFunction, 0)
  drawVersion(modules, isFunction)
}

function maskBit(mask: number, x: number, y: number): boolean {
  switch (mask) {
    case 0: return ((x + y) & 1) === 0
    case 1: return (y & 1) === 0
    case 2: return x % 3 === 0
    case 3: return (x + y) % 3 === 0
    case 4: return ((Math.floor(y / 2) + Math.floor(x / 3)) & 1) === 0
    case 5: return ((x * y) % 2 + (x * y) % 3) === 0
    case 6: return (((x * y) % 2 + (x * y) % 3) & 1) === 0
    case 7: return ((((x + y) % 2) + (x * y) % 3) & 1) === 0
    default: return false
  }
}

function drawCodewords(modules: Matrix, isFunction: boolean[][], codewords: number[]) {
  let bitIndex = 0
  let right = SIZE - 1
  while (right >= 1) {
    if (right === 6) right--
    for (let vert = 0; vert < SIZE; vert++) {
      const upward = ((right + 1) & 2) === 0
      const y = upward ? SIZE - 1 - vert : vert
      for (let j = 0; j < 2; j++) {
        const x = right - j
        if (isFunction[y][x]) continue
        let dark = false
        if (bitIndex < codewords.length * 8) {
          const byte = codewords[bitIndex >>> 3]
          dark = ((byte >>> (7 - (bitIndex & 7))) & 1) !== 0
        }
        modules[y][x] = dark
        bitIndex++
      }
    }
    right -= 2
  }
}

function applyMask(modules: Matrix, isFunction: boolean[][], mask: number) {
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!isFunction[y][x] && maskBit(mask, x, y)) modules[y][x] = !modules[y][x]
    }
  }
}

function penaltyScore(modules: Matrix): number {
  let score = 0

  // Adjacent modules in rows and columns.
  for (let pass = 0; pass < 2; pass++) {
    for (let a = 0; a < SIZE; a++) {
      let runColor = false
      let runLength = 0
      for (let b = 0; b < SIZE; b++) {
        const color = pass === 0 ? modules[a][b] : modules[b][a]
        if (b === 0 || color !== runColor) {
          runColor = color
          runLength = 1
        } else {
          runLength++
          if (runLength === 5) score += 3
          else if (runLength > 5) score++
        }
      }
    }
  }

  // 2x2 blocks.
  for (let y = 0; y < SIZE - 1; y++) {
    for (let x = 0; x < SIZE - 1; x++) {
      const c = modules[y][x]
      if (modules[y][x + 1] === c && modules[y + 1][x] === c && modules[y + 1][x + 1] === c) score += 3
    }
  }

  // Finder-like 1:1:3:1:1 patterns with four light modules on either side.
  const hasFinderPattern = (line: boolean[], i: number) =>
    line[i] && !line[i + 1] && line[i + 2] && line[i + 3] && line[i + 4] && !line[i + 5] && line[i + 6]
  const allLight = (line: boolean[], from: number, to: number) => {
    for (let i = from; i < to; i++) if (line[i]) return false
    return true
  }
  for (let y = 0; y < SIZE; y++) {
    const row = modules[y]
    const col = modules.map(r => r[y])
    for (const line of [row, col]) {
      for (let i = 0; i <= SIZE - 7; i++) {
        if (!hasFinderPattern(line, i)) continue
        const before = i >= 4 && allLight(line, i - 4, i)
        const after = i + 11 <= SIZE && allLight(line, i + 7, i + 11)
        if (before || after) score += 40
      }
    }
  }

  let dark = 0
  for (const row of modules) for (const cell of row) if (cell) dark++
  const total = SIZE * SIZE
  const k = Math.floor(Math.abs(dark * 20 - total * 10) / total)
  score += k * 10

  return score
}

function cloneMatrix(matrix: Matrix): Matrix {
  return matrix.map(row => row.slice())
}

export function encodeQrMatrix(text: string): Matrix {
  const codewords = makeCodewords(text)
  const base = emptyMatrix()
  const isFunction = emptyFunctionMap()
  drawFunctionPatterns(base, isFunction)
  drawCodewords(base, isFunction, codewords)

  let best: Matrix | null = null
  let bestScore = Number.POSITIVE_INFINITY
  for (let mask = 0; mask < 8; mask++) {
    const candidate = cloneMatrix(base)
    applyMask(candidate, isFunction, mask)
    drawFormat(candidate, isFunction, mask)
    const score = penaltyScore(candidate)
    if (score < bestScore) {
      bestScore = score
      best = candidate
    }
  }
  if (!best) throw new Error('Unable to generate QR code.')
  return best
}
