import Coverflow from './Coverflow.jsx'
import CollectionStack from './CollectionStack.jsx'
import { IconGrid } from './Icons.jsx'

export default function CollectionsView({
  collections,
  layout,
  setLayout,
  onOpen,
  active,
  setActive,
  dark
}) {
  if (layout === 'grid') {
    return (
      <>
        <div className="toolbar">
          <div className="tabs">
            <span className="tab active" style={{ cursor: 'default' }}>
              All collections
            </span>
          </div>
          <div className="toolbar-right">
            <button
              className="layout-btn"
              onClick={() => setLayout('coverflow')}
              title="Shelf view"
            >
              <IconGrid size={15} />
            </button>
          </div>
        </div>
        <div className="scroll" style={{ flex: 1, minHeight: 0 }}>
          <div className="collections-grid">
            {collections.map((col) => (
              <div className="collection-card" key={col.id} onClick={() => onOpen(col)}>
                <div className="collection-cover">
                  <CollectionStack preview={col.preview} cover={col.cover} alt={col.name} />
                </div>
                <div className="collection-meta">
                  <div className="collection-name">{col.name}</div>
                  <div className="collection-sub">{col.saves} saves</div>
                </div>
              </div>
            ))}          </div>
        </div>
      </>
    )
  }

  return (
    <Coverflow
      collections={collections}
      active={active}
      setActive={setActive}
      onOpen={onOpen}
      onLayout={() => setLayout('grid')}
      dark={dark}
    />
  )
}
