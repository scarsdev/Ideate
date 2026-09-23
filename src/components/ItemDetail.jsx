import { useEffect, useRef, useState } from 'react'
import {
  IconChevronLeft,
  IconChevronRight,
  IconCopy,
  IconClose,
  IconDownload,
  IconInfo,
  IconPause,
  IconPlay,
  IconVolume,
  IconXLogo
} from './Icons.jsx'
import DetailsSidebar from './DetailsSidebar.jsx'
import { extractPalette, shellTheme } from '../lib/palette.js'
import { copyImageToClipboard } from '../lib/format.js'

const extFromUrl = (url) => {
  const m = String(url || '')
    .split('?')[0]
    .match(/\.(png|jpe?g|webp|gif|avif|mp4|mov|webm)$/i)
  return m ? m[1].toLowerCase() : ''
}

function parseDuration(d) {
  if (!d) return 45
  const [m, s] = d.split(':').map(Number)
  return m * 60 + s
}

function fmt(t) {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function VideoBar({ duration }) {
  const [playing, setPlaying] = useState(true)
  const [time, setTime] = useState(3)
  const total = duration

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setTime((t) => (t + 0.25 >= total ? 0 : t + 0.25))
    }, 250)
    return () => clearInterval(id)
  }, [playing, total])

  const pct = (time / total) * 100

  return (
    <div className="video-bar">
      <button className="vb-btn" onClick={() => setPlaying((p) => !p)}>
        {playing ? <IconPause size={14} /> : <IconPlay size={14} />}
      </button>
      <span className="vb-time">
        {fmt(time)} / {fmt(total)}
      </span>
      <div className="vb-track">
        <div className="vb-fill" style={{ width: `${pct}%` }} />
        <div className="vb-knob" style={{ left: `${pct}%` }} />
      </div>
      <button className="vb-btn">
        <IconVolume size={16} />
      </button>
    </div>
  )
}

export default function ItemDetail({
  item,
  index,
  total,
  collections,
  boards,
  dark,
  showDetails,
  setShowDetails,
  onClose,
  onPrev,
  onNext,
  onAssign,
  onOpenBoard,
  aiPrompts,
  onSavePrompt
}) {
  const [zoom, setZoom] = useState(100)
  const [palette, setPalette] = useState(null)
  const [videoBroken, setVideoBroken] = useState(false)
  const isVideo = item.type === 'video'

  useEffect(() => {
    setZoom(100)
  }, [item.id])

  useEffect(() => {
    let live = true
    setPalette(null)
    extractPalette(item.thumb || item.thumbTall).then((p) => {
      if (live && p) setPalette(p)
    })
    return () => {
      live = false
    }
  }, [item.id, item.thumb, item.thumbTall])

  useEffect(() => {
    setVideoBroken(false)
  }, [item.id])

  const shell = shellTheme(palette, dark)

  const mediaStyle = isVideo ? undefined : { transform: `scale(${zoom / 100})` }

  const mediaSrc = isVideo
    ? item.video || item.thumbTall || item.thumb
    : item.thumbTall || item.thumb

  const downloadMedia = async () => {
    if (!mediaSrc) return
    const base =
      String(item.title || item.authorName || item.author || 'gather-item')
        .replace(/[/\\?%*:|"<>]+/g, ' ')
        .trim()
        .slice(0, 60) || 'gather-item'
    const ext = extFromUrl(mediaSrc) || (isVideo ? 'mp4' : 'jpg')
    try {
      if (window.gather?.downloadUrl) {
        await window.gather.downloadUrl(`${base}.${ext}`, mediaSrc)
      }
    } catch {
      /* ignore */
    }
  }

  const copyMedia = async () => {
    try {
      if (!isVideo && mediaSrc) {
        await copyImageToClipboard(mediaSrc)
        return
      }
      const link = item.video || item.url || ''
      if (link) await navigator.clipboard.writeText(link)
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`lightbox ${palette ? 'tinted' : ''}`} style={shell || undefined}>
      <div className="lb-top">
        <button className="lb-icon" onClick={onClose} title="Back to library">
          <IconChevronLeft size={17} />
        </button>
        <span className="lb-counter">
          {index + 1} / {total}
        </span>

        <div className="lb-right">
          <span className="lb-zoom">{zoom}%</span>
          <input
            className="lb-slider"
            type="range"
            min="50"
            max="200"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          />
          <button className="lb-icon" title="Download" onClick={downloadMedia}>
            <IconDownload size={16} />
          </button>
          <button className="lb-icon" title="Copy" onClick={copyMedia}>
            <IconCopy size={16} />
          </button>
          <button
            className={`lb-icon ${showDetails ? 'active' : ''}`}
            onClick={() => setShowDetails((v) => !v)}
            title="Details"
          >
            <IconInfo size={16} />
          </button>
          <button className="lb-icon" onClick={onClose} title="Close">
            <IconClose size={16} />
          </button>
        </div>
      </div>

      <div className="lb-main">
        <div
          className="lb-stage"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose()
          }}
        >
          {item.video && !videoBroken ? (
            <video
              className="lb-video"
              src={item.video}
              poster={item.thumb || undefined}
              controls
              autoPlay
              playsInline
              referrerPolicy="no-referrer"
              onError={() => setVideoBroken(true)}
              style={mediaStyle}
            />
          ) : item.textCard ? (
            <div className="lb-tweet">
              <div className="tw-head">
                {item.avatar ? (
                  <img className="tw-avatar" src={item.avatar} alt="" />
                ) : (
                  <span className="tw-avatar tw-initial">
                    {(Array.from(
                      String(item.authorName || item.author || item.source).replace(/^@/, '')
                    )[0] || '?').toUpperCase()}
                  </span>
                )}
                <div className="tw-who">
                  <span className="tw-name">
                    {item.authorName || (item.author ? item.author.replace(/^@/, '') : item.source)}
                  </span>
                  <span className="tw-handle">{item.author || item.source}</span>
                </div>
                <span className="tw-logo">
                  <IconXLogo size={17} />
                </span>
              </div>
              <p className="tw-body">{item.text || item.title}</p>
              <div className="tw-foot">{new Date(item.createdAt).toLocaleString()}</div>
            </div>
          ) : isVideo ? (
            <>
              <img src={item.thumbTall || item.thumb} alt={item.title} style={mediaStyle} />
              <VideoBar duration={parseDuration(item.duration)} />
            </>
          ) : (
            <img src={item.thumbTall || item.thumb} alt={item.title} style={mediaStyle} />
          )}
        </div>

        {showDetails && (
          <DetailsSidebar
            item={item}
            collections={collections}
            boards={boards}
            palette={palette}
            onAssign={onAssign}
            onOpenBoard={onOpenBoard}
            aiPrompts={aiPrompts}
            onSavePrompt={onSavePrompt}
          />
        )}
      </div>

      <div className="lb-foot">
        <button className="lb-nav" onClick={onPrev} title="Previous">
          <IconChevronLeft size={15} />
        </button>
        <button className="lb-nav" onClick={onNext} title="Next">
          <IconChevronRight size={15} />
        </button>
        <span>to navigate</span>
        <button className="lb-nav" onClick={onAssign} title="Assign">
          A
        </button>
        <span>to assign</span>
      </div>
    </div>
  )
}
