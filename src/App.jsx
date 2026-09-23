import { useEffect, useMemo, useRef, useState } from 'react'
import TopBar from './components/TopBar.jsx'
import LibraryView from './components/LibraryView.jsx'
import CollectionsView from './components/CollectionsView.jsx'
import PinterestView from './components/PinterestView.jsx'
import PinBoardDetail from './components/PinBoardDetail.jsx'
import CollectionDetail from './components/CollectionDetail.jsx'
import SpacesView from './components/SpacesView.jsx'
import BoardView from './components/BoardView.jsx'
import ItemDetail from './components/ItemDetail.jsx'
import AssignOverlay from './components/AssignOverlay.jsx'
import CategorizePanel from './components/CategorizePanel.jsx'
import ContextMenu from './components/ContextMenu.jsx'
import SettingsModal from './components/SettingsModal.jsx'
import CommandPalette from './components/CommandPalette.jsx'
import {
  IconCopy,
  IconDownload,
  IconExternal,
  IconEyeOff,
  IconFolder,
  IconPin,
  IconFolderOpen,
  IconTrash,
  IconUndo
} from './components/Icons.jsx'
import { copyImageToClipboard, itemUrl, sourceLabel, toPngDataUrl } from './lib/format.js'
import { libraryStats, loadSettings, saveSettings, tagStats } from './lib/settings.js'
import { mergeSyncedItems } from './lib/sync.js'
import { annotatePatch, nameCandidates, tagCandidates } from './lib/ai.js'
import { buildSeed } from './data/seed.js'

function sortItems(list, sort) {
  const l = [...list]
  const added = (i) => i.addedAt || i.createdAt || 0
  switch (sort) {
    case 'Oldest added':
    case 'Oldest':
      return l.sort((a, b) => added(a) - added(b))
    case 'Created newest':
      return l.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    case 'Created oldest':
      return l.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
    case 'Name':
      return l.sort((a, b) => a.title.localeCompare(b.title))
    case 'Most saves':
      return l.sort((a, b) => b.ratio - a.ratio)
    default:
      return l.sort((a, b) => added(b) - added(a))
  }
}

export default function App() {
  const seed = useMemo(() => buildSeed(), [])
  const [items, setItems] = useState(seed.items)
  const [collections, setCollections] = useState(seed.collections)
  const [boards, setBoards] = useState([])
  const [openBoard, setOpenBoard] = useState(null)

  const [view, setView] = useState('library')
  const [tab, setTab] = useState('All')
  const [cols, setCols] = useState(4)
  const [sort, setSort] = useState('Recently added')
  const [collectionsLayout, setCollectionsLayout] = useState('coverflow')
  const [cfActive, setCfActive] = useState(0)
  const [openCollection, setOpenCollection] = useState(null)
  const [openPinBoard, setOpenPinBoard] = useState(null)
  const [pinBoardMeta, setPinBoardMeta] = useState({ order: [], names: {}, hidden: [] })
  const [detail, setDetail] = useState(null)
  const [assign, setAssign] = useState(null)
  const [showDetails, setShowDetails] = useState(true)
  const [assignments, setAssignments] = useState({})
  const [drag, setDrag] = useState(null)
  const [menu, setMenu] = useState(null)
  const [panelPinned, setPanelPinned] = useState(false)
  const [settings, setSettings] = useState(loadSettings)
  const [settingsSection, setSettingsSection] = useState(null)
  const [palette, setPalette] = useState(false)
  const [systemDark, setSystemDark] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)')?.matches ?? false
  )
  const [catPosition, setCatPosition] = useState(() => {
    try {
      return localStorage.getItem('gather.catPosition') || 'right'
    } catch {
      return 'right'
    }
  })

  useEffect(() => {
    saveSettings(settings)
  }, [settings])

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mq) return
    const fn = (e) => setSystemDark(e.matches)
    mq.addEventListener('change', fn)
    return () => mq.removeEventListener('change', fn)
  }, [])

  useEffect(() => {
    const sync = window.gather?.sync
    if (!sync) return
    let live = true
    sync.snapshot?.().then((snap) => {
      if (!live) return
      if (snap?.collections?.length) setCollections(snap.collections)
      if (Array.isArray(snap?.boards)) setBoards(snap.boards)
      if (snap?.pinBoards) setPinBoardMeta(snap.pinBoards)
      if (snap?.rows?.length) setItems((prev) => mergeSyncedItems(prev, snap.rows))
    })
    const off = sync.onItem?.((row) => {
      setItems((prev) => mergeSyncedItems(prev, [row]))
    })
    return () => {
      live = false
      off?.()
    }
  }, [])

  useEffect(() => {
    const sync = window.gather?.sync
    if (!sync?.setSourceEnabled) return
    sync.setSourceEnabled('bookmark', settings.syncBookmarks)
    sync.setSourceEnabled('instagram_save', settings.syncInstagram)
    sync.setSourceEnabled('x_bookmark', settings.syncX)
  }, [settings.syncBookmarks, settings.syncInstagram, settings.syncX])

  useEffect(() => {
    try {
      localStorage.setItem('gather.catPosition', catPosition)
    } catch {
      /* ignore */
    }
  }, [catPosition])

  useEffect(() => {
    const sc = settings.captureShortcut
    if (!sc?.key) return
    const accel = [
      sc.meta && 'CommandOrControl',
      sc.ctrl && 'Control',
      sc.alt && 'Alt',
      sc.shift && 'Shift',
      sc.key.length === 1 ? sc.key.toUpperCase() : sc.key
    ]
      .filter(Boolean)
      .join('+')
    window.gather?.capture
      ?.configure?.({
        shortcut: accel,
        folder: settings.dropFolder || '',
        mode: settings.captureMode || 'region'
      })
      ?.catch?.(() => {})
  }, [settings.captureShortcut, settings.dropFolder, settings.captureMode])

  const tagAllExisting = async () => {
    const pending = items.filter((i) => i.synced && !i.aiTagged && i.syncSource !== 'pinterest_save')
    if (!pending.length) return 0
    const entries = pending.map((i) => [i.id, annotatePatch(i, { tags: true, title: true })])
    const res = await window.gather?.sync?.annotateBulk?.(entries)
    const map = new Map(entries)
    setItems((prev) => prev.map((i) => (map.has(i.id) ? { ...i, ...map.get(i.id), aiTagged: true } : i)))
    return res?.count ?? entries.length
  }

  const tagJobRef = useRef(null)

  const tagAllWithJev = async (onProgress) => {
    const ai = window.gather?.ai
    if (!ai?.evaluate) return null
    const status = await ai.status?.()
    if (!status?.hasKey) return null
    const pending = items.filter((i) => i.synced && !i.jevTagged && i.syncSource !== 'pinterest_save')
    if (!pending.length) return 0
    const job = { cancelled: false }
    tagJobRef.current = job
    let done = 0
    try {
      const BATCH = 40
      for (let off = 0; off < pending.length; off += BATCH) {
        if (job.cancelled) break
        const batch = pending.slice(off, off + BATCH)
        const stateItems = []
        const questions = {}
        const plan = []
        for (const item of batch) {
          const text = String(item.text || item.title || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 500)
          if (!text) continue
          const k = stateItems.length
          stateItems.push({ k, source: item.source, author: item.author || '', text })
          plan.push({ item, k })
          const names = nameCandidates(item)
          if (names.length >= 2) {
            questions[`name_${k}`] = {
              type: 'choice',
              instructions: `Choose the option that works best as a short, specific name for the saved post at items[${k}] in the state.`,
              criteria: Object.fromEntries(names.map((n) => [n, null]))
            }
          }
          const tags = tagCandidates(item)
          if (tags.length >= 2) {
            questions[`tags_${k}`] = {
              type: 'choice',
              instructions: `Choose the keyword that best captures the topic of the saved post at items[${k}] in the state. Pick "none" when none of the keywords fit.`,
              criteria: {
                ...Object.fromEntries(tags.map((t) => [t, null])),
                none: 'None of the listed keywords fit'
              }
            }
          }
        }
        if (plan.length) {
          const res = await ai.evaluate({ state: { items: stateItems }, questions })
          if (res?.ok) {
            const entries = []
            for (const { item, k } of plan) {
              const patch = { jevTagged: true, aiTagged: true }
              const name = res.answers[`name_${k}`]
              if (name?.type === 'choice' && name.choice && name.choice !== item.title) {
                patch.title = name.choice
              }
              const tag = res.answers[`tags_${k}`]
              if (tag?.type === 'choice' && tag.choice && tag.choice !== 'none') {
                const srcTag =
                  item.syncSource === 'instagram_save'
                    ? 'instagram'
                    : item.syncSource === 'x_bookmark'
                      ? 'x'
                      : ''
                patch.aiTags = [
                  ...new Set([tag.choice, ...tagCandidates(item, 3), srcTag].filter(Boolean))
                ].slice(0, 3)
              }
              entries.push([item.id, patch])
            }
            if (entries.length) {
              await window.gather?.sync?.annotateBulk?.(entries)
              const map = new Map(entries)
              setItems((prev) => prev.map((i) => (map.has(i.id) ? { ...i, ...map.get(i.id) } : i)))
            }
          } else if (res?.error === 'invalid-key') {
            break
          }
        }
        done += batch.length
        onProgress?.(done, pending.length)
      }
    } finally {
      tagJobRef.current = null
    }
    return done
  }

  const tagAllWithDeepSeek = async (onProgress) => {
    const ai = window.gather?.ai
    if (!ai?.deepseek) return null
    const status = await ai.status?.()
    if (!status?.hasDeepseek) return null
    const pending = items.filter((i) => i.synced && !i.deepseekTagged && i.syncSource !== 'pinterest_save')
    if (!pending.length) return 0
    const job = { cancelled: false }
    tagJobRef.current = job
    let done = 0
    try {
      const BATCH = 25
      for (let off = 0; off < pending.length; off += BATCH) {
        if (job.cancelled) break
        const batch = pending.slice(off, off + BATCH)
        const rows = []
        const plan = []
        for (const item of batch) {
          const text = String(item.text || item.title || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 600)
          if (!text) continue
          const k = rows.length
          plan.push({ item, k })
          rows.push(`[${k}] (${item.source}${item.author ? `, ${item.author}` : ''}): ${text}`)
        }
        if (plan.length) {
          const user = [
            'For each saved social post below, produce:',
            '- "name": a short, specific, human-readable name (max 8 words)',
            '- "tags": 2-3 lowercase topical keywords',
            'Reply with JSON only, mapping each item index to {"name": string, "tags": string[]}.',
            '',
            'Items:',
            ...rows
          ].join('\n')
          const res = await ai.deepseek({
            system: 'You label saved social-media posts for a personal reference library.',
            user
          })
          if (res?.ok) {
            let parsed = null
            try {
              parsed = JSON.parse(String(res.text || '').replace(/^```(?:json)?\s*|\s*```$/g, ''))
            } catch {
              parsed = null
            }
            if (parsed && typeof parsed === 'object') {
              const entries = []
              for (const { item, k } of plan) {
                const out = parsed[String(k)] || parsed[k]
                if (!out || typeof out !== 'object') continue
                const patch = { deepseekTagged: true, aiTagged: true }
                const name = String(out.name || '')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, 64)
                if (name) patch.title = name
                if (Array.isArray(out.tags)) {
                  const srcTag =
                    item.syncSource === 'instagram_save'
                      ? 'instagram'
                      : item.syncSource === 'x_bookmark'
                        ? 'x'
                        : ''
                  const tags = [
                    ...new Set([
                      ...out.tags
                        .map((t) =>
                          String(t)
                            .toLowerCase()
                            .replace(/[^a-z0-9 -]/g, '')
                            .trim()
                        )
                        .filter(Boolean),
                      srcTag
                    ].filter(Boolean))
                  ].slice(0, 4)
                  if (tags.length) patch.aiTags = tags
                }
                entries.push([item.id, patch])
              }
              if (entries.length) {
                await window.gather?.sync?.annotateBulk?.(entries)
                const map = new Map(entries)
                setItems((prev) => prev.map((i) => (map.has(i.id) ? { ...i, ...map.get(i.id) } : i)))
              }
            }
          } else if (res?.error === 'invalid-key') {
            break
          }
        }
        done += batch.length
        onProgress?.(done, pending.length)
      }
    } finally {
      tagJobRef.current = null
    }
    return done
  }

  const runTagAll = async (onProgress) => {
    const ai = window.gather?.ai
    const status = (await ai?.status?.()) || {}
    const prefer =
      settings.aiEngine === 'deepseek'
        ? ['deepseek', 'jev']
        : settings.aiEngine === 'jev'
          ? ['jev', 'deepseek']
          : status.hasKey
            ? ['jev', 'deepseek']
            : ['deepseek', 'jev']
    for (const engine of prefer) {
      if (engine === 'jev' && status.hasKey) {
        const n = await tagAllWithJev(onProgress)
        if (n !== null) return n
      }
      if (engine === 'deepseek' && status.hasDeepseek) {
        const n = await tagAllWithDeepSeek(onProgress)
        if (n !== null) return n
      }
    }
    return tagAllExisting()
  }

  const cancelTagAll = () => {
    if (tagJobRef.current) tagJobRef.current.cancelled = true
  }

  const catJobRef = useRef(null)

  const categorizeAll = async (onProgress) => {
    const ai = window.gather?.ai
    const status = (await ai?.status?.()) || {}
    const targets = (collections || []).filter((c) => c?.id && c?.name)
    if (!targets.length) return 0
    const pending = items.filter(
      (i) => i.synced && !i.collectionId && !i.hidden && i.syncSource !== 'pinterest_save'
    )
    if (!pending.length) return 0
    const job = { cancelled: false }
    catJobRef.current = job
    const total = pending.length
    let done = 0

    const applyEntries = async (entries) => {
      if (!entries.length) return
      await window.gather?.sync?.categorizeBulk?.(entries)
      const map = new Map(entries)
      setItems((prev) =>
        prev.map((i) =>
          map.has(i.id) ? { ...i, collectionId: map.get(i.id), status: 'categorized' } : i
        )
      )
    }

    const nameToId = new Map(targets.map((c) => [c.name.toLowerCase(), c.id]))
    const withText = []
    const photos = []
    for (const item of pending) {
      const text = String(item.text || '')
        .replace(/\s+/g, ' ')
        .trim()
      if (text.length >= 40) withText.push(item)
      else if (item.thumb) photos.push(item)
    }

    try {
      if (status.hasKey && withText.length) {
        const options = Object.fromEntries(targets.map((c) => [c.name, null]))
        const BATCH = 40
        for (let off = 0; off < withText.length && !job.cancelled; off += BATCH) {
          const batch = withText.slice(off, off + BATCH)
          const stateItems = []
          const questions = {}
          const plan = []
          for (const item of batch) {
            const k = stateItems.length
            stateItems.push({
              k,
              source: item.source,
              author: item.author || '',
              text: String(item.text || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 400)
            })
            plan.push({ item, k })
            questions[`c_${k}`] = {
              type: 'choice',
              instructions: `Choose the single collection from the list that best fits the saved post at items[${k}] in the state. Pick "none" only when nothing fits.`,
              criteria: { ...options, none: 'No collection fits' }
            }
          }
          const res = await ai.evaluate({ state: { items: stateItems }, questions })
          if (res?.ok) {
            const entries = []
            for (const { item, k } of plan) {
              const ans = res.answers[`c_${k}`]
              if (ans?.type !== 'choice' || !ans.choice || ans.choice === 'none') continue
              if ((ans.confidence ?? 0) < 0.45) continue
              const cid = nameToId.get(String(ans.choice).toLowerCase())
              if (cid) entries.push([item.id, cid])
            }
            await applyEntries(entries)
          } else if (res?.error === 'invalid-key') {
            break
          }
          done += batch.length
          onProgress?.(done, total)
        }
      } else {
        done += withText.length
        onProgress?.(done, total)
      }

      if (status.hasDeepseek && photos.length) {
        const VB = 4
        const names = targets.map((c) => `"${c.name}"`).join(', ')
        const prompt = [
          "You are filing saved photos into a personal library's collections.",
          `The collections are: ${names}.`,
          'For each numbered image, choose the collection that best fits it, or none.',
          'Reply with JSON only, in this shape: {"items":[{"i":1,"collection":"<exact collection name or none>","confidence":0.0}]}'
        ].join(' ')
        const batches = []
        for (let off = 0; off < photos.length; off += VB) batches.push(photos.slice(off, off + VB))
        let cursor = 0
        const worker = async () => {
          while (cursor < batches.length && !job.cancelled) {
            const batch = batches[cursor++]
            const res = await ai.vision({ urls: batch.map((i) => i.thumb), prompt })
            if (res?.ok) {
              let parsed = null
              try {
                parsed = JSON.parse(String(res.text || '').replace(/^```(?:json)?\s*|\s*```$/g, ''))
              } catch {
                parsed = null
              }
              const arr = Array.isArray(parsed)
                ? parsed
                : Array.isArray(parsed?.items)
                  ? parsed.items
                  : []
              const entries = []
              for (const row of arr) {
                const idx = Number(row?.i) - 1
                const item = batch[idx]
                if (!item) continue
                const collection = String(row?.collection || '')
                if (!collection || collection.toLowerCase() === 'none') continue
                if ((Number(row?.confidence) || 0) < 0.35) continue
                const cid = nameToId.get(collection.toLowerCase())
                if (cid) entries.push([item.id, cid])
              }
              await applyEntries(entries)
            }
            done += batch.length
            onProgress?.(done, total)
          }
        }
        await Promise.all([worker(), worker(), worker()])
      } else {
        done += photos.length
        onProgress?.(done, total)
      }
    } finally {
      catJobRef.current = null
    }
    return done
  }

  const cancelCategorize = () => {
    if (catJobRef.current) catJobRef.current.cancelled = true
  }

  useEffect(() => {
    if (!settings.aiAutoTag && !settings.aiAutoName) return
    const pending = items.filter((i) => i.synced && !i.aiTagged && i.syncSource !== 'pinterest_save')
    if (!pending.length) return
    const batch = pending.slice(0, 60)
    const entries = batch.map((i) => [
      i.id,
      annotatePatch(i, { tags: settings.aiAutoTag, title: settings.aiAutoName })
    ])
    window.gather?.sync?.annotateBulk?.(entries)
    const map = new Map(entries)
    setItems((prev) => prev.map((i) => (map.has(i.id) ? { ...i, ...map.get(i.id), aiTagged: true } : i)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, settings.aiAutoTag, settings.aiAutoName])

  const itemsById = useMemo(() => {
    const m = {}
    const merged = items.map((it) =>
      assignments[it.id] ? { ...it, collectionId: assignments[it.id] } : it
    )
    merged.forEach((it) => (m[it.id] = it))
    return m
  }, [items, assignments])

  const collectionsWithPreview = useMemo(
    () =>
      collections.map((c) => {
        const visible = Object.values(itemsById).filter((i) => i.collectionId === c.id && !i.hidden)
        const withThumb = visible.filter((i) => i.thumb)
        const front = visible.reduce((best, i) => (!best || i.createdAt > best.createdAt ? i : best), null)
        return {
          ...c,
          itemIds: visible.map((i) => i.id),
          saves: visible.length,
          preview: withThumb.slice(0, 4).map((i) => i.thumb),
          front
        }
      }),
    [collections, itemsById]
  )

  const isUnsorted = (i) => (i.status ? i.status === 'inbox' : !!i.unsorted) && !assignments[i.id]

  const libraryItems = useMemo(() => {
    const all = Object.values(itemsById)
    let list = all.filter((i) => !i.hidden && i.syncSource !== 'pinterest_save')
    if (tab === 'Saved') list = list.filter((i) => i.saved)
    else if (tab === 'Unsorted') list = list.filter(isUnsorted)
    else if (tab === 'Trash') list = all.filter((i) => i.hidden)
    return sortItems(list, sort)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsById, tab, sort, assignments])

  const collectionItems = useMemo(() => {
    if (!openCollection) return []
    const list = Object.values(itemsById)
      .filter((i) => i.collectionId === openCollection.id && !i.hidden)
      .map((i) => ({ ...i, tagLabel: openCollection.name }))
    return sortItems(list, sort)
  }, [itemsById, openCollection, sort])

  const pinBoards = useMemo(() => {
    const hidden = new Set(pinBoardMeta.hidden || [])
    const map = new Map()
    for (const i of Object.values(itemsById)) {
      if (i.hidden || i.syncSource !== 'pinterest_save') continue
      const key = i.boardUrl || i.board || 'Unsorted'
      if (hidden.has(key)) continue
      let b = map.get(key)
      if (!b) {
        b = { id: key, key, name: i.board || 'Unsorted', items: [] }
        map.set(key, b)
      }
      b.items.push(i)
    }
    const list = [...map.values()].map((b) => ({
      ...b,
      name: pinBoardMeta.names?.[b.key] || b.name,
      saves: b.items.length,
      preview: b.items.filter((i) => i.thumb).slice(0, 4).map((i) => i.thumb)
    }))
    const order = pinBoardMeta.order || []
    list.sort((a, b) => {
      const ia = order.indexOf(a.key)
      const ib = order.indexOf(b.key)
      if (ia !== -1 || ib !== -1) {
        if (ia === -1) return 1
        if (ib === -1) return -1
        return ia - ib
      }
      return b.saves - a.saves || a.name.localeCompare(b.name)
    })
    return list
  }, [itemsById, pinBoardMeta])

  const pinItems = useMemo(() => {
    const list = Object.values(itemsById).filter(
      (i) => i.syncSource === 'pinterest_save' && !i.hidden
    )
    return sortItems(list, sort)
  }, [itemsById, sort])

  const pinBoardItems = useMemo(() => {
    if (!openPinBoard) return []
    const list = Object.values(itemsById)
      .filter(
        (i) =>
          i.syncSource === 'pinterest_save' &&
          (i.boardUrl || i.board || 'Unsorted') === openPinBoard.key &&
          !i.hidden
      )
      .map((i) => ({ ...i, tagLabel: openPinBoard.name }))
    return sortItems(list, sort)
  }, [itemsById, openPinBoard, sort])

  const activeList = openPinBoard ? pinBoardItems : openCollection ? collectionItems : libraryItems
  const activeIds = useMemo(() => activeList.map((i) => i.id), [activeList])

  const unsortedItems = useMemo(
    () =>
      Object.values(itemsById).filter(
        (i) => !i.hidden && i.syncSource !== 'pinterest_save' && isUnsorted(i)
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsById, assignments]
  )
  const unsortedIds = useMemo(() => unsortedItems.map((i) => i.id), [unsortedItems])

  const paletteItems = useMemo(
    () => items.filter((i) => i.syncSource !== 'pinterest_save'),
    [items]
  )

  const stats = useMemo(() => ({ ...libraryStats(items), count: items.length }), [items])
  const tags = useMemo(() => tagStats(items), [items])
  const activeLibrary =
    settings.libraries.find((l) => l.id === settings.activeLibrary) || settings.libraries[0]

  const detailItem = detail ? itemsById[detail.ids[detail.index]] : null
  const assignItem = assign ? itemsById[assign.ids[assign.index]] : null

  const openItem = (id) => {
    setDetail({ ids: activeIds, index: Math.max(0, activeIds.indexOf(id)) })
  }

  const moveDetail = (dir) => {
    setDetail((d) => {
      if (!d) return d
      const next = d.index + dir
      if (next < 0 || next >= d.ids.length) return d
      return { ...d, index: next }
    })
  }

  const openAssign = (id) => {
    setAssign({ ids: activeIds, index: Math.max(0, activeIds.indexOf(id)) })
  }

  const openFocusedSort = () => {
    if (!unsortedIds.length) return
    setAssign({ ids: unsortedIds, index: 0 })
  }

  const deleteAssignItem = () => {
    const a = assignRef.current
    if (!a) return
    const item = itemsById[a.ids[a.index]]
    if (!item) return
    window.gather?.sync?.remove?.(item.id)
    setItems((prev) => prev.filter((i) => i.id !== item.id))
    setAssign((p) => {
      if (!p) return p
      const ids = p.ids.filter((id) => id !== item.id)
      if (!ids.length) return null
      return { ...p, ids, index: Math.min(p.index, ids.length - 1) }
    })
  }

  const moveAssign = (dir) => {
    setAssign((a) => {
      if (!a) return a
      const next = a.index + dir
      if (next < 0 || next >= a.ids.length) return null
      return { ...a, index: next }
    })
  }

  const assignTo = (collectionId) => {
    const a = assignRef.current
    if (!a) return
    const item = itemsById[a.ids[a.index]]
    if (!item) return
    setAssignments((prev) => ({ ...prev, [item.id]: collectionId }))
    if (item.synced) {
      window.gather?.sync?.categorize?.(item.id, collectionId)
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, status: 'categorized' } : i))
      )
    }
    setAssign((p) =>
      !p ? p : p.index + 1 >= p.ids.length ? null : { ...p, index: p.index + 1 }
    )
  }

  const changeView = (v) => {
    setView(v)
    if (v !== 'collections') setOpenCollection(null)
    if (v !== 'spaces') setOpenBoard(null)
    if (v !== 'pinterest') setOpenPinBoard(null)
  }
  const openCollectionFrom = (col) => {
    setView('collections')
    setOpenCollection(col)
  }

  const openPinBoardFrom = (b) => {
    setView('pinterest')
    setOpenPinBoard(b)
  }

  const movePinToBoard = (id, board) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id ? { ...i, board: board.name, boardUrl: board.key } : i
      )
    )
    window.gather?.sync?.annotate?.(id, { board: board.name, boardUrl: board.key })
  }

  const renamePinBoard = (key, name) => {
    setPinBoardMeta((m) => ({ ...m, names: { ...(m.names || {}), [key]: name } }))
    window.gather?.sync?.pinBoards?.set?.({ names: { [key]: name } })
    setOpenPinBoard((b) => (b && b.key === key ? { ...b, name } : b))
  }

  const deletePinBoard = (key) => {
    setPinBoardMeta((m) => ({ ...m, hidden: [...new Set([...(m.hidden || []), key])] }))
    window.gather?.sync?.pinBoards?.set?.({ hidden: [key] })
    setOpenPinBoard((b) => (b && b.key === key ? null : b))
  }

  const reorderPinBoards = (fromKey, toKey) => {
    setPinBoardMeta((m) => {
      const ids = pinBoards.map((b) => b.key)
      const from = ids.indexOf(fromKey)
      const to = ids.indexOf(toKey)
      if (from < 0 || to < 0) return m
      const next = [...ids]
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      window.gather?.sync?.pinBoards?.set?.({ order: next })
      return { ...m, order: next }
    })
  }

  const createBoard = async () => {
    const res = await window.gather?.boards?.create?.('Untitled board')
    if (!res?.board) return
    setBoards((prev) => [...prev, res.board])
    setOpenBoard(res.board.id)
  }

  const renameBoard = async (id, name) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, name } : b)))
    await window.gather?.boards?.rename?.(id, name)
  }

  const deleteBoard = async (id) => {
    setBoards((prev) => prev.filter((b) => b.id !== id))
    if (openBoard === id) setOpenBoard(null)
    await window.gather?.boards?.remove?.(id)
  }

  const saveBoardItems = (id, boardItems) => {
    setBoards((prev) => prev.map((b) => (b.id === id ? { ...b, items: boardItems } : b)))
    window.gather?.boards?.save?.(id, boardItems)
  }

  const activeBoard = useMemo(() => boards.find((b) => b.id === openBoard) || null, [boards, openBoard])

  const boardsForItem = useMemo(() => {
    if (!detail) return []
    const item = itemsById[detail.ids[detail.index]]
    if (!item) return []
    return boards
      .filter((b) => b.items.some((it) => it.type === 'image' && it.data?.itemId === item.id))
      .map((b) => ({ id: b.id, name: b.name }))
  }, [boards, detail, itemsById])

  const openBoardFrom = (id) => {
    setDetail(null)
    setView('spaces')
    setOpenBoard(id)
  }

  const reorderBoards = (dragId, overId) => {
    setBoards((prev) => {
      const next = [...prev]
      const from = next.findIndex((b) => b.id === dragId)
      const to = next.findIndex((b) => b.id === overId)
      if (from < 0 || to < 0) return prev
      const [moved] = next.splice(from, 1)
      next.splice(to, 0, moved)
      next.forEach((b, i) => (b.order = i))
      window.gather?.boards?.reorder?.(next.map((b) => b.id))
      return next
    })
  }

  const runCommand = (id) => {
    if (id === 'library' || id === 'collections' || id === 'spaces' || id === 'pinterest')
      changeView(id)
    else if (id === 'new-space') createBoard()
    else if (id === 'settings') setSettingsSection('account')
    else if (id === 'theme') setSettings((s) => ({ ...s, theme: s.theme === 'dark' ? 'light' : 'dark' }))
    else if (id === 'tag-all') tagAllExisting()
  }

  const onSearch = () => setPalette(true)

  const dragRef = useRef(null)

  const collectionAt = (x, y) => {
    const el = document.elementFromPoint(x, y)
    const row = el && el.closest ? el.closest('[data-collection-id]') : null
    return row ? row.getAttribute('data-collection-id') : null
  }

  const startDrag = (itemId, e) => {
    const d = { itemId, x: e.clientX, y: e.clientY, over: collectionAt(e.clientX, e.clientY) }
    dragRef.current = d
    setDrag(d)
  }

  const moveDrag = (e) => {
    const cur = dragRef.current
    if (!cur) return
    const d = { ...cur, x: e.clientX, y: e.clientY, over: collectionAt(e.clientX, e.clientY) }
    dragRef.current = d
    setDrag(d)
  }

  const endDrag = (e) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) return
    const collectionId = collectionAt(e.clientX, e.clientY)
    if (collectionId) setAssignments((prev) => ({ ...prev, [d.itemId]: collectionId }))
  }

  const dragProps = {
    draggingId: drag?.itemId,
    onDragStart: startDrag,
    onDragMove: moveDrag,
    onDragEnd: endDrag
  }

  const draggedItem = drag ? itemsById[drag.itemId] : null

  const menuItem = menu ? itemsById[menu.itemId] : null
  const openMenu = (itemId, e) => setMenu({ itemId, x: e.clientX, y: e.clientY })

  const hideItem = (id, hidden) => {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, hidden } : i)))
    setDetail((d) => (d && d.ids[d.index] === id ? null : d))
  }

  const deleteItem = (id) => {
    setItems((prev) => {
      const item = prev.find((i) => i.id === id)
      if (item?.synced) window.gather?.sync?.remove?.(id)
      return prev.filter((i) => i.id !== id)
    })
    setDetail((d) => (d && d.ids[d.index] === id ? null : d))
  }

  const saveToLibrary = async (item) => {
    const png = await toPngDataUrl(item.thumbTall || item.thumb)
    await window.gather?.saveFile(`${item.id}.png`, png, true)
  }

  const downloadItem = async (item) => {
    const png = await toPngDataUrl(item.thumbTall || item.thumb)
    await window.gather?.downloadFile(`${item.id}.png`, png)
  }

  const copyItem = async (item) => {
    await copyImageToClipboard(item.thumbTall || item.thumb)
  }

  const openSettings = (section = 'account') => {
    setMenu(null)
    setSettingsSection(section)
  }

  const deleteTag = (name) => {
    setItems((prev) =>
      prev.map((i) => (i.tags.includes(name) ? { ...i, tags: i.tags.filter((t) => t !== name) } : i))
    )
  }

  const eraseLibrary = () => {
    setItems([])
    setAssignments({})
    setDetail(null)
    setAssign(null)
    window.gather?.sync?.clear?.()
  }

  const restoreLibrary = async () => {
    const snap = await window.gather?.sync?.snapshot?.()
    setItems(snap?.rows?.length ? mergeSyncedItems([], snap.rows) : [])
    setAssignments({})
    setDetail(null)
    setAssign(null)
  }

  const exportZip = async () => {
    if (!window.gather?.exportZip) return ''
    const payload = JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        activeLibrary: settings.activeLibrary,
        collections,
        items
      },
      null,
      2
    )
    return window.gather.exportZip({
      name: 'gather-library-backup',
      files: [{ name: 'library.json', text: payload }]
    })
  }

  const menuItems = useMemo(() => {
    if (!menuItem) return []
    const id = menuItem.id
    const isPin = menuItem.syncSource === 'pinterest_save'
    const submenu = collections.map((c) => ({
      label: c.name,
      thumb: c.cover,
      checked: menuItem.collectionId === c.id,
      onClick: () => setAssignments((prev) => ({ ...prev, [id]: c.id }))
    }))
    const boardSubmenu = pinBoards
      .filter((b) => b.key !== (menuItem.boardUrl || menuItem.board))
      .map((b) => ({
        label: b.name,
        thumb: b.preview?.[0],
        checked: false,
        onClick: () => movePinToBoard(id, b)
      }))

    return [
      isPin
        ? { label: 'Move to board', icon: <IconPin size={15} />, submenu: boardSubmenu }
        : { label: 'Add to collection', icon: <IconFolder size={15} />, submenu },
      menuItem.hidden
        ? {
            label: 'Restore to library',
            icon: <IconUndo size={15} />,
            onClick: () => hideItem(id, false)
          }
        : {
            label: 'Hide from library',
            icon: <IconEyeOff size={15} />,
            onClick: () => hideItem(id, true)
          },
      { type: 'separator' },
      ...(menuItem.thumb
        ? [
            { label: 'Copy image', icon: <IconCopy size={15} />, onClick: () => copyItem(menuItem) },
            {
              label: 'Reveal in Finder',
              icon: <IconFolderOpen size={15} />,
              onClick: () => saveToLibrary(menuItem)
            },
            {
              label: 'Download',
              icon: <IconDownload size={15} />,
              onClick: () => downloadItem(menuItem)
            }
          ]
        : []),
      {
        label: `Open on ${sourceLabel(menuItem.source)}`,
        icon: <IconExternal size={15} />,
        onClick: () => window.gather?.openExternal(itemUrl(menuItem))
      },
      { type: 'separator' },
      {
        label: 'Delete',
        icon: <IconTrash size={15} />,
        danger: true,
        onClick: () => deleteItem(id)
      }
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuItem, collections, pinBoards])

  const detailRef = useRef(null)
  const assignRef = useRef(null)
  const settingsRef = useRef(null)
  const boardRef = useRef(null)
  detailRef.current = detail
  assignRef.current = assign
  settingsRef.current = settingsSection
  boardRef.current = openBoard

  useEffect(() => {
    const onKey = (e) => {
      if (e.metaKey && e.key === ',') {
        e.preventDefault()
        setSettingsSection((s) => (s ? null : 'account'))
        return
      }
      if (e.metaKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        onSearch()
        return
      }
      if (settingsRef.current) return
      if (boardRef.current) return
      const a = assignRef.current
      const d = detailRef.current

      if (a) {
        if (e.key === 'Escape') return setAssign(null)
        if (e.key === 'ArrowRight') return moveAssign(1)
        if (e.key === 'ArrowLeft') return moveAssign(-1)
        if (e.key === 'Delete' || e.key === 'Backspace') {
          e.preventDefault()
          return deleteAssignItem()
        }
        const n = parseInt(e.key, 10)
        if (n >= 1 && n <= collections.length) assignTo(collections[n - 1].id)
        return
      }

      if (d) {
        if (e.key === 'Escape') return setDetail(null)
        if (e.key === 'ArrowRight') return moveDetail(1)
        if (e.key === 'ArrowLeft') return moveDetail(-1)
        if (e.key.toLowerCase() === 'i') return setShowDetails((v) => !v)
        if (e.key.toLowerCase() === 'a') {
          const cur = itemsById[d.ids[d.index]]
          if (cur) openAssign(cur.id)
        }
        return
      }

      if (view === 'collections' && !openCollection && collectionsLayout === 'coverflow') {
        if (e.key === 'ArrowRight') setCfActive((i) => Math.min(collections.length - 1, i + 1))
        if (e.key === 'ArrowLeft') setCfActive((i) => Math.max(0, i - 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, openCollection, collectionsLayout, collections.length, itemsById, activeIds])

  const cfSeeded = useRef(false)
  useEffect(() => {
    if (cfSeeded.current || collections.length < 2) return
    cfSeeded.current = true
    setCfActive(Math.floor(collections.length / 2))
  }, [collections.length])

  const themeDark =
    settings.theme === 'dark' || (settings.theme === 'system' && systemDark)
  const dark = themeDark

  return (
    <div className={`app ${dark ? 'theme-dark' : ''}`}>
      <TopBar
        view={view}
        setView={changeView}
        onSearch={onSearch}
        onOpenSettings={openSettings}
        libraryName={activeLibrary?.name}
      />

      <div className="app-body">
        {view === 'library' && (
          <LibraryView
            items={libraryItems}
            collections={collectionsWithPreview}
            tab={tab}
            setTab={setTab}
            cols={cols}
            setCols={setCols}
            sort={sort}
            setSort={setSort}
            onOpenItem={openItem}
            onMenu={openMenu}
            onOpenCollection={openCollectionFrom}
            panelPinned={panelPinned}
            togglePanel={() => setPanelPinned((v) => !v)}
            focusCount={unsortedItems.length}
            onFocusedSort={openFocusedSort}
            {...dragProps}
          />
        )}

        {view === 'collections' &&
          (openCollection ? (
            <CollectionDetail
              collection={openCollection}
              items={collectionItems}
              cols={cols}
              setCols={setCols}
              sort={sort}
              setSort={setSort}
              onBack={() => setOpenCollection(null)}
              onOpenItem={openItem}
              onMenu={openMenu}
              {...dragProps}
            />
          ) : (
            <CollectionsView
              collections={collectionsWithPreview}
              layout={collectionsLayout}
              setLayout={setCollectionsLayout}
              onOpen={openCollectionFrom}
              active={cfActive}
              setActive={setCfActive}
              dark={dark}
            />
          ))}

        {view === 'pinterest' &&
          (openPinBoard ? (
            <PinBoardDetail
              board={openPinBoard}
              items={pinBoardItems}
              cols={cols}
              setCols={setCols}
              sort={sort}
              setSort={setSort}
              onBack={() => setOpenPinBoard(null)}
              onOpenItem={openItem}
              onMenu={openMenu}
              {...dragProps}
            />
          ) : (
            <PinterestView
              boards={pinBoards}
              items={pinItems}
              cols={cols}
              setCols={setCols}
              sort={sort}
              setSort={setSort}
              onOpen={openPinBoardFrom}
              onOpenItem={openItem}
              onMenu={openMenu}
              onRenameBoard={renamePinBoard}
              onDeleteBoard={deletePinBoard}
              onReorderBoards={reorderPinBoards}
              {...dragProps}
            />
          ))}

        {view === 'spaces' &&
          !activeBoard && (
            <SpacesView
              boards={boards}
              itemsById={itemsById}
              onOpen={(id) => setOpenBoard(id)}
              onCreate={createBoard}
              onRename={renameBoard}
              onDelete={deleteBoard}
              onReorder={reorderBoards}
            />
          )}
        {view === 'spaces' && activeBoard && (
          <BoardView
            key={activeBoard.id}
            board={activeBoard}
            items={items}
            itemsById={itemsById}
            onBack={() => setOpenBoard(null)}
            onRename={(name) => renameBoard(activeBoard.id, name)}
            onDelete={() => deleteBoard(activeBoard.id)}
            onSave={(boardItems) => saveBoardItems(activeBoard.id, boardItems)}
          />
        )}
      </div>

      {detailItem && (
        <ItemDetail
          item={detailItem}
          index={detail.index}
          total={detail.ids.length}
          collections={collections}
          dark={dark}
          showDetails={showDetails}
          setShowDetails={setShowDetails}
          onClose={() => setDetail(null)}
          onPrev={() => moveDetail(-1)}
          onNext={() => moveDetail(1)}
          onAssign={() => openAssign(detailItem.id)}
          boards={boardsForItem}
          onOpenBoard={openBoardFrom}
          aiPrompts={settings.aiPrompts}
          onSavePrompt={(id, text) => {
            window.gather?.sync?.annotate?.(id, { aiPrompt: text })
            setItems((prev) => prev.map((i) => (i.id === id ? { ...i, aiPrompt: text } : i)))
          }}
        />
      )}

      {assignItem && (
        <AssignOverlay
          item={assignItem}
          index={assign.index}
          total={assign.ids.length}
          collections={collections}
          assignedId={assignments[assignItem.id] || assignItem.collectionId}
          onAssign={assignTo}
          onSkip={() => moveAssign(1)}
          onDelete={deleteAssignItem}
          onClose={() => setAssign(null)}
        />
      )}

      {(drag || panelPinned) && !detailItem && !assignItem && (
        <CategorizePanel
          collections={collectionsWithPreview}
          position={catPosition}
          setPosition={setCatPosition}
          over={drag?.over}
          pinned={panelPinned}
          onClose={() => setPanelPinned(false)}
          onOpenCollection={openCollectionFrom}
        />
      )}

      {draggedItem && (
        <div className="drag-ghost" style={{ left: drag.x, top: drag.y }}>
          {draggedItem.thumb ? (
            <img src={draggedItem.thumb} alt="" />
          ) : (
            <div className="drag-ghost-text">{draggedItem.title}</div>
          )}
        </div>
      )}

      {menuItem && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          items={menuItems}
          onClose={() => setMenu(null)}
        />
      )}

        {palette && (
          <CommandPalette
            items={paletteItems}
            collections={collectionsWithPreview}
            boards={boards}
            aiVisualSearch={settings.aiVisualSearch}
            onClose={() => setPalette(false)}
            onOpenItem={(id) => {
              setView('library')
              setOpenCollection(null)
              setOpenBoard(null)
              setDetail({ ids: [id], index: 0 })
            }}
            onOpenCollection={(col) => openCollectionFrom(col)}
            onOpenBoard={(id) => {
              setView('spaces')
              setOpenBoard(id)
            }}
            onCommand={runCommand}
          />
        )}

      {settingsSection && (
        <SettingsModal
          section={settingsSection}
          setSection={setSettingsSection}
          onClose={() => setSettingsSection(null)}
          settings={settings}
          setSettings={setSettings}
          data={{
            stats,
            tags,
            itemCount: items.length,
            covers: collections.slice(0, 4).map((c) => c.cover),
            onDeleteTag: deleteTag,
            items,
            onTagAll: runTagAll,
            onCancelTagAll: cancelTagAll,
            onCategorizeAll: categorizeAll,
            onCancelCategorize: cancelCategorize,
            onErase: eraseLibrary,
            onRestore: restoreLibrary,
            onExportZip: exportZip
          }}
        />
      )}
    </div>
  )
}
