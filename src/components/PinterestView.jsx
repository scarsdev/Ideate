import { useEffect, useRef, useState } from 'react'
import CollectionStack from './CollectionStack.jsx'
import SortButton from './SortButton.jsx'
import MasonryGrid from './MasonryGrid.jsx'
import ContextMenu from './ContextMenu.jsx'
import { IconPin } from './Icons.jsx'

const SORTS = [
  'Recently added',
  'Oldest added',
  'Created newest',
  'Created oldest',
  'Name',
  'Most saves',
  'Color'
]

function BoardTile({ board, onOpen, onRename, onDelete, onReorder }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(board.name)
  const [menu, setMenu] = useState(null)
  const inputRef = useRef(null)

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    setDraft(board.name)
  }, [board.name])

  const commit = () => {
    setEditing(false)
    const name = draft.trim()
    if (name && name !== board.name) onRename(board.key, name)
    else setDraft(board.name)
  }

  return (
    <div
      className="strip-card"
      draggable={!editing}
      onDragStart={(e) => {
        e.dataTransfer.setData('text/gather-pinboard', board.key)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const key = e.dataTransfer.getData('text/gather-pinboard')
        if (key && key !== board.key) onReorder(key, board.key)
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        setMenu({ x: e.clientX, y: e.clientY })
      }}
    >
      <div className="strip-preview" onClick={() => onOpen(board)}>
        <CollectionStack preview={board.preview} cover={board.cover} alt={board.name} />
      </div>
      <div className="strip-meta">
        {editing ? (
          <input
            ref={inputRef}
            className="space-name-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commit()
              if (e.key === 'Escape') {
                setDraft(board.name)
                setEditing(false)
              }
            }}
          />
        ) : (
          <div className="strip-name" onDoubleClick={() => setEditing(true)}>
            {board.name}
          </div>
        )}
        <div className="strip-saves">{board.saves} saves</div>
      </div>

      {menu && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={[
            { label: 'Rename board', onClick: () => setEditing(true) },
            { label: 'Delete board', danger: true, onClick: () => onDelete(board.key) }
          ]}
          onClose={() => setMenu(null)}
        />
      )}
    </div>
  )
}

export default function PinterestView({
  boards,
  items,
  cols,
  setCols,
  sort,
  setSort,
  onOpen,
  onOpenItem,
  onMenu,
  onRenameBoard,
  onDeleteBoard,
  onReorderBoards,
  draggingId,
  onDragStart,
  onDragMove,
  onDragEnd
}) {
  return (
    <>
      <div className="toolbar">
        <div className="tabs">
          <span className="tab active" style={{ cursor: 'default' }}>
            All pins
          </span>
        </div>
        <div className="toolbar-right">
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
        {boards.length > 0 && (
          <div className="strip no-scrollbar">
            {boards.map((b) => (
              <BoardTile
                key={b.key}
                board={b}
                onOpen={onOpen}
                onRename={onRenameBoard}
                onDelete={onDeleteBoard}
                onReorder={onReorderBoards}
              />
            ))}
          </div>
        )}

        {items.length ? (
          <MasonryGrid
            cols={cols}
            items={items}
            resetKey={`pins|${sort}|${cols}`}
            draggingId={draggingId}
            onOpen={onOpenItem}
            onMenu={onMenu}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />
        ) : (
          <div className="empty-state" style={{ height: 320 }}>
            <IconPin size={26} />
            <h3>No pins yet</h3>
            <span>Run “Import Pinterest” in the browser extension to pull in your boards.</span>
          </div>
        )}
      </div>
    </>
  )
}
