import { IconChevronLeft, IconColumns, IconMore, IconPlus } from './Icons.jsx'
import SortButton from './SortButton.jsx'
import MasonryGrid from './MasonryGrid.jsx'

const SORTS = [
  'Recently added',
  'Oldest added',
  'Created newest',
  'Created oldest',
  'Name',
  'Most saves',
  'Color'
]

export default function CollectionDetail({
  collection,
  items,
  cols,
  setCols,
  sort,
  setSort,
  onBack,
  onOpenItem,
  onMenu,
  draggingId,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  return (
    <>
      <div className="breadcrumb">
        <button className="crumb-back" onClick={onBack} title="Back">
          <IconChevronLeft size={15} />
        </button>
        <span className="crumb-name">{collection.name}</span>
        <button className="icon-btn" style={{ width: 24, height: 24 }}>
          <IconMore size={15} />
        </button>

        <div className="toolbar-right" style={{ marginLeft: 'auto' }}>
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

      <div className="collection-header">
        <div className="collection-kicker">Inside this collection</div>
        <button className="collection-new-chip">
          <IconPlus size={12} />
          New collection
        </button>
      </div>

      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <MasonryGrid
          cols={cols}
          items={items}
          showTag
          resetKey={`${collection.id}|${sort}|${cols}`}
          draggingId={draggingId}
          onOpen={onOpenItem}
          onMenu={onMenu}
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
        />
      </div>
    </>
  )
}
