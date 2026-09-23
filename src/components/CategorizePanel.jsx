import { IconClose, IconPanelBottom, IconPanelLeft, IconPanelRight } from './Icons.jsx'

const POSITIONS = [
  { id: 'left', title: 'Dock left', icon: <IconPanelLeft size={14} /> },
  { id: 'right', title: 'Dock right', icon: <IconPanelRight size={14} /> },
  { id: 'bottom', title: 'Dock bottom', icon: <IconPanelBottom size={14} /> }
]

export default function CategorizePanel({
  collections,
  position,
  setPosition,
  over,
  pinned,
  onClose,
  onOpenCollection
}) {
  return (
    <aside className={`cat-panel ${position}`}>
      <div className="cat-head">
        <span className="cat-title">Collections</span>
        <div className="cat-actions">
          <div className="cat-pos">
            {POSITIONS.map((p) => (
              <button
                key={p.id}
                className={position === p.id ? 'on' : ''}
                onClick={() => setPosition(p.id)}
                title={p.title}
              >
                {p.icon}
              </button>
            ))}
          </div>
          {pinned && (
            <button className="cat-close" onClick={onClose} title="Close panel">
              <IconClose size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="cat-list">
        {collections.map((c) => (
          <div
            key={c.id}
            data-collection-id={c.id}
            className={`cat-row ${over === c.id ? 'over' : ''}`}
            onClick={() => onOpenCollection?.(c)}
          >
            <span className="cat-thumb">
              <img src={c.cover} alt="" />
            </span>
            <span className="cat-name">{c.name}</span>
            <span className="cat-count">{c.saves}</span>
          </div>
        ))}
      </div>

      <div className="cat-hint">Drop a card on a collection to file it.</div>
    </aside>
  )
}
