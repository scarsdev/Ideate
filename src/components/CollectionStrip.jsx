import CollectionStack from './CollectionStack.jsx'
import { IconPlus } from './Icons.jsx'

export default function CollectionStrip({ collections, onOpen }) {
  return (
    <div className="strip no-scrollbar">
      <div className="strip-card">
        <div className="new-collection" style={{ width: '100%' }} title="New collection">
          <IconPlus size={18} />
        </div>
        <div className="strip-meta">
          <div className="strip-name">New collection</div>
        </div>
      </div>

      {collections.map((col) => (
        <div className="strip-card" key={col.id}>
          <div className="strip-preview" onClick={() => onOpen(col)}>
            <CollectionStack preview={col.preview} cover={col.cover} alt={col.name} />
          </div>
          <div className="strip-meta">
            <div className="strip-name">{col.name}</div>
            <div className="strip-saves">{col.saves} saves</div>
          </div>
        </div>
      ))}
    </div>
  )
}
