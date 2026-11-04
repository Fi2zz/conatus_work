import { useEffect, useState } from 'react'
import type { JSX } from 'react'
import type { WorkSheet } from 'xlsx'

import { bytesFromBase64 } from '@/lib/base64'

const MAX_ROWS = 500
const MAX_COLS = 30

type XlsxModule = typeof import('xlsx')

interface SheetTable {
  name: string
  rows: string[][]
  truncated: boolean
}

function xlsxOf(module: unknown): XlsxModule {
  const candidate = module as Partial<XlsxModule> & { default?: XlsxModule }
  return (candidate.read ? (candidate as XlsxModule) : candidate.default) as XlsxModule
}

function tableOf(module: XlsxModule, name: string, sheet: WorkSheet): SheetTable {
  const raw = module.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  })
  const widest = raw.reduce((width, row) => Math.max(width, row.length), 0)
  const rows = raw
    .slice(0, MAX_ROWS)
    .map((row) => row.slice(0, MAX_COLS).map((cell) => String(cell ?? '')))
  return { name, rows, truncated: raw.length > MAX_ROWS || widest > MAX_COLS }
}

function Sheet({ table }: { table: SheetTable }): JSX.Element {
  const [header, ...rows] = table.rows
  if (!header) return <p className="p-4 text-[11.5px] text-ink-muted">工作表为空。</p>
  return (
    <div data-testid="artifact-table" className="min-h-0 overflow-auto">
      <table className="w-full border-collapse text-[10.5px]">
        <thead className="sticky top-0 bg-panel-muted">
          <tr>
            {header.map((cell, index) => (
              <th key={index} className="border-b border-line px-2 py-1 text-left font-medium whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-panel-muted/40">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="border-b border-line/50 px-2 py-0.5 align-top text-ink-muted">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {table.truncated ? (
        <p data-testid="artifact-table-truncated" className="px-3 py-1 text-[10.5px] text-warning">
          只显示前 500 行、30 列。
        </p>
      ) : null}
    </div>
  )
}

/** XLSX / XLS 用 SheetJS 解析；库按需加载，不进首屏包。 */
export function XlsxPreview({ base64 }: { base64: string }): JSX.Element {
  const [sheets, setSheets] = useState<SheetTable[] | null>(null)
  const [active, setActive] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function parse(): Promise<void> {
      try {
        const module = xlsxOf(await import('xlsx'))
        const book = module.read(bytesFromBase64(base64), { type: 'array' })
        const next = book.SheetNames.map((name) => tableOf(module, name, book.Sheets[name]))
        if (!cancelled) setSheets(next)
      } catch (cause) {
        if (!cancelled) setError(String(cause))
      }
    }
    void parse()
    return () => {
      cancelled = true
    }
  }, [base64])

  if (error) {
    return (
      <p data-testid="artifact-preview-error" className="p-4 text-[11.5px] text-danger">
        表格预览失败：{error}
      </p>
    )
  }
  if (!sheets) return <p className="p-4 text-[11.5px] text-ink-muted">正在解析表格…</p>
  if (sheets.length === 0) return <p className="p-4 text-[11.5px] text-ink-muted">工作簿里没有工作表。</p>
  const current = sheets[Math.min(active, sheets.length - 1)]
  return (
    <div className="flex min-h-0 flex-col">
      {sheets.length > 1 ? (
        <div className="flex flex-wrap gap-1 border-b border-line/70 px-2 py-1">
          {sheets.map((sheet, index) => (
            <button
              key={sheet.name}
              type="button"
              data-testid="xlsx-sheet-tab"
              onClick={() => setActive(index)}
              className={`rounded-sm px-2 py-0.5 text-[10.5px] ${
                index === active ? 'bg-accent/10 text-accent' : 'text-ink-muted hover:bg-panel-muted'
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      ) : null}
      <Sheet table={current} />
    </div>
  )
}
