import { useEffect, useRef, useState } from 'react'
import { IconInstagramLogo, IconVideo, IconXLogo } from './Icons.jsx'
import { sourceLabel, timeAgo } from '../lib/format.js'
import { makeThumb } from '../lib/thumbs.js'

function Avatar({ src, name }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return <span className="tw-avatar tw-initial">{initialOf(name)}</span>
  }
  return <img className="tw-avatar" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
}

function CardImage({ src, title, seed }) {
  const [failed, setFailed] = useState(false)
  if (!src || failed) {
    return (
      <img
        src={makeThumb(seed, 1, String(title || 'SAVE'), 'photo')}
        alt={title}
        draggable={false}
      />
    )
  }
  return <img src={src} alt={title} draggable={false} onError={() => setFailed(true)} />
}

const initialOf = (value) =>
  (Array.from(String(value || '?').replace(/^@/, '').trim())[0] || '?').toUpperCase()

const SourceLogo = ({ source, size = 15 }) =>
  source === 'instagram.com' ? <IconInstagramLogo size={size} /> : <IconXLogo size={size} />

export default function ItemCard({
  item,
  showTag,
  dragging,
  onOpen,
  onMenu,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  const moved = useRef(false)
  const images = item.images?.length ? item.images : item.thumb ? [item.thumb] : []
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    setIdx(0)
  }, [item.id])

  const onPointerDown = (e) => {
    if (e.button !== 0) return
    moved.current = false
    const start = { x: e.clientX, y: e.clientY }
    let started = false

    const move = (ev) => {
      if (!started) {
        if (Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < 6) return
        started = true
        onDragStart?.(item.id, ev)
      }
      onDragMove?.(ev)
    }

    const up = (ev) => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      if (!started) return
      onDragEnd?.(ev)
      moved.current = true
      setTimeout(() => {
        moved.current = false
      }, 0)
    }

    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  return (
    <div
      className={`card ${dragging ? 'dragging' : ''}`}
      data-item-id={item.id}
      onPointerDown={onPointerDown}
      onClick={() => {
        if (moved.current) return
        onOpen()
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        onMenu?.(e)
      }}
    >
      {item.video ? (
        <video
          className="card-video"
          src={item.video}
          poster={item.thumb || undefined}
          muted
          loop
          playsInline
          referrerPolicy="no-referrer"
          preload="none"
          disablePictureInPicture
          draggable={false}
          onMouseEnter={(e) => {
            e.currentTarget.play().catch(() => {})
          }}
          onMouseLeave={(e) => {
            e.currentTarget.pause()
            e.currentTarget.currentTime = 0
          }}
        />
      ) : item.textCard ? (
        <div className="tweet-card">
          <div className="tw-head">
            <Avatar src={item.avatar} name={item.authorName || item.author || item.source} />
            <div className="tw-who">
              <span className="tw-name">
                {item.authorName || (item.author ? item.author.replace(/^@/, '') : item.source)}
              </span>
              <span className="tw-handle">{item.author || sourceLabel(item.source)}</span>
            </div>
            <span className="tw-logo">
              <SourceLogo source={item.source} />
            </span>
          </div>
          <p className="tw-body">{item.text || item.title}</p>
          <div className="tw-foot">
            <span>{timeAgo(item.createdAt)}</span>
          </div>
        </div>
      ) : (
        <CardImage src={images[idx] || item.thumb} title={item.title} seed={item.id} />
      )}
      <div className="card-overlay" />
      {item.type === 'video' && (
        <div className="badge tr badge-video" title={item.duration}>
          <IconVideo size={11} />
        </div>
      )}
      {item.type !== 'video' && images.length > 1 && (
        <div className="badge tr badge-carousel">
          <button
            className="bc-btn"
            aria-label="Previous image"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setIdx((v) => (v - 1 + images.length) % images.length)
            }}
          >
            &#8249;
          </button>
          <span className="bc-count">
            {idx + 1}/{images.length}
          </span>
          <button
            className="bc-btn"
            aria-label="Next image"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation()
              setIdx((v) => (v + 1) % images.length)
            }}
          >
            &#8250;
          </button>
        </div>
      )}
      {item.avatar && !item.textCard && (
        <img
          className={`card-avatar ${
            item.type === 'video' || images.length > 1 ? 'with-badge' : ''
          }`}
          src={item.avatar}
          alt=""
          draggable={false}
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
      )}
      {showTag && item.tagLabel && <div className="tag-chip">{item.tagLabel}</div>}
    </div>
  )
}
