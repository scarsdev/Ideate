import { useEffect, useRef, useState } from 'react'
import ItemCard from './ItemCard.jsx'

const BATCH = 240

export default function MasonryGrid({
  items,
  cols = 4,
  showTag = false,
  resetKey = '',
  draggingId,
  onOpen,
  onMenu,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  const [limit, setLimit] = useState(BATCH)
  const sentinel = useRef(null)

  useEffect(() => {
    setLimit(BATCH)
  }, [resetKey])

  useEffect(() => {
    const el = sentinel.current
    if (!el || limit >= items.length) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setLimit((l) => Math.min(items.length, l + BATCH))
        }
      },
      { rootMargin: '900px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [limit, items.length])

  const shown = limit >= items.length ? items : items.slice(0, limit)
  const columns = Array.from({ length: cols }, () => [])
  shown.forEach((item, i) => columns[i % cols].push(item))

  return (
    <>
      <div className="masonry" style={{ '--cols': cols }}>
        {columns.map((col, ci) => (
          <div className="masonry-col" key={ci}>
            {col.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                showTag={showTag}
                dragging={draggingId === item.id}
                onOpen={() => onOpen(item.id)}
                onMenu={(e) => onMenu(item.id, e)}
                onDragStart={onDragStart}
                onDragMove={onDragMove}
                onDragEnd={onDragEnd}
              />
            ))}
          </div>
        ))}
      </div>
      {limit < items.length && (
        <div className="masonry-more" ref={sentinel}>
          Showing {shown.length.toLocaleString()} of {items.length.toLocaleString()} — scroll for more
        </div>
      )}
    </>
  )
}
