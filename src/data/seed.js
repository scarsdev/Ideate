import { makeThumb } from '../lib/thumbs.js'

export const COLLECTION_NAMES = [
  'AI work', 'UI/UX', 'Health', 'App Ideas', 'Movies', 'MoviesMusicGames',
  'Code Reads', 'Words', 'Arch/Design', 'Gifs', 'Images', 'SurfGame',
  'Crypto', 'Skills', 'Poltica', 'Tech Buys', 'Marketing', 'Biz'
]

export function buildSeed() {
  const collections = COLLECTION_NAMES.map((name, i) => ({
    id: `col_${i}`,
    name,
    createdAt: Date.now() - i * 86400000 * 9,
    itemIds: [],
    cover: makeThumb(`cover-${name}`, 1.6, name, i % 3 === 0 ? 'ui' : 'photo')
  }))

  return { items: [], collections, spaces: [] }
}
