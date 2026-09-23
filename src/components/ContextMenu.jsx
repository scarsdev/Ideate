import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronRight } from './Icons.jsx'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef(null)
  const subRef = useRef(null)
  const [pos, setPos] = useState({ x, y })
  const [openSub, setOpenSub] = useState(null)
  const [subPos, setSubPos] = useState(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = Math.min(x, window.innerWidth - r.width - 10)
    const ny = Math.min(y, window.innerHeight - r.height - 10)
    setPos({ x: Math.max(10, nx), y: Math.max(10, ny) })
  }, [x, y])

  useLayoutEffect(() => {
    if (openSub === null || !subRef.current || !ref.current) return
    const parent = ref.current.getBoundingClientRect()
    const sub = subRef.current.getBoundingClientRect()
    const rows = ref.current.querySelectorAll('[data-row]')
    const row = ref.current.querySelector(`[data-row="${openSub}"]`)?.getBoundingClientRect()
    void rows
    let sx = parent.right + 4
    if (sx + sub.width > window.innerWidth - 10) sx = parent.left - sub.width - 4
    let sy = (row ? row.top : parent.top) - 5
    sy = Math.max(10, Math.min(sy, window.innerHeight - sub.height - 10))
    setSubPos({ x: sx, y: sy })
  }, [openSub])

  useEffect(() => {
    const down = (e) => {
      if (ref.current?.contains(e.target) || subRef.current?.contains(e.target)) return
      onClose()
    }
    const key = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('mousedown', down)
    window.addEventListener('keydown', key)
    window.addEventListener('blur', onClose)
    window.addEventListener('wheel', onClose, { passive: true })
    return () => {
      window.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key)
      window.removeEventListener('blur', onClose)
      window.removeEventListener('wheel', onClose)
    }
  }, [onClose])

  const subItems = openSub !== null ? items[openSub]?.submenu : null

  return (
    <>
      <div className="ctx" ref={ref} style={{ left: pos.x, top: pos.y }}>
        {items.map((it, i) =>
          it.type === 'separator' ? (
            <div className="ctx-sep" key={`s${i}`} />
          ) : (
            <div
              key={it.label}
              data-row={i}
              className={`ctx-item ${it.danger ? 'danger' : ''} ${
                it.submenu && openSub === i ? 'open' : ''
              }`}
              onMouseOver={() => setOpenSub(it.submenu ? i : null)}
              onClick={() => {
                if (it.submenu) return
                it.onClick?.()
                onClose()
              }}
            >
              <span className="ctx-ic">{it.icon}</span>
              <span className="ctx-label">{it.label}</span>
              {it.submenu && (
                <span className="ctx-chev">
                  <IconChevronRight size={13} />
                </span>
              )}
            </div>
          )
        )}
      </div>

      {subItems && (
        <div
          className="ctx ctx-sub"
          ref={subRef}
          style={{ left: subPos?.x ?? pos.x + 220, top: subPos?.y ?? pos.y, visibility: subPos ? 'visible' : 'hidden' }}
        >
          {subItems.map((s) => (
            <div
              key={s.label}
              className="ctx-item"
              onClick={() => {
                s.onClick?.()
                onClose()
              }}
            >
              {s.thumb ? (
                <span className="ctx-thumb">
                  <img src={s.thumb} alt="" />
                </span>
              ) : (
                <span className="ctx-ic">{s.icon}</span>
              )}
              <span className="ctx-label">{s.label}</span>
              {s.checked && (
                <span className="ctx-ic">
                  <IconCheck size={13} />
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
