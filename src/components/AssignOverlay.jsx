import { useEffect, useState } from 'react'
import { IconClose, IconTrash } from './Icons.jsx'
import { sourceLabel, timeAgo } from '../lib/format.js'

const initialOf = (value) =>
  (Array.from(String(value || '?').replace(/^@/, '').trim())[0] || '?').toUpperCase()

function StageMedia({ item }) {
  const [failed, setFailed] = useState(false)
  const src = item.thumbTall || item.thumb
  useEffect(() => {
    setFailed(false)
  }, [item.id])

  if (item.type === 'video' && item.video && !failed) {
    return (
      <video
        className="assign-video"
        src={item.video}
        poster={src || undefined}
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
      />
    )
  }
  if (src && !failed) {
    return <img src={src} alt="" draggable={false} onError={() => setFailed(true)} />
  }
  return (
    <div className="tweet-card assign-tweet">
      <div className="tw-head">
        {item.avatar ? (
          <img
            className="tw-avatar"
            src={item.avatar}
            alt=""
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="tw-avatar tw-initial">
            {initialOf(item.authorName || item.author || item.source)}
          </span>
        )}
        <div className="tw-who">
          <span className="tw-name">
            {item.authorName || (item.author ? item.author.replace(/^@/, '') : item.source)}
          </span>
          <span className="tw-handle">{item.author || sourceLabel(item.source)}</span>
        </div>
      </div>
      <p className="tw-body">{item.text || item.title}</p>
      <div className="tw-foot">
        <span>{timeAgo(item.createdAt)}</span>
      </div>
    </div>
  )
}

export default function AssignOverlay({
  item,
  index,
  total,
  collections,
  assignedId,
  onAssign,
  onSkip,
  onDelete,
  onClose
}) {
  return (
    <div className="assign">
      <div className="assign-top">
        <button className="lb-icon" onClick={onClose} title="Close">
          <IconClose size={16} />
        </button>
        <button className="lb-icon assign-del" onClick={onDelete} title="Delete this save forever (⌫)">
          <IconTrash size={15} />
        </button>
        <span className="assign-count">
          {index + 1} / {total}
        </span>
      </div>

      <div className="assign-stage">
        <StageMedia item={item} />
      </div>

      <div className="assign-chips">
        {collections.map((c, i) => (
          <button
            key={c.id}
            className={`chip ${assignedId === c.id ? 'on' : ''}`}
            onClick={() => onAssign(c.id)}
          >
            <span className="num">{i + 1}</span>
            {c.name}
          </button>
        ))}
      </div>

      <div className="assign-foot">
        <span className="k">1-9</span>
        <b>assign</b>
        <span className="k">←</span>
        <span className="k">→</span>
        <b>skip</b>
        <span className="k">⌫</span>
        <b>delete</b>
        <span className="k">Esc</span>
        <b>exit</b>
      </div>
    </div>
  )
}
