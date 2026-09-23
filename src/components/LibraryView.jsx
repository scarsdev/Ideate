import { IconColumns, IconFocus, IconFolder, IconGrid } from './Icons.jsx'
import SortButton from './SortButton.jsx'
import CollectionStrip from './CollectionStrip.jsx'
import MasonryGrid from './MasonryGrid.jsx'

const TABS = ['All', 'Saved', 'Unsorted', 'Trash']
const SORTS = [
  'Recently added',
  'Oldest added',
  'Created newest',
  'Created oldest',
  'Name',
  'Most saves',
  'Color'
]

export default function LibraryView({
  items,
  collections,
  tab,
  setTab,
  cols,
  setCols,
  sort,
  setSort,
  panelPinned,
  togglePanel,
  focusCount,
  onFocusedSort,
  draggingId,
  onOpenItem,
  onMenu,
  onOpenCollection,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="toolbar-right">
          <button
            className={`layout-btn ${panelPinned ? 'on' : ''}`}
            onClick={togglePanel}
            title="Collections panel"
          >
            <IconFolder size={15} />
          </button>
          <button className="layout-btn" title="Layout">
            <IconColumns size={15} />
          </button>
          <input
            className="density"
            type="range"
            min="2"
            max="6"
            step="1"
            value={cols}
            onChange={(e) => setCols(Number(e.target.value))}
          />
          <SortButton value={sort} options={SORTS} onChange={setSort} />
        </div>
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <CollectionStrip collections={collections} onOpen={onOpenCollection} />
        {items.length ? (
          <MasonryGrid
            cols={cols}
            items={items}
            resetKey={`${tab}|${sort}|${cols}`}
            draggingId={draggingId}
            onOpen={onOpenItem}
            onMenu={onMenu}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ) : (
          <div className="empty-state" style={{ height: 320 }}>
            <IconGrid size={26} />
            <h3>Nothing here yet</h3>
            <span>Drag, paste, or capture something to get started.</span>
          </div>
        )}
      </div>

      {focusCount > 0 && (
        <button className="focused-sort" onClick={onFocusedSort} title="Focused sort">
          <span className="fs-ic">
            <IconFocus size={17} />
          </span>
          Focused sort
          <span className="fs-count">{focusCount}</span>
        </button>
      )}
    </>
  )
}
