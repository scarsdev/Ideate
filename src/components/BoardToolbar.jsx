import { useEffect, useRef, useState } from 'react'
import {
  IconArrowTool,
  IconCircle,
  IconCursor,
  IconElbow,
  IconFrame,
  IconImageTool,
  IconLine,
  IconPencil,
  IconEraser,
  IconSquare,
  IconSticky,
  IconTriangle,
  IconType
} from './Icons.jsx'

const SHAPE_TOOLS = [
  { id: 'rect', label: 'Rectangle (R)', Icon: IconSquare },
  { id: 'ellipse', label: 'Ellipse (E)', Icon: IconCircle },
  { id: 'triangle', label: 'Triangle (Y)', Icon: IconTriangle },
  { id: 'line', label: 'Line (L)', Icon: IconLine },
  { id: 'arrow', label: 'Arrow (A)', Icon: IconArrowTool },
  { id: 'elbow', label: 'Elbow arrow (B)', Icon: IconElbow }
]

export function isShapeTool(tool) {
  return SHAPE_TOOLS.some((s) => s.id === tool)
}

export default function BoardToolbar({ tool, setTool, drawerOpen, onToggleDrawer }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const off = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', off)
    return () => window.removeEventListener('mousedown', off)
  }, [open])

  const activeShape = SHAPE_TOOLS.find((s) => s.id === tool)

  return (
    <div className="board-rail">
      <button
        className={`rail-btn ${tool === 'select' ? 'on' : ''}`}
        title="Select (V)"
        onClick={() => setTool('select')}
      >
        <IconCursor size={17} />
      </button>

      <button
        className={`rail-btn ${drawerOpen ? 'on' : ''}`}
        title="Image library (I)"
        onClick={onToggleDrawer}
      >
        <IconImageTool size={17} />
      </button>

      <button
        className={`rail-btn ${tool === 'sticky' ? 'on' : ''}`}
        title="Sticky note (S)"
        onClick={() => setTool('sticky')}
      >
        <IconSticky size={17} />
      </button>

      <button
        className={`rail-btn ${tool === 'text' ? 'on' : ''}`}
        title="Text (T)"
        onClick={() => setTool('text')}
      >
        <IconType size={17} />
      </button>

      <div className="rail-split" ref={ref}>
        <button
          className={`rail-btn ${isShapeTool(tool) ? 'on' : ''}`}
          title="Shapes & lines"
          onClick={() => setOpen((v) => !v)}
        >
          {activeShape ? <activeShape.Icon size={17} /> : <IconSquare size={17} />}
        </button>
        {open && (
          <div className="rail-flyout">
            {SHAPE_TOOLS.map((s) => (
              <button
                key={s.id}
                className={`rail-btn ${tool === s.id ? 'on' : ''}`}
                title={s.label}
                onClick={() => {
                  setTool(s.id)
                  setOpen(false)
                }}
              >
                <s.Icon size={16} />
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        className={`rail-btn ${tool === 'draw' ? 'on' : ''}`}
        title="Pencil (P)"
        onClick={() => setTool('draw')}
      >
        <IconPencil size={17} />
      </button>

      <button
        className={`rail-btn ${tool === 'erase' ? 'on' : ''}`}
        title="Eraser (X)"
        onClick={() => setTool('erase')}
      >
        <IconEraser size={17} />
      </button>

      <button
        className={`rail-btn ${tool === 'frame' ? 'on' : ''}`}
        title="Frame (F)"
        onClick={() => setTool('frame')}
      >
        <IconFrame size={17} />
      </button>
    </div>
  )
}
