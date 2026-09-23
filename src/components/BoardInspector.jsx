import { useEffect, useRef, useState } from 'react'
import { IconCopy, IconTrash } from './Icons.jsx'
import { FONTS, SHAPE_FILLS, SHAPE_STROKES, STICKY_COLORS, STICKY_ORDER, STROKE_WIDTHS, TEXT_COLORS } from '../lib/board.js'

function Popover({ label, title, children, wide }) {
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
  return (
    <div className="insp-pop" ref={ref}>
      <button className={`insp-btn ${open ? 'on' : ''}`} title={title} onClick={() => setOpen((v) => !v)}>
        {label}
      </button>
      {open && <div className={`insp-panel ${wide ? 'wide' : ''}`}>{children}</div>}
    </div>
  )
}

const Swatches = ({ colors, value, onPick, alpha }) => (
  <div className="swatch-row">
    {colors.map((c) => (
      <button
        key={c}
        className={`swatch ${value === c ? 'on' : ''} ${c === 'transparent' ? 'none' : ''}`}
        style={c === 'transparent' ? undefined : { background: c }}
        title={c === 'transparent' ? 'None' : c}
        onClick={() => onPick(c)}
      >
        {c === 'transparent' && <span className="slash" />}
      </button>
    ))}
  </div>
)

export default function BoardInspector({
  items,
  single,
  onPatch,
  onDelete,
  onDuplicate,
  onFront,
  onBack,
  onGroup,
  onUngroup,
  onAlign,
  onDistribute
}) {
  if (!items.length) return null

  const shapes = items.filter((i) => i.type === 'shape')
  const stickies = items.filter((i) => i.type === 'sticky')
  const lines = items.filter((i) => i.type === 'line' || i.type === 'arrow')
  const texts = items.filter((i) => i.type === 'text' || i.type === 'shape' || i.type === 'sticky')
  const multi = items.length > 1
  const grouped = items.some((i) => i.data?.groupId)
  const hasStyle =
    shapes.length > 0 || stickies.length > 0 || lines.length > 0 || texts.length > 0
  if (!hasStyle && !multi && !grouped) return null

  const idsOf = (list) => list.map((i) => i.id)

  const fontSizeOf = texts[0]?.data?.fontSize || 14
  const stepFont = (dir) => {
    const next = Math.max(8, Math.min(96, fontSizeOf + dir * 2))
    onPatch(texts.map((i) => i.id), { fontSize: next })
  }

  return (
    <div className="inspector">
      {shapes.length > 0 && (
        <>
          <Popover label="Fill" title="Fill color" wide>
            <Swatches colors={SHAPE_FILLS} value={shapes[0].data?.fill} onPick={(v) => onPatch(idsOf(shapes), { fill: v })} />
          </Popover>
          <Popover label="Stroke" title="Stroke color" wide>
            <Swatches colors={SHAPE_STROKES} value={shapes[0].data?.stroke} onPick={(v) => onPatch(idsOf(shapes), { stroke: v })} />
          </Popover>
          <Popover label="Weight" title="Stroke width">
            <div className="insp-col">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  className={`insp-mini ${shapes[0].data?.strokeWidth === w ? 'on' : ''}`}
                  onClick={() => {
                    onPatch(shapes.map((i) => i.id), { strokeWidth: w })
                    onPatch(lines.map((i) => i.id), { strokeWidth: w })
                  }}
                >
                  {w}
                </button>
              ))}
            </div>
          </Popover>
        </>
      )}

      {stickies.length > 0 && (
        <Popover label="Color" title="Sticky color" wide>
          <div className="swatch-row">
            {STICKY_ORDER.map((key) => (
              <button
                key={key}
                className={`swatch ${stickies[0].data?.color === key ? 'on' : ''}`}
                style={{ background: STICKY_COLORS[key].swatch }}
                onClick={() => onPatch(stickies.map((i) => i.id), { color: key })}
              />
            ))}
          </div>
        </Popover>
      )}

      {lines.length > 0 && (
        <>
          <Popover label="Stroke" title="Stroke color" wide>
            <Swatches colors={SHAPE_STROKES} value={lines[0].data?.stroke} onPick={(v) => onPatch(idsOf(lines), { stroke: v })} />
          </Popover>
          <Popover label="Weight" title="Stroke width">
            <div className="insp-col">
              {STROKE_WIDTHS.map((w) => (
                <button
                  key={w}
                  className={`insp-mini ${lines[0].data?.strokeWidth === w ? 'on' : ''}`}
                  onClick={() => onPatch(lines.map((i) => i.id), { strokeWidth: w })}
                >
                  {w}
                </button>
              ))}
            </div>
          </Popover>
        </>
      )}

      {texts.length > 0 && (
        <>
          <Popover label="Font" title="Font family">
            <div className="insp-col">
              {FONTS.map((f) => (
                <button
                  key={f.label}
                  className={`insp-mini wide ${(texts[0].data?.fontFamily || 'inherit') === f.value ? 'on' : ''}`}
                  style={{ fontFamily: f.value }}
                  onClick={() => onPatch(texts.map((i) => i.id), { fontFamily: f.value })}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </Popover>
          <div className="insp-group">
            <button className="insp-btn" title="Smaller" onClick={() => stepFont(-1)}>
              A−
            </button>
            <span className="insp-num">{Math.round(fontSizeOf)}</span>
            <button className="insp-btn" title="Larger" onClick={() => stepFont(1)}>
              A+
            </button>
          </div>
          <Popover label="Text" title="Text color" wide>
            <Swatches colors={TEXT_COLORS} value={texts[0].data?.color} onPick={(v) => onPatch(idsOf(texts), { color: v })} />
          </Popover>
          <div className="insp-group">
            {['left', 'center', 'right'].map((a) => (
              <button
                key={a}
                className={`insp-btn ${(texts[0].data?.align || 'left') === a ? 'on' : ''}`}
                title={`Align ${a}`}
                onClick={() => onPatch(texts.map((i) => i.id), { align: a })}
              >
                {a === 'left' ? '⇤' : a === 'center' ? '↔' : '⇥'}
              </button>
            ))}
          </div>
        </>
      )}

      {multi && (
        <>
          <div className="insp-sep" />
          <div className="insp-group">
            {[
              ['left', '⇤'],
              ['hcenter', '↔'],
              ['right', '⇥'],
              ['top', '⇡'],
              ['vcenter', '↕'],
              ['bottom', '⇣']
            ].map(([kind, glyph]) => (
              <button
                key={kind}
                className="insp-btn"
                title={`Align ${kind}`}
                onClick={() => onAlign(kind)}
              >
                {glyph}
              </button>
            ))}
          </div>
          {items.length > 2 && (
            <div className="insp-group">
              <button className="insp-btn" title="Distribute horizontally" onClick={() => onDistribute('h')}>
                ⇹
              </button>
              <button className="insp-btn" title="Distribute vertically" onClick={() => onDistribute('v')}>
                ⇵
              </button>
            </div>
          )}
          <button className="insp-btn" onClick={onGroup}>
            Group
          </button>
        </>
      )}

      {grouped && (
        <button className="insp-btn" onClick={onUngroup}>
          Ungroup
        </button>
      )}

      {!single && (
        <>
          <div className="insp-sep" />
          <button className="insp-btn" title="Send to back" onClick={onBack}>
            Back
          </button>
          <button className="insp-btn" title="Bring to front" onClick={onFront}>
            Front
          </button>
          <button className="insp-btn" title="Duplicate (⌘D)" onClick={onDuplicate}>
            <IconCopy size={14} />
          </button>
          <button className="insp-btn danger" title="Delete (⌫)" onClick={onDelete}>
            <IconTrash size={14} />
          </button>
        </>
      )}
    </div>
  )
}
