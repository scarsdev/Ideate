import { useEffect, useRef, useState } from 'react'
import { IconColumns, IconPlus } from './Icons.jsx'
import { sourceLabel } from '../lib/format.js'

const initialOf = (value) =>
  (Array.from(String(value || '?').replace(/^@/, '').trim())[0] || '?').toUpperCase()

function Front({ front, play }) {
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    setFailed(false)
  }, [front?.id])

  if (!front) return <div className="cf-blank" />

  if (front.type === 'video' && front.video && play && !failed) {
    return (
      <video
        className="cf-media"
        src={front.video}
        poster={front.thumb || undefined}
        muted
        loop
        autoPlay
        playsInline
        onError={() => setFailed(true)}
      />
    )
  }

  const src = front.thumbTall || front.thumb
  if (src && !failed) {
    return (
      <img className="cf-media" src={src} alt="" draggable={false} onError={() => setFailed(true)} />
    )
  }

  return (
    <div className="tweet-card cf-tweet">
      <div className="tw-head">
        {front.avatar ? (
          <img
            className="tw-avatar"
            src={front.avatar}
            alt=""
            draggable={false}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
            }}
          />
        ) : (
          <span className="tw-avatar tw-initial">
            {initialOf(front.authorName || front.author || front.source)}
          </span>
        )}
        <div className="tw-who">
          <span className="tw-name">
            {front.authorName ||
              (front.author ? front.author.replace(/^@/, '') : sourceLabel(front.source))}
          </span>
          <span className="tw-handle">{front.author || sourceLabel(front.source)}</span>
        </div>
      </div>
      <p className="tw-body">{front.text || front.title}</p>
    </div>
  )
}

export default function Coverflow({ collections, active, setActive, onOpen, onLayout, dark }) {
  const n = collections.length
  const stageRef = useRef(null)
  const [step, setStep] = useState(120)
  const [stageH, setStageH] = useState(560)
  const [hover, setHover] = useState(-1)

  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth
      setStageH(el.clientHeight)
      const s = n > 1 ? (w - 24) / (n - 1) : 150
      setStep(Math.max(46, Math.min(170, s)))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [n])

  useEffect(() => {
    const onWheel = (e) => {
      const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(delta) < 4) return
      setActive((i) => Math.min(n - 1, Math.max(0, i + (delta > 0 ? 1 : -1))))
    }
    window.addEventListener('wheel', onWheel, { passive: true })
    return () => window.removeEventListener('wheel', onWheel)
  }, [n, setActive])

  const restW = Math.round(Math.max(26, step * 0.85))
  const pullW = Math.round(Math.max(restW * 1.9, Math.min(stageH * 0.42, 400)))

  return (
    <div
      className="coverflow"
      style={{
        '--cf-step': `${step}px`,
        '--cf-w': `${restW}px`,
        '--cf-wp': `${pullW}px`
      }}
    >
      <div className="cf-names">
        {collections.map((col, i) => (
          <button
            key={col.id}
            type="button"
            className={`cf-name${i === active ? ' on' : ''}`}
            style={{ transform: `translateX(${(i - (n - 1) / 2) * step}px)` }}
            onClick={() => setActive(i)}
          >
            <span className="n">{col.name}</span>
            <span className="s">{col.saves} saves</span>
          </button>
        ))}
      </div>

      <div className="cf-stage" ref={stageRef}>
        {collections.map((col, i) => {
          const on = i === active
          const hov = !on && i === hover
          const pulled = on || hov
          const abs = Math.abs(i - active)
          const x = (i - (n - 1) / 2) * step
          const bright = (dark ? 0.36 : 0.56) + (dark ? 0.46 : 0.36) * (n > 1 ? i / (n - 1) : 1)
          const jitterY = ((i * 29) % 9) - 4
          const restYaw = -24 + (((i * 53) % 7) - 3)
          return (
            <div
              key={col.id}
              className={`cf-slide${on ? ' on' : ''}${hov ? ' hover' : ''}`}
              style={{
                transform: `perspective(1100px) translate(-50%, 0) translateX(${x}px) translateY(${
                  on ? -6 : hov ? -2 : jitterY
                }px) translateZ(${on ? 46 : hov ? 10 : 0}px) rotateY(${
                  on ? -14 : hov ? restYaw - 3 : restYaw
                }deg)`,
                filter: pulled ? 'none' : `brightness(${bright})`,
                zIndex: on ? 500 + i : hov ? 20 + i : 10 + i
              }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? -1 : h))}
              onClick={() => (on ? onOpen(col) : setActive(i))}
            >
              <div className="cf-sleeve">
                <Front front={col.front} play={abs <= 4} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="cf-foot">
        <span className="cf-hint">← → to browse · click a sleeve to open</span>
        <button className="cf-new" onClick={() => onOpen(collections[active])}>
          <IconPlus size={13} />
          New collection
        </button>
        <button className="icon-btn" onClick={onLayout} title="Grid view">
          <IconColumns size={15} />
        </button>
      </div>
    </div>
  )
}
