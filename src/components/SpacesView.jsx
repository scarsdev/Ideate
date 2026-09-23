import { useEffect, useRef, useState } from 'react'
import CollectionStack from './CollectionStack.jsx'
import { IconPlus, IconTrash } from './Icons.jsx'
import { makeThumb } from '../lib/thumbs.js'
import { safeText } from '../lib/format.js'

function boardPreview(board, itemsById) {
  const thumbs = []
  for (const it of board.items) {
    if (it.type !== 'image') continue
    const src = itemsById[it.data?.itemId]
    if (src?.thumb) thumbs.push(src.thumb)
    if (thumbs.length >= 4) break
  }
  return thumbs
}

function BoardTile({ board, itemsById, onOpen, onRename, onDelete, onReorder }) {
  const [confirm, setConfirm] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(board.name)
  const inputRef = useRef(null)
  const preview = boardPreview(board, itemsById)
  const cover = makeThumb(`board-${board.id}-${safeText(board.name)}`, 1.6, safeText(board.name), 'ui')
  const count = board.items.length

  useEffect(() => {
    if (editing) inputRef.current?.select()
  }, [editing])

  useEffect(() => {
    if (!confirm) return
    const t = setTimeout(() => setConfirm(false), 2600)
    return () => clearTimeout(t)
  }, [confirm])

  const commit = () => {
    setEditing(false)
    const name = draft.trim()
    if (name && name !== board.name) onRename(board.id, name)
    else setDraft(board.name)
  }

  return (
    <div
      className="collection-card space-card"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData('text/gather-board', board.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        const id = e.dataTransfer.getData('text/gather-board')
        if (id && id !== board.id) onReorder(id, board.id)
      }}
    >
      <div className="collection-cover" onClick={() => onOpen(board.id)}>
        <CollectionStack preview={preview} cover={cover} alt={board.name} />
      </div>
      <div className="collection-meta space-meta">
        <div className="space-meta-main">
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
            <div
              className="collection-name"
              onDoubleClick={(e) => {
                e.stopPropagation()
                setEditing(true)
              }}
            >
              {board.name}
            </div>
          )}
          <div className="collection-sub">
            {count} {count === 1 ? 'item' : 'items'}
          </div>
        </div>
        <button
          className={`space-del ${confirm ? 'confirm' : ''}`}
          title={confirm ? 'Click again to delete' : 'Delete space'}
          onClick={(e) => {
            e.stopPropagation()
            if (!confirm) setConfirm(true)
            else onDelete(board.id)
          }}
        >
          {confirm ? <span>Confirm</span> : <IconTrash size={14} />}
        </button>
      </div>
    </div>
  )
}

export default function SpacesView({ boards, itemsById, onOpen, onCreate, onRename, onDelete, onReorder }) {
  return (
    <>
      <div className="spaces-toolbar">
        <span className="spaces-hint">Spaces are infinite canvases for arranging and editing images.</span>
      </div>
      <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
        <div className="collections-grid">
          <div className="space-new" onClick={onCreate}>
            <span className="plus">
              <IconPlus size={18} />
            </span>
            <span style={{ fontSize: 12.5 }}>New space</span>
          </div>
          {boards.map((board) => (
            <BoardTile
              key={board.id}
              board={board}
              itemsById={itemsById}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
              onReorder={onReorder}
            />
          ))}
        </div>
      </div>
    </>
  )
}
