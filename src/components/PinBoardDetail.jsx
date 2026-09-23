import { IconChevronLeft } from './Icons.jsx'
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

export default function PinBoardDetail({
  board,
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
        <span className="crumb-name">{board.name}</span>
        <div className="toolbar-right" style={{ marginLeft: 'auto' }}>
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
        <MasonryGrid
          cols={cols}
          items={items}
          showTag
          resetKey={`${board.id}|${sort}|${cols}`}
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
