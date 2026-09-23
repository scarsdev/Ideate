import {
  IconAperture,
  IconBoard,
  IconChevronDown,
  IconClock,
  IconContrast,
  IconFolder,
  IconGear,
  IconPin,
  IconSearch
} from './Icons.jsx'

const SEGMENTS = [
  { id: 'library', label: 'Library', icon: null },
  { id: 'collections', label: 'Collections', icon: <IconFolder size={13} /> },
  { id: 'spaces', label: 'Spaces', icon: <IconBoard size={13} /> },
  { id: 'pinterest', label: 'Pinterest', icon: <IconPin size={13} /> }
]

export default function TopBar({ view, setView, onSearch, onOpenSettings, libraryName }) {
  return (
    <header className="topbar drag">
      <div className="topbar-left">
        <div className="app-badge">
          <IconAperture size={15} />
        </div>
        <button
          className="app-title no-drag"
          onClick={() => onOpenSettings?.('libraries')}
          title="Switch library"
        >
          {libraryName || 'Library'}
          <IconChevronDown size={11} />
        </button>
      </div>

      <div className="topbar-center no-drag">
        <div className="segmented">
          <button className="seg-search" onClick={onSearch} title="Search">
            <IconSearch size={15} />
          </button>
          {SEGMENTS.map((s) => (
            <button
              key={s.id}
              className={`seg ${view === s.id ? 'active' : ''}`}
              onClick={() => setView(s.id)}
            >
              {s.icon}
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="topbar-right">
        <button className="search-pill" onClick={onSearch}>
          <IconSearch size={14} />
          Search
          <span className="kbd">⌘K</span>
        </button>
        <button className="icon-btn" title="Appearance" onClick={() => onOpenSettings?.('appearance')}>
          <IconContrast size={16} />
        </button>
        <button className="icon-btn" title="History">
          <IconClock size={16} />
        </button>
        <button className="icon-btn" title="Settings" onClick={() => onOpenSettings?.('account')}>
          <IconGear size={16} />
        </button>
      </div>
    </header>
  )
}
