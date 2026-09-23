import { useEffect, useMemo, useRef, useState } from 'react'
import { IconBoard, IconFolder, IconSearch, IconSparkle } from './Icons.jsx'
import { safeText } from '../lib/format.js'

export default function CommandPalette({
  items,
  collections,
  boards,
  onClose,
  onOpenItem,
  onOpenCollection,
  onOpenBoard,
  onCommand,
  aiVisualSearch
}) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const commands = useMemo(
    () => [
      { id: 'library', label: 'Go to Library', run: () => onCommand('library') },
      { id: 'collections', label: 'Go to Collections', run: () => onCommand('collections') },
      { id: 'spaces', label: 'Go to Spaces', run: () => onCommand('spaces') },
      { id: 'new-space', label: 'New space', run: () => onCommand('new-space') },
      { id: 'settings', label: 'Open settings', run: () => onCommand('settings') },
      { id: 'theme', label: 'Toggle dark mode', run: () => onCommand('theme') },
      { id: 'tag-all', label: 'Tag all existing saves', run: () => onCommand('tag-all') }
    ],
    [onCommand]
  )

  const rows = useMemo(() => {
    const query = q.trim().toLowerCase()
    const out = []
    for (const c of commands) {
      if (!query || c.label.toLowerCase().includes(query)) out.push({ kind: 'cmd', ...c })
    }
    for (const col of collections) {
      if (!query || col.name.toLowerCase().includes(query)) out.push({ kind: 'collection', id: col.id, label: col.name, col })
    }
    for (const b of boards) {
      if (!query || b.name.toLowerCase().includes(query)) out.push({ kind: 'board', id: b.id, label: b.name })
    }
    if (query) {
      const seen = 0
      let n = 0
      for (const item of items) {
        if (n >= 8) break
        const hay = `${safeText(item.title || '')} ${safeText(item.text || '')} ${safeText(item.author || '')} ${(item.tags || []).join(' ')}`.toLowerCase()
        if (!hay.includes(query)) continue
        out.push({ kind: 'item', id: item.id, label: safeText(item.title || item.text || 'Untitled'), item })
        n++
      }
    }
    return out.slice(0, 26)
  }, [q, commands, collections, boards, items])

  useEffect(() => {
    setActive(0)
  }, [q])

  useEffect(() => {
    const el = listRef.current?.querySelector('.cmdk-row.active')
    el?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const choose = (row) => {
    if (!row) return
    if (row.kind === 'cmd') row.run()
    else if (row.kind === 'collection') onOpenCollection(row.col)
    else if (row.kind === 'board') onOpenBoard(row.id)
    else if (row.kind === 'item') onOpenItem(row.id)
    onClose()
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => Math.min(rows.length - 1, i + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(0, i - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      choose(rows[active])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  let lastKind = ''

  return (
    <div
      className="cmdk-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="cmdk" role="dialog" aria-label="Search">
        <div className="cmdk-input">
          <IconSearch size={15} />
          <input
            ref={inputRef}
            value={q}
            placeholder="Search saves, collections, spaces, commands\u2026"
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
          />
          <span className="cmdk-esc">esc</span>
        </div>
        <div className="cmdk-list scroll" ref={listRef}>
          {rows.map((row, i) => {
            const header = row.kind !== lastKind
            lastKind = row.kind
            return (
              <div key={`${row.kind}-${row.id}`}>
                {header && (
                  <div className="cmdk-group">
                    {row.kind === 'cmd' ? 'Commands' : row.kind === 'collection' ? 'Collections' : row.kind === 'board' ? 'Spaces' : 'Saves'}
                  </div>
                )}
                <button
                  className={`cmdk-row ${i === active ? 'active' : ''}`}
                  onMouseMove={() => setActive(i)}
                  onClick={() => choose(row)}
                >
                  <span className="cmdk-ic">
                    {row.kind === 'cmd' ? (
                      <IconSparkle size={13} />
                    ) : row.kind === 'collection' ? (
                      <IconFolder size={13} />
                    ) : row.kind === 'board' ? (
                      <IconBoard size={13} />
                    ) : row.item.thumb ? (
                      <img
                        src={row.item.thumb}
                        alt=""
                        onError={(e) => {
                          e.currentTarget.style.visibility = 'hidden'
                        }}
                      />
                    ) : (
                      <span className="cmdk-dot" />
                    )}
                  </span>
                  <span className="cmdk-label">{row.label}</span>
                  {row.kind === 'collection' && <span className="cmdk-meta">{row.col.saves} saves</span>}
                  {row.kind === 'board' && <span className="cmdk-meta">{boards.find((b) => b.id === row.id)?.items?.length || 0} items</span>}
                  {row.kind === 'item' && row.item.authorName && <span className="cmdk-meta">{row.item.authorName}</span>}
                </button>
              </div>
            )
          })}
          {rows.length === 0 && (
            <div className="cmdk-empty">
              No matches{aiVisualSearch ? ' — try a tag or author' : ''}.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
