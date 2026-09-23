import { useEffect, useMemo, useRef, useState } from 'react'
import {
  IconArchive,
  IconBooks,
  IconCamera,
  IconCheck,
  IconChevronDown,
  IconChevronRight,
  IconDatabase,
  IconDisplay,
  IconDownload,
  IconHash,
  IconHistory,
  IconInfo,
  IconMoon,
  IconPalette,
  IconPencil,
  IconPlus,
  IconSparkle,
  IconSun,
  IconSync,
  IconTrash,
  IconUser
} from './Icons.jsx'
import { formatMB, formatSnapshotDate, shortcutKeys, TRASH_RETENTION } from '../lib/settings.js'

export const SECTIONS = [
  { id: 'account', label: 'Account', icon: <IconUser size={17} />, view: Account },
  { id: 'appearance', label: 'Appearance', icon: <IconPalette size={17} />, view: Appearance },
  { id: 'libraries', label: 'Libraries', icon: <IconBooks size={17} />, view: Libraries },
  { id: 'ai', label: 'AI Usage', icon: <IconSparkle size={17} />, view: AiUsage },
  { id: 'tags', label: 'Tags', icon: <IconHash size={17} />, view: Tags },
  { id: 'capture', label: 'Capture', icon: <IconCamera size={17} />, view: Capture },
  { id: 'syncing', label: 'Syncing', icon: <IconSync size={17} />, view: Syncing },
  { id: 'updates', label: 'Updates', icon: <IconDownload size={17} />, view: Updates },
  { id: 'storage', label: 'Storage', icon: <IconArchive size={17} />, view: Storage },
  { id: 'data', label: 'Data', icon: <IconDatabase size={17} />, view: Data },
  { id: 'about', label: 'About', icon: <IconInfo size={17} />, view: About }
]

function Pane({ title, lead, children, wide }) {
  return (
    <div className={`set-pane ${wide ? 'wide' : ''}`} data-pane>
      <h1 className="set-title">{title}</h1>
      {lead && <p className="set-lead">{lead}</p>}
      {children}
    </div>
  )
}

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      className={`sw ${checked ? 'on' : ''}`}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className="sw-knob" />
    </button>
  )
}

function Select({ value, options, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = options.find((o) => o.value === value) || options[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div className="sel" ref={ref}>
      <button className="sel-btn" onClick={() => setOpen((v) => !v)}>
        {current.label}
        <IconChevronDown size={12} />
      </button>
      {open && (
        <div className="menu sel-menu">
          {options.map((o) => (
            <button
              key={o.value}
              className="menu-item"
              onClick={() => {
                onChange(o.value)
                setOpen(false)
              }}
            >
              <span>{o.label}</span>
              {o.value === value && <IconCheck size={13} />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Row({ title, desc, children }) {
  return (
    <div className="set-row">
      <div className="set-row-text">
        <div className="set-row-title">{title}</div>
        {desc && <div className="set-row-desc">{desc}</div>}
      </div>
      {children}
    </div>
  )
}

function Block({ title, desc, children }) {
  return (
    <div className="set-block">
      <div className="set-block-head">
        <div className="set-row-title">{title}</div>
        {children}
      </div>
      {desc && <div className="set-block-desc">{desc}</div>}
    </div>
  )
}

function Account({ settings, setSettings }) {
  const signedIn = settings.signedIn
  return (
    <Pane title="Account">
      <div className="acct-card">
        <div className="acct-row">
          <span>Current plan</span>
          <b>Free trial</b>
        </div>
        <div className="acct-row">
          <span>Trial</span>
          <b>6 days left</b>
        </div>
        <div className="acct-row">
          <span>Pro price</span>
          <b>
            $4.99/mo &middot; $49/yr&nbsp;
            <i className="acct-sub">(save ~18% yearly)</i>
          </b>
        </div>
      </div>

      <div className="acct-body">
        <div className="note-row">
          <IconInfo size={18} />
          <p>
            {signedIn
              ? 'You\u2019re signed in. AI usage syncs to your account and your subscription is managed here. Your library stays on this Mac either way.'
              : 'You\u2019re signed out. Sign back in to sync your AI usage and manage your subscription. Your library stays on this Mac either way.'}
          </p>
        </div>
        {signedIn ? (
          <button
            className="btn btn-line"
            onClick={() =>
              setSettings((s) => ({
                ...s,
                signedIn: false,
                aiAutoName: false,
                aiVisualSearch: false
              }))
            }
          >
            Sign out
          </button>
        ) : (
          <button
            className="btn btn-dark"
            onClick={() => setSettings((s) => ({ ...s, signedIn: true }))}
          >
            Sign in
          </button>
        )}
      </div>
    </Pane>
  )
}

const THEMES = [
  { value: 'light', label: 'Light', icon: <IconSun size={16} /> },
  { value: 'dark', label: 'Dark', icon: <IconMoon size={16} /> },
  { value: 'system', label: 'System', icon: <IconDisplay size={16} /> }
]

function Appearance({ settings, setSettings }) {
  return (
    <Pane
      title="Appearance"
      lead={'Pick a theme. "System" follows your Mac\u2019s appearance setting and updates automatically when it changes.'}
    >
      <div className="theme-seg">
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={settings.theme === t.value ? 'active' : ''}
            onClick={() => setSettings((s) => ({ ...s, theme: t.value }))}
          >
            {settings.theme === t.value && t.icon}
            {t.label}
          </button>
        ))}
      </div>
    </Pane>
  )
}

function Libraries({ settings, setSettings, itemCount, covers }) {
  const [renaming, setRenaming] = useState(null)
  const [draft, setDraft] = useState('')

  const commit = () => {
    const name = draft.trim()
    if (name) {
      setSettings((s) => ({
        ...s,
        libraries: s.libraries.map((l) => (l.id === renaming ? { ...l, name } : l))
      }))
    }
    setRenaming(null)
  }

  const addLibrary = () =>
    setSettings((s) => {
      const lib = { id: `lib_${Date.now()}`, name: `Library ${s.libraries.length + 1}`, saves: 0 }
      return { ...s, libraries: [...s.libraries, lib], activeLibrary: lib.id }
    })

  const removeLibrary = (id) =>
    setSettings((s) => {
      const libraries = s.libraries.filter((l) => l.id !== id)
      return {
        ...s,
        libraries,
        activeLibrary: s.activeLibrary === id ? libraries[0].id : s.activeLibrary
      }
    })

  return (
    <Pane
      title="Libraries"
      wide
      lead="Each library is its own set of saves, collections, and spaces. Switch between them from the toolbar; rename or delete any of them here."
    >
      {settings.libraries.map((lib) => {
        const isActive = lib.id === settings.activeLibrary
        const saves = isActive ? itemCount : lib.saves ?? 0
        return (
          <div
            key={lib.id}
            className={`lib-card ${isActive ? 'active' : ''}`}
            data-lib={lib.id}
            onClick={() => {
              if (!isActive) setSettings((s) => ({ ...s, activeLibrary: lib.id }))
            }}
          >
            <div className="lib-fan">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`fan-card fan-${i}`}>
                  {isActive && covers[i] ? <img src={covers[i]} alt="" /> : null}
                </span>
              ))}
            </div>
            <div className="lib-info">
              <div className="lib-name-row">
                {renaming === lib.id ? (
                  <input
                    className="lib-name-input"
                    autoFocus
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commit()
                      if (e.key === 'Escape') setRenaming(null)
                    }}
                    onBlur={commit}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <h3 className="lib-name">{lib.name}</h3>
                )}
                {isActive && <span className="lib-badge">Active</span>}
              </div>
              <p className="lib-saves">{saves.toLocaleString()} saves</p>
              <div className="lib-actions" onClick={(e) => e.stopPropagation()}>
                <button
                  className="btn btn-line"
                  onClick={() => {
                    setRenaming(lib.id)
                    setDraft(lib.name)
                  }}
                >
                  <IconPencil size={14} />
                  Rename
                </button>
                {settings.libraries.length > 1 && (
                  <button
                    className="lib-del"
                    title="Delete library"
                    onClick={() => removeLibrary(lib.id)}
                  >
                    <IconTrash size={15} />
                  </button>
                )}
              </div>
            </div>
          </div>
        )
      })}

      <button className="btn btn-dark lib-new" onClick={addLibrary}>
        <IconPlus size={16} />
        New library
      </button>
    </Pane>
  )
}

function AiUsage({ settings, setSettings, itemCount, onTagAll, onCancelTagAll, onCategorizeAll, onCancelCategorize }) {
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)
  const [progress, setProgress] = useState(null)
  const [catBusy, setCatBusy] = useState(false)
  const [catDone, setCatDone] = useState(null)
  const [catProgress, setCatProgress] = useState(null)
  const [hasKey, setHasKey] = useState(null)
  const [hasDeepseek, setHasDeepseek] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [dsInput, setDsInput] = useState('')

  useEffect(() => {
    window.gather?.ai
      ?.status?.()
      .then((s) => {
        setHasKey(!!s?.hasKey)
        setHasDeepseek(!!s?.hasDeepseek)
      })
      .catch(() => {
        setHasKey(false)
        setHasDeepseek(false)
      })
  }, [])

  const saveKey = async (provider) => {
    const value = provider === 'deepseek' ? dsInput.trim() : keyInput.trim()
    if (!value) return
    const res = await window.gather?.ai?.setKey?.(provider, value)
    setHasKey(!!res?.hasKey)
    setHasDeepseek(!!res?.hasDeepseek)
    if (provider === 'deepseek') setDsInput('')
    else setKeyInput('')
  }

  const want = settings.aiEngine || 'auto'
  const engine =
    want === 'jev'
      ? hasKey
        ? 'jev'
        : hasDeepseek
          ? 'deepseek'
          : null
      : want === 'deepseek'
        ? hasDeepseek
          ? 'deepseek'
          : hasKey
            ? 'jev'
            : null
        : hasKey
          ? 'jev'
          : hasDeepseek
            ? 'deepseek'
            : null

  const buttonLabel = busy
    ? engine === 'deepseek'
      ? 'DeepSeek is tagging\u2026'
      : engine === 'jev'
        ? 'Jev is tagging\u2026'
        : 'Tagging\u2026'
    : engine === 'deepseek'
      ? 'Tag & name with DeepSeek'
      : engine === 'jev'
        ? 'Tag & name with Jev'
        : 'Tag & name existing saves'

  return (
    <Pane
      title="AI Usage"
      lead="Tagging and naming runs locally by default. Connect TypeSafe Jev or DeepSeek to label saves with AI — only each save's text is sent."
    >
      <div className="set-label">AI features enabled</div>
      <div className="set-rows">
        <Row title="Auto-tag new saves" desc="Derive keywords from each save's text and source, shown as tags everywhere.">
          <Toggle
            checked={settings.aiAutoTag}
            onChange={(v) => setSettings((s) => ({ ...s, aiAutoTag: v }))}
          />
        </Row>
        <Row title="Auto-name new saves" desc="Give untitled saves a short name from their first line of text.">
          <Toggle
            checked={settings.aiAutoName}
            onChange={(v) => setSettings((s) => ({ ...s, aiAutoName: v }))}
          />
        </Row>
        <Row title="Image prompts" desc="Generate a reusable image prompt from any save in the detail sidebar.">
          <Toggle
            checked={settings.aiPrompts}
            onChange={(v) => setSettings((s) => ({ ...s, aiPrompts: v }))}
          />
        </Row>
        <Row
          title="Smart search"
          desc='Match search by tags and author as well as exact words ("dark moody UI" still needs exact wording).'
        >
          <Toggle
            checked={settings.aiVisualSearch}
            onChange={(v) => setSettings((s) => ({ ...s, aiVisualSearch: v }))}
          />
        </Row>
      </div>
      <div className="set-sep" />
      <div className="set-label">AI providers</div>
      <div className="set-rows">
        <Row
          title="TypeSafe Jev API key"
          desc={
            hasKey
              ? 'Connected. Manage keys at console.typesafe.ai/settings/keys.'
              : 'Fast structured judgements. Get a key at console.typesafe.ai.'
          }
        >
          <div className="key-row">
            <input
              className="set-input mono"
              type="password"
              placeholder={hasKey ? '•••••••• (saved)' : 'Paste key'}
              value={keyInput}
              onChange={(e) => setKeyInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && keyInput.trim()) saveKey('jev')
              }}
            />
            <button
              className="btn btn-line"
              disabled={!keyInput.trim()}
              onClick={() => saveKey('jev')}
            >
              Save
            </button>
          </div>
        </Row>
        <Row
          title="DeepSeek API key"
          desc={
            hasDeepseek
              ? 'Connected. Manage keys at platform.deepseek.com.'
              : 'Generates names and tags directly. Get a key at platform.deepseek.com.'
          }
        >
          <div className="key-row">
            <input
              className="set-input mono"
              type="password"
              placeholder={hasDeepseek ? '•••••••• (saved)' : 'Paste key'}
              value={dsInput}
              onChange={(e) => setDsInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && dsInput.trim()) saveKey('deepseek')
              }}
            />
            <button
              className="btn btn-line"
              disabled={!dsInput.trim()}
              onClick={() => saveKey('deepseek')}
            >
              Save
            </button>
          </div>
        </Row>
      </div>
      <div className="set-sep" />
      <div className="set-label">Apply to existing saves</div>
      <div className="theme-seg" style={{ marginBottom: 14, width: 'fit-content' }}>
        {[
          { v: 'auto', label: 'Auto' },
          { v: 'jev', label: 'Jev' },
          { v: 'deepseek', label: 'DeepSeek' }
        ].map((o) => (
          <button
            key={o.v}
            className={want === o.v ? 'active' : ''}
            onClick={() => setSettings((s) => ({ ...s, aiEngine: o.v }))}
          >
            {o.label}
          </button>
        ))}
      </div>
      <div className="folder-row">
        <button
          className="btn btn-line"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            setDone(null)
            setProgress(null)
            const n = await onTagAll?.((d, t) => setProgress({ d, t }))
            setDone(n ?? 0)
            setBusy(false)
            setProgress(null)
          }}
        >
          {buttonLabel}
        </button>
        {busy && (
          <button className="btn btn-line" onClick={() => onCancelTagAll?.()}>
            Cancel
          </button>
        )}
        <span className="set-hint" style={{ margin: 0 }}>
          {busy && progress
            ? `${progress.d.toLocaleString()} / ${progress.t.toLocaleString()}\u2026`
            : done != null
              ? `${done.toLocaleString()} saves updated`
              : `${(itemCount || 0).toLocaleString()} saves in this library`}
        </span>
      </div>
      <div className="set-sep" />
      <div className="set-label">Categorise existing saves</div>
      <div className="folder-row">
        <button
          className="btn btn-line"
          disabled={catBusy}
          onClick={async () => {
            setCatBusy(true)
            setCatDone(null)
            setCatProgress(null)
            const n = await onCategorizeAll?.((d, t) => setCatProgress({ d, t }))
            setCatDone(n ?? 0)
            setCatBusy(false)
            setCatProgress(null)
          }}
        >
          {catBusy ? 'Filing saves\u2026' : 'File saves into collections'}
        </button>
        {catBusy && (
          <button className="btn btn-line" onClick={() => onCancelCategorize?.()}>
            Cancel
          </button>
        )}
        <span className="set-hint" style={{ margin: 0 }}>
          {catBusy && catProgress
            ? `${catProgress.d.toLocaleString()} / ${catProgress.t.toLocaleString()}\u2026`
            : catDone != null
              ? `${catDone.toLocaleString()} saves filed`
              : 'Unsorted saves only'}
        </span>
      </div>
      <p className="set-hint" style={{ margin: '10px 0 0' }}>
        Captions are classified with Jev; photos are classified from the image with DeepSeek Flash.
        Low-confidence picks stay in Unsorted.
      </p>
    </Pane>
  )
}

const TAG_SORTS = [
  { value: 'most', label: 'Most used' },
  { value: 'az', label: 'A\u2013Z' },
  { value: 'fewest', label: 'Fewest' }
]

function Tags({ tags, onDeleteTag }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('most')

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = tags.filter((t) => t.name.toLowerCase().includes(needle))
    if (sort === 'az') return [...list].sort((a, b) => a.name.localeCompare(b.name))
    if (sort === 'fewest') return [...list].sort((a, b) => a.count - b.count)
    return [...list].sort((a, b) => b.count - a.count)
  }, [tags, q, sort])

  return (
    <Pane title="Tags" wide>
      <div className="tags-bar">
        <input
          className="set-input"
          placeholder="Search tags..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Select value={sort} options={TAG_SORTS} onChange={setSort} />
      </div>
      <div className="tags-count" data-tag-count>
        {filtered.length} {filtered.length === 1 ? 'tag' : 'tags'}
      </div>
      <div className="tag-rows">
        {filtered.map((t) => (
          <div className="tag-row" key={t.name} data-tag={t.name}>
            <span className="tag-name">#{t.name}</span>
            <span className="tag-saves">
              {t.count.toLocaleString()} {t.count === 1 ? 'save' : 'saves'}
            </span>
            <button className="tag-del" title="Delete tag" onClick={() => onDeleteTag(t.name)}>
              <IconTrash size={16} />
            </button>
          </div>
        ))}
        {!filtered.length && (
          <div className="tags-empty">{'No tags match \u201c'}{q}{'\u201d.'}</div>
        )}
      </div>
    </Pane>
  )
}

function Capture({ settings, setSettings }) {
  const [recording, setRecording] = useState(false)
  const [mods, setMods] = useState(null)

  useEffect(() => {
    if (!recording) return
    const onKey = (e) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(false)
        return
      }
      if (['Meta', 'Shift', 'Alt', 'Control', 'CapsLock'].includes(e.key)) {
        setMods({ meta: e.metaKey, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey })
        return
      }
      setSettings((s) => ({
        ...s,
        captureShortcut: {
          meta: e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
          ctrl: e.ctrlKey,
          key: e.key.length === 1 ? e.key.toUpperCase() : e.key
        }
      }))
      setRecording(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, setSettings])

  const choose = async () => {
    const dir = await window.gather?.pickDirectory?.()
    if (dir) setSettings((s) => ({ ...s, dropFolder: dir }))
  }

  const keys = recording && mods ? shortcutKeys(mods) : shortcutKeys(settings.captureShortcut)

  return (
    <Pane
      title="Capture"
      lead="Configure the global screenshot shortcut, capture mode, and where captures land. Changes apply immediately."
    >
      <div className="set-label">Global shortcut</div>
      <button
        className={`keycaps ${recording ? 'rec' : ''}`}
        title="Record shortcut"
        onClick={() => {
          setRecording((v) => !v)
          setMods(null)
        }}
      >
        {keys.map((k, i) => (
          <span className="keycap" key={`${k}-${i}`}>
            {k}
          </span>
        ))}
      </button>
      <p className="set-hint">Captures the next key combo you press. Esc cancels.</p>

      <div className="set-sep" />

      <div className="set-label">Capture mode</div>
      <div className="theme-seg" style={{ marginBottom: 14 }}>
        {[
          { value: 'region', label: 'Region' },
          { value: 'window', label: 'Window' },
          { value: 'screen', label: 'Full screen' }
        ].map((m) => (
          <button
            key={m.value}
            className={settings.captureMode === m.value ? 'active' : ''}
            onClick={() => setSettings((s) => ({ ...s, captureMode: m.value }))}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="set-label">Drop folder</div>
      <div className="folder-row">
        <input className="set-input mono" readOnly value={settings.dropFolder} placeholder="" />
        <button className="btn btn-line" onClick={choose}>
          Choose location
        </button>
        <button
          className="btn btn-line"
          disabled={!settings.dropFolder}
          onClick={() => setSettings((s) => ({ ...s, dropFolder: '' }))}
        >
          Clear
        </button>
      </div>
      <p className="set-hint">
        When set, screenshots also land here as files. Leave empty to save to Pictures.
      </p>

      <div className="set-sep" />
      <div className="folder-row">
        <button className="btn btn-line" onClick={() => window.gather?.capture?.now?.()}>
          Capture now
        </button>
        <span className="set-hint" style={{ margin: 0 }}>
          Shortcut changes apply immediately.
        </span>
      </div>
    </Pane>
  )
}

function Syncing({ settings, setSettings }) {
  const [meta, setMeta] = useState(null)
  const [summary, setSummary] = useState(null)
  const [copied, setCopied] = useState('')

  useEffect(() => {
    let live = true
    const tick = async () => {
      const [m, snap] = await Promise.all([
        window.gather?.sync?.meta?.(),
        window.gather?.sync?.snapshot?.()
      ])
      if (!live) return
      if (m) setMeta(m)
      if (snap) setSummary(snap.summary)
    }
    tick()
    const timer = setInterval(tick, 4000)
    return () => {
      live = false
      clearInterval(timer)
    }
  }, [])

  const copy = async (what, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(what)
      setTimeout(() => setCopied(''), 1600)
    } catch {
      /* ignore */
    }
  }

  const SYNC_ROWS = [
    { source: 'bookmark', label: 'Browser bookmarks', key: 'syncBookmarks' },
    { source: 'x_bookmark', label: 'X bookmarks', key: 'syncX' },
    { source: 'instagram_save', label: 'Instagram saves', key: 'syncInstagram' }
  ]

  return (
    <Pane
      title="Syncing"
      lead="Pull in what you bookmark elsewhere. When off, those posts stop flowing into your library."
    >
      <div className="set-label">Local sync server</div>
      <div className="sync-box">
        <div className="sync-line">
          <span className={`sync-dot ${meta?.running ? 'on' : ''}`} />
          <span className="sync-key">Server</span>
          <span className="sync-val">
            {meta?.running ? `Running at ${meta.url}` : 'Starting\u2026'}
          </span>
          {meta?.url && (
            <button className="sync-mini" onClick={() => copy('url', meta.url)}>
              {copied === 'url' ? 'Copied' : 'Copy URL'}
            </button>
          )}
        </div>
        <div className="sync-line">
          <span className={`sync-dot ${meta?.token ? 'on' : ''}`} />
          <span className="sync-key">Access token</span>
          <span className="sync-val mono">{meta?.token || '\u2026'}</span>
          {meta?.token && (
            <button className="sync-mini" onClick={() => copy('token', meta.token)}>
              {copied === 'token' ? 'Copied' : 'Copy token'}
            </button>
          )}
        </div>
        <div className="sync-line">
          <span className={`sync-dot ${meta?.extensionDir ? 'on' : ''}`} />
          <span className="sync-key">Extension</span>
          <span className="sync-val">
            {meta?.extensionDir ? 'Load sync-extension/ unpacked in Chrome' : 'Not found'}
          </span>
          {meta?.extensionDir && (
            <button className="sync-mini" onClick={() => window.gather?.sync?.revealExtension?.()}>
              Reveal
            </button>
          )}
        </div>
      </div>
      <p className="set-hint">
        Paste the server URL and token into the extension popup, then load the Reveal folder via
        chrome://extensions → Load unpacked.
      </p>

      <div className="set-label">Syncing</div>
      <div className="set-rows">
        {SYNC_ROWS.map((row) => {
          const st = summary?.sources?.[row.source]
          return (
            <Row
              key={row.source}
              title={row.label}
              desc={
                st
                  ? `${st.total} ${st.total === 1 ? 'item' : 'items'} \u00b7 ${
                      st.lastSyncedAt
                        ? `last synced ${new Date(st.lastSyncedAt).toLocaleTimeString(undefined, {
                            hour: 'numeric',
                            minute: '2-digit'
                          })}`
                        : 'not synced yet'
                    }${st.initialBackfillDone ? ' \u00b7 backfill done' : ''}`
                  : 'Waiting for the extension'
              }
            >
              <Toggle
                checked={settings[row.key]}
                onChange={(v) => setSettings((s) => ({ ...s, [row.key]: v }))}
              />
            </Row>
          )
        })}
        <Row title="Sync Cosmos saves">
          <Toggle
            checked={settings.syncCosmos}
            onChange={(v) => setSettings((s) => ({ ...s, syncCosmos: v }))}
          />
        </Row>
      </div>
      <p className="set-foot">
        When off, posts you bookmark on X, save on Instagram, or save on Cosmos stop flowing into
        your library. Saving images and pages from the browser extension still works.
      </p>
      {summary?.inbox > 0 && (
        <p className="set-hint">
          {summary.inbox} {summary.inbox === 1 ? 'item is' : 'items are'} waiting in your inbox —
          they show up in Focused sort until you file them.
        </p>
      )}
    </Pane>
  )
}

function Updates({ settings, setSettings, version }) {
  const [phase, setPhase] = useState('idle')
  const [status, setStatus] = useState('')

  const check = () => {
    if (phase === 'checking') return
    setPhase('checking')
    setStatus('')
    setTimeout(() => {
      setPhase('idle')
      setStatus(`You\u2019re up to date \u00b7 v${version}`)
    }, 1300)
  }

  return (
    <Pane
      title="Updates"
      lead="Gather checks for updates in the background and installs them the next time you quit."
    >
      <div className="set-rows">
        <Row title="Download updates automatically">
          <Toggle
            checked={settings.autoUpdate}
            onChange={(v) => setSettings((s) => ({ ...s, autoUpdate: v }))}
          />
        </Row>
      </div>
      <div className="set-actions">
        <button className="btn btn-dark" onClick={check} disabled={phase === 'checking'}>
          <IconDownload size={16} />
          {phase === 'checking' ? 'Checking\u2026' : 'Check for updates'}
        </button>
        {status && <span className="set-hint inline">{status}</span>}
      </div>
    </Pane>
  )
}

function Storage({ settings, setSettings, stats }) {
  const [busy, setBusy] = useState(false)

  const reclaim = () => {
    if (busy || settings.reclaimed) return
    setBusy(true)
    setTimeout(() => {
      setBusy(false)
      setSettings((s) => ({
        ...s,
        reclaimed: { mb: stats.images * 0.41, count: stats.count }
      }))
    }, 1400)
  }

  return (
    <Pane
      title="Storage"
      lead={
        'How much disk your library uses. New images are optimized as they\u2019re saved; collections, tags, and search are never affected.'
      }
    >
      <div className="set-label">On this Mac</div>
      <div className="size-row">
        <div>
          <div className="size-title">Library size</div>
          <div className="size-sub">
            Images {formatMB(stats.images)} &middot; thumbnails {formatMB(stats.thumbs)}
          </div>
        </div>
        <div className="size-val">{formatMB(stats.total)}</div>
      </div>

      <div className="set-label">Image quality</div>
      <Block
        title="Keep full-resolution originals"
        desc="Off (recommended) optimizes new images on import — caps the longest edge and re-encodes to WebP — to keep your library small. Turn it on to store the full-size file instead; your library will be larger."
      >
        <Toggle
          checked={settings.keepOriginals}
          onChange={(v) => setSettings((s) => ({ ...s, keepOriginals: v }))}
        />
      </Block>

      <div className="set-label">Reclaim space</div>
      <p className="set-lead tight">
        {"Optimize images already in your library and free their originals. This can\u2019t be undone; saves stay in place, just at a smaller size."}
      </p>
      <div className="set-actions">
        <button className="btn btn-line" onClick={reclaim} disabled={busy || !!settings.reclaimed}>
          {busy ? 'Reclaiming\u2026' : 'Reclaim space'}
        </button>
        {settings.reclaimed && (
          <span className="set-hint inline">
            Reclaimed {formatMB(settings.reclaimed.mb)} across{' '}
            {settings.reclaimed.count.toLocaleString()} images.
          </span>
        )}
      </div>
    </Pane>
  )
}

function Data({ settings, setSettings, stats, onErase, onRestore, onExportZip }) {
  const [confirm, setConfirm] = useState(false)
  const [snapOpen, setSnapOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 3200)
    return () => clearTimeout(t)
  }, [confirm])

  const exportZip = async () => {
    if (busy || !onExportZip) return
    setBusy(true)
    setStatus('')
    try {
      const file = await onExportZip()
      setStatus(file ? `Saved ${file.split('/').pop()} to Downloads` : 'Saved to Downloads')
    } catch {
      setStatus('Export failed')
    }
    setBusy(false)
  }

  const snapshotNow = () => {
    const snap = { id: `snap_${Date.now()}`, at: Date.now(), size: formatMB(stats.total) }
    setSettings((s) => ({ ...s, snapshots: [snap, ...s.snapshots] }))
    setStatus('Snapshot created')
  }

  const restore = (snap) => {
    onRestore?.()
    setStatus(`Restored snapshot from ${formatSnapshotDate(snap.at)}`)
  }

  const remove = (id) =>
    setSettings((s) => ({ ...s, snapshots: s.snapshots.filter((x) => x.id !== id) }))

  return (
    <Pane title="Data">
      <div className="set-label">Auto-empty trash</div>
      <Select
        value={settings.autoEmptyTrash}
        options={TRASH_RETENTION}
        onChange={(v) => setSettings((s) => ({ ...s, autoEmptyTrash: v }))}
      />
      <p className="set-hint">
        Soft-deleted saves are permanently removed on launch once they exceed the retention period.
      </p>

      <div className="set-sep" />

      <p className="set-lead tight">
        {"Download your entire library — the Gather database plus every saved image and thumbnail — into a single .zip backup. You can restore later by replacing the contents of the app\u2019s data folder with this archive\u2019s contents."}
      </p>
      <div className="set-actions">
        <button className="btn btn-line" onClick={exportZip} disabled={busy}>
          <IconArchive size={16} />
          {busy ? 'Preparing\u2026' : 'Download library as zip'}
        </button>
      </div>

      <div className="set-sep" />

      <p className="set-lead tight">
        Gather saves daily snapshots of your library so you can restore if necessary.
      </p>
      <div className="set-actions">
        <button className="btn btn-line" onClick={snapshotNow}>
          <IconHistory size={16} />
          Snapshot now
        </button>
      </div>

      <button
        className={`snap-toggle ${snapOpen ? 'open' : ''}`}
        onClick={() => setSnapOpen((v) => !v)}
      >
        Available snapshots ({settings.snapshots.length})
        <IconChevronRight size={14} />
      </button>
      {snapOpen && (
        <div className="snap-list">
          {settings.snapshots.map((snap) => (
            <div className="snap-row" key={snap.id}>
              <b>{formatSnapshotDate(snap.at)}</b>
              <span className="snap-size">{snap.size}</span>
              <button className="btn btn-line sm" onClick={() => restore(snap)}>
                Restore
              </button>
              <button className="snap-del" title="Delete snapshot" onClick={() => remove(snap.id)}>
                <IconTrash size={15} />
              </button>
            </div>
          ))}
          {!settings.snapshots.length && <div className="snap-empty">No snapshots yet.</div>}
        </div>
      )}

      <div className="set-sep" />

      <p className="set-lead tight">
        Erase your entire library — every save, collection, and tag. The underlying image files are
        deleted from disk. This cannot be undone.
      </p>
      <div className="set-actions">
        <button
          className={`btn ${confirm ? 'btn-danger-fill' : 'btn-line danger'}`}
          onClick={() => {
            if (!confirm) {
              setConfirm(true)
              return
            }
            setConfirm(false)
            onErase?.()
            setStatus('Library erased \u2014 restore from a snapshot above')
          }}
        >
          <IconTrash size={15} />
          {confirm ? 'Click to confirm erase' : 'Erase library'}
        </button>
        {status && <span className="set-hint inline">{status}</span>}
      </div>
    </Pane>
  )
}

function About({ version }) {
  const [note, setNote] = useState(null)

  return (
    <Pane title="About">
      <div className="about-rows">
        <div className="about-row">
          <span>Version</span>
          <span className="about-val">v{version}</span>
        </div>
        <div className="about-row">
          <span>Privacy</span>
          <button className="link" onClick={() => setNote(note === 'policy' ? null : 'policy')}>
            View policy
          </button>
        </div>
        <div className="about-row">
          <span>Support</span>
          <button
            className="link"
            onClick={() => window.gather?.openExternal('mailto:support@gather.app')}
          >
            support@gather.app
          </button>
        </div>
        <div className="about-row">
          <span>Open source</span>
          <button className="link" onClick={() => setNote(note === 'credits' ? null : 'credits')}>
            View acknowledgments
          </button>
        </div>
      </div>
      {note === 'policy' && (
        <p className="about-note">
          Gather keeps your library on this Mac. Images, tags, and collections are never uploaded.
          If you sign in, only AI usage counters sync with your account. There is no analytics or
          third-party tracking in the app.
        </p>
      )}
      {note === 'credits' && (
        <p className="about-note">
          Gather is built with open source software, including Electron, React, Vite, and Node.js.
          Full license texts ship with the app in the Acknowledgments file.
        </p>
      )}
    </Pane>
  )
}
