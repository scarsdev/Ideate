export default function CollectionStack({ preview, cover, alt = '' }) {
  if (!preview?.length) {
    return <img className="stack-fallback" src={cover} alt={alt} draggable={false} />
  }
  return (
    <div className="collection-stack">
      {preview.slice(0, 4).map((src, i) => (
        <div className={`stack-card stack-card-${i}`} key={i} style={{ zIndex: 10 - i }}>
          <img
            src={src}
            alt=""
            draggable={false}
            onError={(e) => {
              const card = e.currentTarget.closest('.stack-card')
              if (card) card.style.display = 'none'
            }}
          />
        </div>
      ))}
    </div>
  )
}
