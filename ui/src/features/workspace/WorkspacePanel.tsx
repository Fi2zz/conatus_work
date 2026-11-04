import { useState } from 'react'
import type { JSX } from 'react'

import { EmptyState } from '@/components/ui/empty-state'
import { cn } from '@/lib/utils'
import { useUiStore } from '@/state/ui-state'
import { useWorkbench } from '@/state/workbench-store'

interface TreeNode {
  name: string
  path: string
  kind: 'dir' | 'file'
  children: TreeNode[]
}

function insert(root: TreeNode[], parts: string[], base: string): void {
  const [head, ...rest] = parts
  if (!head) return
  const path = base === '' ? head : `${base}/${head}`
  let node = root.find((item) => item.name === head)
  if (!node) {
    node = { name: head, path, kind: rest.length > 0 ? 'dir' : 'file', children: [] }
    root.push(node)
  }
  if (rest.length > 0) {
    node.kind = 'dir'
    insert(node.children, rest, path)
  }
}

function treeOf(paths: string[]): TreeNode[] {
  const root: TreeNode[] = []
  for (const path of paths) insert(root, path.split('/').filter(Boolean), '')
  function sort(nodes: TreeNode[]): void {
    nodes.sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === 'dir' ? -1 : 1
      return left.name.localeCompare(right.name)
    })
    for (const node of nodes) sort(node.children)
  }
  sort(root)
  return root
}

function TreeRows({
  nodes,
  depth,
  collapsed,
  onToggle,
  onOpen,
}: {
  nodes: TreeNode[]
  depth: number
  collapsed: Set<string>
  onToggle: (path: string) => void
  onOpen: (node: TreeNode) => void
}): JSX.Element {
  return (
    <>
      {nodes.map((node) => (
        <div key={node.path}>
          <button
            type="button"
            data-testid={node.kind === 'file' ? 'workspace-file' : 'workspace-dir'}
            onClick={() => (node.kind === 'dir' ? onToggle(node.path) : onOpen(node))}
            className={cn(
              'flex w-full items-center gap-1.5 rounded-sm py-0.5 pr-2 text-left text-[11px] hover:bg-panel-muted',
              node.kind === 'dir' ? 'text-ink-muted' : 'text-ink',
            )}
            style={{ paddingLeft: `${depth * 12 + 8}px` }}
          >
            <span aria-hidden className="w-3 shrink-0 text-center text-[9px] text-ink-faint">
              {node.kind === 'dir' ? (collapsed.has(node.path) ? '▸' : '▾') : '·'}
            </span>
            <span className="truncate font-mono">{node.name}</span>
          </button>
          {node.kind === 'dir' && !collapsed.has(node.path) ? (
            <TreeRows
              nodes={node.children}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ) : null}
        </div>
      ))}
    </>
  )
}

export function WorkspacePanel(): JSX.Element {
  const run = useWorkbench((state) => (state.activeRunId ? state.runs[state.activeRunId] : undefined))
  const setSelected = useUiStore((state) => state.setSelectedArtifact)
  const setTab = useUiStore((state) => state.setRightTab)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [preview, setPreview] = useState<string | null>(null)

  if (!run) return <EmptyState title="未选择任务" hint="选一条运行后，这里会显示它的工作区文件（原型）。" />

  const artifacts = new Set(run.artifacts.map((artifact) => artifact.path))
  const paths = [
    ...new Set([
      ...run.artifacts.map((artifact) => artifact.path),
      ...(run.changes?.files.flatMap((file) => [file.from, file.to]) ?? []),
      'inbox/',
      'out/',
    ]),
  ]
  const tree = treeOf(paths)

  function open(path: string): void {
    if (artifacts.has(path)) {
      setSelected(path)
      setTab('artifacts')
      return
    }
    setPreview(path)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div data-testid="workspace-tree" className="min-h-0 flex-1 overflow-auto border-b border-line/70 py-1">
        <TreeRows
          nodes={tree}
          depth={0}
          collapsed={collapsed}
          onToggle={(path) =>
            setCollapsed((current) => {
              const next = new Set(current)
              if (next.has(path)) next.delete(path)
              else next.add(path)
              return next
            })
          }
          onOpen={(node) => open(node.path)}
        />
      </div>
      <div data-testid="workspace-preview" className="min-h-24 p-3 text-[11.5px] text-ink-muted">
        {preview ? (
          <>
            <p className="mb-1 font-mono text-[10.5px] text-ink">{preview}</p>
            <p>这是原型工作区文件。接入 `fs.read` 后在这里显示真实正文。</p>
          </>
        ) : (
          <p>选择文件查看内容；已登记的产物会自动跳到「产物」页预览。</p>
        )}
      </div>
    </div>
  )
}
