import { useEffect, useState } from 'react'
import {
  IconBoard,
  IconClose,
  IconExternal,
  IconFolder,
  IconHash,
  IconInfo,
  IconNote,
  IconPlus,
  IconSparkle
} from './Icons.jsx'
import { itemUrl, timeAgo } from '../lib/format.js'
import { buildPrompt } from '../lib/ai.js'

const handleOf = (item) => String(item.author || item.handle || '').replace(/^@/, '')

export default function DetailsSidebar({
  item,
  collections,
  boards,
  palette,
  onAssign,
  onOpenBoard,
  aiPrompts,
  onSavePrompt
}) {
  const [prompt, setPrompt] = useState(item.aiPrompt || '')
  const [copied, setCopied] = useState(false)
  const [avatarFailed, setAvatarFailed] = useState(false)
  useEffect(() => {
    setAvatarFailed(false)
    setPrompt(item.aiPrompt || '')
  }, [item.id])
  const collectionName = item.collectionId
    ? collections?.find((c) => c.id === item.collectionId)?.name || ''
    : ''
  const url = itemUrl(item)
  const showSourceCard = !!url && (item.syncSource === 'x_bookmark' || item.syncSource === 'instagram_save')
  const handle = handleOf(item)
  const displayName = item.authorName || handle || item.source
  const initial = (Array.from(String(displayName).trim())[0] || '?').toUpperCase()

  return (
    <aside className="details scroll">
      <div className="details-head">
        <span className="details-title">Details</span>
        <button className="icon-btn">
          <IconInfo size={16} />
        </button>
      </div>

      {item.thumb && (
        <div className="dpreview">
          <img src={item.thumbTall || item.thumb} alt="" />
          {item.type === 'video' && <span className="dpreview-badge">MP4</span>}
        </div>
      )}

      {palette?.length > 1 && (
        <div className="dshell">
          <div className="dswatches">
            {palette.map((c, i) => (
              <span
                key={i}
                className="dswatch"
                style={{ background: `rgb(${c.r} ${c.g} ${c.b})` }}
              />
            ))}
          </div>
          <div className="dshell-note">Shell colours from this item</div>
        </div>
      )}

      <div className="dfield">
        <div className="dfield-label">Name</div>
        <input className="dinput" placeholder="Untitled" />
      </div>

      {url && (
        <div className="dfield">
          <div className="dfield-label">URL</div>
          <div className="durl">
            <input value={url} readOnly />
            <button className="icon-btn" onClick={() => window.gather?.openExternal(url)}>
              <IconExternal size={14} />
            </button>
          </div>
        </div>
      )}

      {showSourceCard && (
      <div className="src-card">
        <div className="src-head">
          {item.avatar && !avatarFailed ? (
            <img className="src-avatar-img" src={item.avatar} alt="" onError={() => setAvatarFailed(true)} />
          ) : (
            <div className="src-avatar">{initial}</div>
          )}
          <div className="src-who">
            <div className="src-name">
              {displayName} <span className="src-check">&#10003;</span>
            </div>
            <div className="src-handle">{handle ? `@${handle}` : item.source}</div>
          </div>
        </div>
        <div className="src-body">{item.text || item.title}</div>
        <div className="src-foot">
          <span className="src-logo">&#120143;</span>
          <span>{item.source}</span>
          <span>&middot;</span>
          <span>{timeAgo(item.createdAt)}</span>
          <button className="open" onClick={() => window.gather?.openExternal(url)}>
            Open <IconExternal size={12} />
          </button>
        </div>
      </div>
      )}

      <div className="dsection">
        <button className="dsection-action" style={{ marginTop: 0 }}>
          <IconNote size={15} />
          Add a note
        </button>
      </div>

      <div className="dsection">
        <div className="dsection-head">
          <IconSparkle size={14} />
          Image Prompt
        </div>
        <div style={{ marginTop: 9 }}>
          <button
            className={`gen-btn ${aiPrompts ? '' : 'locked'}`}
            title={aiPrompts ? 'Generate a prompt from this save' : 'Enable prompts in Settings › AI Usage'}
            onClick={() => {
              if (!aiPrompts) return
              const next = buildPrompt(item)
              setPrompt(next)
              setCopied(false)
              onSavePrompt?.(item.id, next)
            }}
          >
            <IconSparkle size={13} />
            Generate prompt
          </button>
        </div>
        {prompt && (
          <div className="prompt-box">
            <p>{prompt}</p>
            <button
              className="prompt-copy"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(prompt)
                  setCopied(true)
                  setTimeout(() => setCopied(false), 1400)
                } catch {
                  /* ignore */
                }
              }}
            >
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div className="dsection">
        <div className="dsection-head">
          <IconFolder size={14} />
          Collections
        </div>
        <button className="dsection-action" onClick={onAssign}>
          <IconPlus size={13} />
          Add
        </button>
        {collectionName && (
          <div className="tagrow">
            <span className="tagpill" style={{ background: '#fff' }}>
              <IconFolder size={11} />
              {collectionName}
            </span>
          </div>
        )}
      </div>

      {boards?.length > 0 && (
        <div className="dsection">
          <div className="dsection-head">
            <IconBoard size={14} />
            Spaces
          </div>
          <div className="tagrow">
            {boards.map((b) => (
              <button key={b.id} className="tagpill" onClick={() => onOpenBoard?.(b.id)}>
                <IconBoard size={11} />
                {b.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="dsection">
        <div className="dsection-head">
          <IconHash size={14} />
          Tags
        </div>
        <button className="dsection-action">
          <IconPlus size={13} />
          Add
        </button>
        <div className="tagrow">
          {item.tags.map((t) => (
            <span className="tagpill" key={t}>
              <IconHash size={11} />
              {t}
              <span className="x">
                <IconClose size={11} />
              </span>
            </span>
          ))}
          {item.autoTag && <span className="autotag">Auto-tag</span>}
        </div>
      </div>
    </aside>
  )
}
