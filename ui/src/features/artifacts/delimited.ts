const MAX_ROWS = 500
const MAX_COLS = 30

export interface DelimitedTable {
  header: string[]
  rows: string[][]
  truncated: boolean
}

export function delimiterFor(path: string): string {
  return path.toLowerCase().endsWith('.tsv') ? '\t' : ','
}

function scan(text: string, delimiter: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]
    if (quoted) {
      if (char !== '"') {
        field += char
      } else if (text[index + 1] === '"') {
        field += '"'
        index += 1
      } else {
        quoted = false
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[index + 1] === '\n') index += 1
      row.push(field)
      field = ''
      rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field)
    rows.push(row)
  }
  return rows
}

/** 解析 CSV / TSV：支持引号、转义引号、字段内换行；超出行列上限时标记截断。 */
export function parseDelimited(text: string, delimiter = ','): DelimitedTable {
  const all = scan(text.replace(/^\uFEFF/, ''), delimiter).filter(
    (row) => row.length > 1 || (row[0] ?? '') !== '',
  )
  const header = (all.shift() ?? []).slice(0, MAX_COLS)
  const rows = all.slice(0, MAX_ROWS).map((row) => header.map((_, index) => row[index] ?? ''))
  const widest = all.reduce((width, row) => Math.max(width, row.length), header.length)
  return { header, rows, truncated: all.length > MAX_ROWS || widest > MAX_COLS }
}
