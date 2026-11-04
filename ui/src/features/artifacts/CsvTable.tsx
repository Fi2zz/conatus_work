import type { JSX } from 'react'

import { delimiterFor, parseDelimited } from './delimited'

interface CsvTableProps {
  content: string
  path: string
}

/** 无依赖的 CSV / TSV 表格预览；只渲染前 500 行、30 列。 */
export function CsvTable({ content, path }: CsvTableProps): JSX.Element {
  const table = parseDelimited(content, delimiterFor(path))
  if (table.header.length === 0) {
    return (
      <p data-testid="artifact-table-empty" className="p-4 text-[11.5px] text-ink-muted">
        表格为空。
      </p>
    )
  }
  return (
    <div data-testid="artifact-table" className="min-h-0 overflow-auto">
      <table className="w-full border-collapse text-[10.5px]">
        <thead className="sticky top-0 bg-panel-muted">
          <tr>
            {table.header.map((cell, index) => (
              <th
                key={index}
                className="border-b border-line px-2 py-1 text-left font-medium whitespace-nowrap"
              >
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="even:bg-panel-muted/40">
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  className="border-b border-line/50 px-2 py-0.5 align-top text-ink-muted"
                >
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
