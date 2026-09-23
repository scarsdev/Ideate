import { useEffect, useMemo, useRef, useState } from 'react'
import { IconClose, IconSearch } from './Icons.jsx'
import { safeText } from '../lib/format.js'

const BATCH = 60

export default function BoardLibraryDrawer({ items, itemsById, onAdd, onClose }) {
  const [query, setQuery] = useState('')
  const [limit, setLimit] = useState(BATCH)
  const scrollRef = useRef(null)

  const pool = useMemo(() => {
    const withThumb = items.filter((i) => i.thumb && !i.hidden)
    const q = query.trim().toLowerCase()
    if (!q) return withThumb
    return withThumb.filter((i) => {
      const hay = `${safeText(i.title || '')} ${safeText(i.author || '')}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  useEffect(() => {
    setLimit(BATCH)
  }, [query])

  const onScroll = () => {
    const el = scrollRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight > el.scrollHeight - 400) {
      setLimit((n) => (n < pool.length ? n + BATCH : n))
    }
  }

  return (
    <aside className="board-drawer">
      <div className="bd-head">
        <span>Add images</span>
        <button className="icon-btn" title="Close" onClick={onClose}>
          <IconClose size={15} />
        </button>
      </div>
      <label className="bd-search">
        <IconSearch size={13} />
        <input
          value={query}
          placeholder="Search library"
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <div className="bd-scroll scroll" ref={scrollRef} onScroll={onScroll}>
        <div className="bd-grid">
          {pool.slice(0, limit).map((item) => (
            <button
              key={item.id}
              className="bd-tile"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/gather-item', item.id)
                e.dataTransfer.effectAllowed = 'copy'
              }}
              onClick={() => onAdd(item.id)}
              title={safeText(item.title || '')}
            >
              <img
                src={item.thumb}
                alt=""
                loading="lazy"
                draggable={false}
                onError={(e) => {
                  e.currentTarget.style.visibility = 'hidden'
                }}
              />
            </button>
          ))}
        </div>
        {pool.length === 0 && <div className="bd-empty">No images match.</div>}
        {pool.length > limit && <div className="bd-more">Scroll for more…</div>}
      </div>
    </aside>
  )
}
