import { useEffect, useRef, useState } from 'react'
import { IconCheck, IconChevronDown, IconClock } from './Icons.jsx'

export default function SortButton({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="pill-btn" onClick={() => setOpen((v) => !v)}>
        <IconClock size={14} />
        {value}
        <IconChevronDown size={11} />
      </button>
      {open && (
        <div className="menu" style={{ position: 'absolute', top: 34, right: 0 }}>
          {options.map((opt) => (
            <button
              key={opt}
              className="menu-item"
              onClick={() => {
                onChange(opt)
                setOpen(false)
              }}
            >
              <span>{opt}</span>
              {opt === value && <IconCheck size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
