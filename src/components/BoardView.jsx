import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import BoardToolbar from './BoardToolbar.jsx'
import BoardInspector from './BoardInspector.jsx'
import BoardLibraryDrawer from './BoardLibraryDrawer.jsx'
import {
  IconChevronLeft,
  IconCopy,
  IconDownload,
  IconFit,
  IconLock,
  IconMinus,
  IconPlus,
  IconToBack,
  IconToFront,
  IconTrash,
  IconUnlock
} from './Icons.jsx'
import { copyImageToClipboard } from '../lib/format.js'
import {
  SHAPE_FILLS,
  SHAPE_STROKES,
  STICKY_COLORS,
  clamp,
  createItem,
  elbowPoints,
  frameContains,
  itemBounds,
  itemsBounds,
  pointInItem,
  rectsIntersect,
  rotatePoint,
  uid
} from '../lib/board.js'

const HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
const SNAP_ANGLE = 15
const zOf = (it) => (it.type === 'frame' ? (it.z || 0) - 1e6 : it.z || 0)

export default function BoardView({ board, items: library, itemsById, onBack, onRename, onDelete, onSave }) {
  const [items, setItems] = useState(() =>
    board.items.map((i) => ({ ...i, data: { ...(i.data || {}) } }))
  )
  const [sel, setSel] = useState([])
  const [tool, setTool] = useState('select')
  const [pan, setPan] = useState({ x: 140, y: 110 })
  const [zoom, setZoom] = useState(1)
  const [editing, setEditing] = useState(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [marquee, setMarquee] = useState(null)
  const [name, setName] = useState(board.name)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const rootRef = useRef(null)
  const modeRef = useRef(null)
  const historyRef = useRef({ past: [], future: [] })
  const clipboardRef = useRef([])
  const spaceRef = useRef(false)
  const saveTimer = useRef(null)
  const firstRun = useRef(true)

  const sorted = useMemo(() => [...items].sort((a, b) => zOf(a) - zOf(b)), [items])
  const selItems = useMemo(() => items.filter((i) => sel.includes(i.id)), [items, sel])
  const single = selItems.length === 1 ? selItems[0] : null

  useEffect(() => {
    clearTimeout(saveTimer.current)
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    saveTimer.current = setTimeout(() => onSave?.(items), 500)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items])

  const screenToWorld = useCallback(
    (clientX, clientY) => {
      const rect = rootRef.current.getBoundingClientRect()
      return {
        x: (clientX - rect.left - pan.x) / zoom,
        y: (clientY - rect.top - pan.y) / zoom
      }
    },
    [pan, zoom]
  )

  const pushHistory = useCallback(() => {
    const h = historyRef.current
    h.past.push(JSON.parse(JSON.stringify(items)))
    if (h.past.length > 80) h.past.shift()
    h.future = []
  }, [items])

  const mutate = useCallback(
    (fn, { history = true } = {}) => {
      if (history) pushHistory()
      setItems((prev) => fn(prev))
    },
    [pushHistory]
  )

  const undo = useCallback(() => {
    const h = historyRef.current
    const prev = h.past.pop()
    if (!prev) return
    h.future.push(JSON.parse(JSON.stringify(items)))
    setItems(prev)
  }, [items])

  const redo = useCallback(() => {
    const h = historyRef.current
    const next = h.future.pop()
    if (!next) return
    h.past.push(JSON.parse(JSON.stringify(items)))
    setItems(next)
  }, [items])

  const fit = useCallback(() => {
    const rect = rootRef.current?.getBoundingClientRect()
    if (!rect) return
    const b = itemsBounds(items)
    if (!b || b.w <= 0 || b.h <= 0) {
      setZoom(1)
      setPan({ x: rect.width / 2, y: rect.height / 2 })
      return
    }
    const pad = 90
    const z = clamp(Math.min((rect.width - pad * 2) / b.w, (rect.height - pad * 2) / b.h), 0.1, 2)
    setZoom(z)
    setPan({
      x: rect.width / 2 - (b.minX + b.w / 2) * z,
      y: rect.height / 2 - (b.minY + b.h / 2) * z
    })
  }, [items])

  useEffect(() => {
    const t = setTimeout(fit, 30)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const expandGroup = useCallback(
    (ids) => {
      const set = new Set(ids)
      for (const id of ids) {
        const it = items.find((i) => i.id === id)
        const gid = it?.data?.groupId
        if (gid) {
          for (const o of items) if (o.data?.groupId === gid) set.add(o.id)
        }
      }
      return [...set]
    },
    [items]
  )

  const moveSetFor = useCallback(
    (ids) => {
      const set = new Set(ids)
      for (const id of ids) {
        const it = items.find((i) => i.id === id)
        if (it?.type === 'frame' && !it.data?.locked) {
          for (const o of items) {
            if (o.id !== it.id && !o.data?.locked && frameContains(it, o)) set.add(o.id)
          }
        }
      }
      return [...set]
    },
    [items]
  )

  const patchItems = useCallback(
    (ids, patch, opts) => {
      mutate(
        (prev) => prev.map((i) => (ids.includes(i.id) ? { ...i, data: { ...i.data, ...patch } } : i)),
        opts
      )
    },
    [mutate]
  )

  const addImage = useCallback(
    (itemId, at) => {
      const src = itemsById[itemId]
      const rect = rootRef.current.getBoundingClientRect()
      const center = at || screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2)
      const w = 260
      const h = 320
      const it = createItem('image', center.x - w / 2, center.y - h / 2, {
        width: w,
        height: h,
        data: { itemId, naturalWidth: src?.width || 0, naturalHeight: src?.height || 0 }
      })
      it.z = Math.max(...items.map((i) => i.z || 0), 0) + 1
      mutate((prev) => [...prev, it])
      setSel([it.id])
    },
    [items, itemsById, mutate, screenToWorld]
  )

  const deleteSelection = useCallback(() => {
    if (!sel.length) return
    mutate((prev) => prev.filter((i) => !sel.includes(i.id)))
    setSel([])
  }, [mutate, sel])

  const duplicateSelection = useCallback(() => {
    if (!sel.length) return
    const clones = selItems.map((i) => {
      const data = { ...i.data }
      if (data.groupId) data.groupId = uid('g')
      return { ...i, id: uid(i.type), x: i.x + 28, y: i.y + 28, data }
    })
    const maxZ = Math.max(...items.map((i) => i.z || 0), 0)
    clones.forEach((c, idx) => (c.z = maxZ + 1 + idx))
    mutate((prev) => [...prev, ...clones])
    setSel(clones.map((c) => c.id))
  }, [items, mutate, sel, selItems])

  const zOrder = useCallback(
    (dir) => {
      if (!sel.length) return
      mutate((prev) => {
        const zs = prev.map((i) => i.z || 0)
        const max = Math.max(...zs)
        const min = Math.min(...zs)
        if (dir === 'front') return prev.map((i) => (sel.includes(i.id) ? { ...i, z: max + 1 } : i))
        if (dir === 'back') return prev.map((i) => (sel.includes(i.id) ? { ...i, z: min - 1 } : i))
        return prev
      })
    },
    [mutate, sel]
  )

  const align = useCallback(
    (kind) => {
      if (selItems.length < 2) return
      const b = itemsBounds(selItems)
      mutate((prev) =>
        prev.map((i) => {
          if (!sel.includes(i.id)) return i
          const ib = itemBounds(i)
          if (kind === 'left') return { ...i, x: i.x + (b.minX - ib.x) }
          if (kind === 'right') return { ...i, x: i.x + (b.maxX - (ib.x + ib.w)) }
          if (kind === 'top') return { ...i, y: i.y + (b.minY - ib.y) }
          if (kind === 'bottom') return { ...i, y: i.y + (b.maxY - (ib.y + ib.h)) }
          if (kind === 'hcenter') return { ...i, x: i.x + (b.minX + b.w / 2 - (ib.x + ib.w / 2)) }
          if (kind === 'vcenter') return { ...i, y: i.y + (b.minY + b.h / 2 - (ib.y + ib.h / 2)) }
          return i
        })
      )
    },
    [mutate, sel, selItems]
  )

  const distribute = useCallback(
    (axis) => {
      if (selItems.length < 3) return
      const withB = selItems.map((i) => ({ i, b: itemBounds(i) }))
      withB.sort((a, b) => (axis === 'h' ? a.b.x - b.b.x : a.b.y - b.b.y))
      const first = withB[0]
      const last = withB[withB.length - 1]
      const total =
        axis === 'h'
          ? last.b.x + last.b.w - first.b.x
          : last.b.y + last.b.h - first.b.y
      const sum = withB.reduce((acc, x) => acc + (axis === 'h' ? x.b.w : x.b.h), 0)
      const gap = (total - sum) / (withB.length - 1)
      let cursor = axis === 'h' ? first.b.x : first.b.y
      const nextPos = new Map()
      for (const { i, b } of withB) {
        const cur = axis === 'h' ? b.x : b.y
        const delta = cursor - cur
        nextPos.set(i.id, delta)
        cursor += (axis === 'h' ? b.w : b.h) + gap
      }
      mutate((prev) =>
        prev.map((i) => {
          if (!nextPos.has(i.id)) return i
          const d = nextPos.get(i.id)
          return axis === 'h' ? { ...i, x: i.x + d } : { ...i, y: i.y + d }
        })
      )
    },
    [mutate, selItems]
  )

  const group = useCallback(() => {
    if (sel.length < 2) return
    const gid = uid('g')
    mutate((prev) => prev.map((i) => (sel.includes(i.id) ? { ...i, data: { ...i.data, groupId: gid } } : i)))
  }, [mutate, sel])

  const ungroup = useCallback(() => {
    mutate((prev) =>
      prev.map((i) => {
        if (!sel.includes(i.id) || !i.data?.groupId) return i
        const data = { ...i.data }
        delete data.groupId
        return { ...i, data }
      })
    )
  }, [mutate, sel])

  const beginResize = (e, handle) => {
    const it = single
    modeRef.current = {
      kind: handle === 'rotate' ? 'rotate' : 'resize',
      handle,
      id: it.id,
      before: JSON.parse(JSON.stringify(items)),
      originals: JSON.parse(JSON.stringify(it)),
      center: { x: it.x + it.width / 2, y: it.y + it.height / 2 }
    }
    rootRef.current.setPointerCapture(e.pointerId)
    e.stopPropagation()
  }

  const eraseAt = (wx, wy) => {
    const hit = items.find(
      (i) => (i.type === 'line' || i.type === 'arrow') && pointInItem(i, wx, wy)
    )
    if (hit) mutate((prev) => prev.filter((i) => i.id !== hit.id))
  }

  const onPointerDown = (e) => {
    if (editing) return
    const root = rootRef.current
    if (e.button === 1 || spaceRef.current || e.button === 2) {
      modeRef.current = { kind: 'pan', screen: { x: e.clientX, y: e.clientY }, pan0: { ...pan } }
      root.setPointerCapture(e.pointerId)
      return
    }
    if (tool === 'erase') {
      const { x: ex, y: ey } = screenToWorld(e.clientX, e.clientY)
      eraseAt(ex, ey)
      modeRef.current = { kind: 'erase' }
      root.setPointerCapture(e.pointerId)
      return
    }
    if (tool === 'draw') {
      const { x: dx, y: dy } = screenToWorld(e.clientX, e.clientY)
      const it = createItem('line', dx, dy, { width: 1, height: 1, data: { kind: 'draw', points: [[0, 0]] } })
      it.z = Math.max(...items.map((i) => i.z || 0), 0) + 1
      mutate((prev) => [...prev, it])
      modeRef.current = { kind: 'draw', id: it.id, before: JSON.parse(JSON.stringify(items)) }
      root.setPointerCapture(e.pointerId)
      return
    }
    const handleEl = e.target.closest?.('[data-handle]')
    if (handleEl && single) {
      beginResize(e, handleEl.dataset.handle)
      return
    }
    const target = e.target.closest?.('[data-bi]')
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY)

    if (tool === 'select') {
      if (target) {
        const id = target.dataset.bi
        let next = e.shiftKey
          ? sel.includes(id)
            ? sel.filter((s) => s !== id)
            : [...sel, id]
          : [id]
        next = expandGroup(next)
        setSel(next)
        const moveIds = moveSetFor(next)
        modeRef.current = {
          kind: 'move',
          start: { x: wx, y: wy },
          ids: moveIds,
          before: JSON.parse(JSON.stringify(items)),
          originals: new Map(
            items
              .filter((i) => moveIds.includes(i.id) && !i.data?.locked)
              .map((i) => [i.id, { x: i.x, y: i.y }])
          )
        }
        root.setPointerCapture(e.pointerId)
        return
      }
    }

    if (tool === 'select') {
      modeRef.current = {
        kind: 'marquee',
        start: { x: wx, y: wy },
        base: e.shiftKey ? sel : []
      }
      if (!e.shiftKey) setSel([])
      setMarquee({ x: wx, y: wy, w: 0, h: 0 })
      root.setPointerCapture(e.pointerId)
      return
    }

    const defaults = {
      sticky: { width: 180, height: 180 },
      text: { width: 220, height: 44 },
      frame: { width: 600, height: 400 },
      rect: { width: 180, height: 120 },
      ellipse: { width: 180, height: 120 },
      triangle: { width: 180, height: 120 },
      line: { width: 200, height: 2 },
      arrow: { width: 200, height: 2 },
      elbow: { width: 200, height: 2 }
    }
    const type = tool === 'rect' || tool === 'ellipse' || tool === 'triangle' ? 'shape' : tool === 'elbow' ? 'arrow' : tool
    const isLine = tool === 'line' || tool === 'arrow' || tool === 'elbow'
    const it = createItem(type, wx, wy, {
      width: isLine ? 1 : 1,
      height: isLine ? 1 : 1,
      data: isLine
        ? { kind: tool, points: tool === 'elbow' ? [] : [] }
        : tool === 'frame'
          ? { title: `Frame ${items.filter((i) => i.type === 'frame').length + 1}`, fill: SHAPE_FILLS[0] }
          : {}
    })
    if (tool === 'shape') it.data.kind = 'rect'
    if (tool === 'rect') it.data.kind = 'rect'
    if (tool === 'ellipse') it.data.kind = 'ellipse'
    if (tool === 'triangle') it.data.kind = 'triangle'
    it.z = Math.max(...items.map((i) => i.z || 0), 0) + 1
    mutate((prev) => [...prev, it])
    setSel([it.id])
    modeRef.current = {
      kind: 'create',
      id: it.id,
      start: { x: wx, y: wy },
      before: JSON.parse(JSON.stringify(items)),
      defaults: defaults[tool] || { width: 180, height: 120 },
      isLine,
      autoEdit: type === 'sticky' || type === 'text'
    }
    root.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e) => {
    const m = modeRef.current
    if (!m) return
    const { x: wx, y: wy } = screenToWorld(e.clientX, e.clientY)

    if (m.kind === 'pan') {
      setPan({ x: m.pan0.x + (e.clientX - m.screen.x), y: m.pan0.y + (e.clientY - m.screen.y) })
      return
    }
    if (m.kind === 'move') {
      const dx = wx - m.start.x
      const dy = wy - m.start.y
      setItems((prev) =>
        prev.map((i) => {
          const o = m.originals.get(i.id)
          return o ? { ...i, x: o.x + dx, y: o.y + dy } : i
        })
      )
      return
    }
    if (m.kind === 'marquee') {
      const rect = {
        x: Math.min(m.start.x, wx),
        y: Math.min(m.start.y, wy),
        w: Math.abs(wx - m.start.x),
        h: Math.abs(wy - m.start.y)
      }
      setMarquee(rect)
      const inside = items
        .filter((i) => i.type !== 'frame' && !i.data?.locked)
        .filter((i) => rectsIntersect(rect, itemBounds(i)))
        .map((i) => i.id)
      setSel([...new Set([...m.base, ...expandGroup(inside)])])
      return
    }
    if (m.kind === 'erase') {
      eraseAt(wx, wy)
      return
    }
    if (m.kind === 'draw') {
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== m.id) return i
          const pts = i.data.points || []
          const last = pts[pts.length - 1] || [0, 0]
          const nx = wx - i.x
          const ny = wy - i.y
          if (Math.hypot(nx - last[0], ny - last[1]) < 2.5) return i
          const next = [...pts, [nx, ny]]
          let maxX = 1
          let maxY = 1
          for (const [px, py] of next) {
            maxX = Math.max(maxX, px)
            maxY = Math.max(maxY, py)
          }
          return { ...i, width: Math.max(1, maxX), height: Math.max(1, maxY), data: { ...i.data, points: next } }
        })
      )
      return
    }
    if (m.kind === 'create') {
      const dx = wx - m.start.x
      const dy = wy - m.start.y
      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== m.id) return i
          if (m.isLine) {
            const x = Math.min(m.start.x, wx)
            const y = Math.min(m.start.y, wy)
            const pts =
              i.data.kind === 'elbow'
                ? elbowPoints(dx, dy)
                : [
                    [m.start.x - x, m.start.y - y],
                    [wx - x, wy - y]
                  ]
            return { ...i, x, y, width: Math.abs(dx) || 1, height: Math.abs(dy) || 1, data: { ...i.data, points: pts } }
          }
          return {
            ...i,
            x: Math.min(m.start.x, wx),
            y: Math.min(m.start.y, wy),
            width: Math.max(2, Math.abs(dx)),
            height: Math.max(2, Math.abs(dy))
          }
        })
      )
      return
    }
    if (m.kind === 'resize') {
      const it = m.originals
      const r = it.rotation || 0
      const cx = m.center.x
      const cy = m.center.y
      const [lx, ly] = rotatePoint(wx, wy, cx, cy, -r)
      if (it.type === 'line' || it.type === 'arrow') {
        const idx = m.handle === 'p0' ? 0 : (it.data.points || []).length - 1
        setItems((prev) =>
          prev.map((i) => {
            if (i.id !== m.id) return i
            const pts = (i.data.points || []).map((p, k) => (k === idx ? [lx - i.x, ly - i.y] : p))
            let minX = Infinity
            let minY = Infinity
            for (const [px, py] of pts) {
              minX = Math.min(minX, px)
              minY = Math.min(minY, py)
            }
            const norm = pts.map(([px, py]) => [px - minX, py - minY])
            let maxX = -Infinity
            let maxY = -Infinity
            for (const [px, py] of norm) {
              maxX = Math.max(maxX, px)
              maxY = Math.max(maxY, py)
            }
            return {
              ...i,
              x: i.x + minX,
              y: i.y + minY,
              width: Math.max(1, maxX),
              height: Math.max(1, maxY),
              data: { ...i.data, points: norm }
            }
          })
        )
        return
      }
      let x1 = it.x
      let y1 = it.y
      let x2 = it.x + it.width
      let y2 = it.y + it.height
      if (m.handle.includes('w')) x1 = lx
      if (m.handle.includes('e')) x2 = lx
      if (m.handle.includes('n')) y1 = ly
      if (m.handle.includes('s')) y2 = ly
      let w = Math.max(6, x2 - x1)
      let h = Math.max(6, y2 - y1)
      if (e.shiftKey && it.type === 'image') h = (w * it.height) / it.width
      setItems((prev) =>
        prev.map((i) => (i.id === m.id ? { ...i, x: x1, y: y1, width: w, height: h } : i))
      )
      return
    }
    if (m.kind === 'rotate') {
      const it = m.originals
      const cx = m.center.x
      const cy = m.center.y
      let deg = (Math.atan2(wy - cy, wx - cx) * 180) / Math.PI + 90
      if (e.shiftKey) deg = Math.round(deg / SNAP_ANGLE) * SNAP_ANGLE
      setItems((prev) => prev.map((i) => (i.id === m.id ? { ...i, rotation: Math.round(deg) } : i)))
    }
  }

  const onPointerUp = (e) => {
    const m = modeRef.current
    if (!m) return
    if (m.kind === 'create') {
      const it = items.find((i) => i.id === m.id)
      if (it && m.isLine && it.width < 6 && it.height < 6) {
        setItems((prev) =>
          prev.map((i) =>
            i.id === m.id
              ? { ...i, x: m.start.x, y: m.start.y, width: 200, height: 1, data: { ...i.data, points: [[0, 0], [200, 0]] } }
              : i
          )
        )
      } else if (it && !m.isLine && (it.width < 6 || it.height < 6)) {
        const d = m.defaults
        setItems((prev) =>
          prev.map((i) =>
            i.id === m.id
              ? { ...i, x: m.start.x - d.width / 2, y: m.start.y - d.height / 2, width: d.width, height: d.height }
              : i
          )
        )
      }
      if (m.autoEdit) setEditing(m.id)
      setTool('select')
    }
    if (m.kind === 'draw') {
      const it = items.find((i) => i.id === m.id)
      if (it && (it.data.points || []).length < 3) {
        setItems((prev) => prev.filter((i) => i.id !== m.id))
      }
    }
    if (m.before && (m.kind === 'move' || m.kind === 'resize' || m.kind === 'rotate' || m.kind === 'create' || m.kind === 'draw')) {
      const h = historyRef.current
      h.past.push(m.before)
      if (h.past.length > 80) h.past.shift()
      h.future = []
    }
    modeRef.current = null
    setMarquee(null)
    try {
      rootRef.current.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      if (e.ctrlKey || e.metaKey) {
        const factor = Math.exp(-e.deltaY * 0.01)
        const next = clamp(zoom * factor, 0.1, 4)
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setPan((p) => ({ x: mx - ((mx - p.x) / zoom) * next, y: my - ((my - p.y) / zoom) * next }))
        setZoom(next)
      } else {
        setPan((p) => ({ x: p.x - e.deltaX, y: p.y - e.deltaY }))
      }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoom])

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Space' && !e.repeat) {
        spaceRef.current = true
        rootRef.current?.classList.add('panning')
      }
    }
    const up = (e) => {
      if (e.code === 'Space') {
        spaceRef.current = false
        rootRef.current?.classList.remove('panning')
      }
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      const t = e.target
      const typing = t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
      if (typing) return
      const meta = e.metaKey || e.ctrlKey
      if (meta && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? redo() : undo()
        return
      }
      if (meta && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (meta && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        setSel(items.map((i) => i.id))
        return
      }
      if (meta && e.key.toLowerCase() === 'c') {
        clipboardRef.current = selItems.map((i) => JSON.parse(JSON.stringify(i)))
        return
      }
      if (meta && e.key.toLowerCase() === 'v') {
        if (clipboardRef.current.length) {
          const clones = clipboardRef.current.map((i) => ({ ...i, id: uid(i.type), x: i.x + 32, y: i.y + 32 }))
          mutate((prev) => [...prev, ...clones])
          setSel(clones.map((c) => c.id))
        }
        return
      }
      if (meta && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        e.shiftKey ? ungroup() : group()
        return
      }
      if (e.key === 'Escape') {
        if (editing) setEditing(null)
        else if (sel.length) setSel([])
        else onBack()
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection()
        return
      }
      if (e.key.startsWith('Arrow') && sel.length) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0
        mutate((prev) => prev.map((i) => (sel.includes(i.id) ? { ...i, x: i.x + dx, y: i.y + dy } : i)))
        return
      }
      if (meta) return
      const k = e.key.toLowerCase()
      if (k === 'v') setTool('select')
      else if (k === 'i') setDrawerOpen((v) => !v)
      else if (k === 's') setTool('sticky')
      else if (k === 't') setTool('text')
      else if (k === 'f') setTool('frame')
      else if (k === 'r') setTool('rect')
      else if (k === 'e') setTool('ellipse')
      else if (k === 'y') setTool('triangle')
      else if (k === 'l') setTool('line')
      else if (k === 'a') setTool('arrow')
      else if (k === 'b') setTool('elbow')
      else if (k === 'p') setTool('draw')
      else if (k === 'x') setTool('erase')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [deleteSelection, duplicateSelection, editing, group, items, mutate, onBack, redo, sel, selItems, undo, ungroup])

  const commitEdit = (it, value) => {
    const field = it.type === 'frame' ? 'title' : 'text'
    if ((it.data?.[field] || '') !== value) {
      patchItems([it.id], { [field]: value })
    }
    setEditing(null)
  }

  const renderItem = (it) => {
    const isEditing = editing === it.id
    if (it.type === 'image') {
      const src = itemsById[it.data.itemId]
      if (!src?.thumb && !src?.video) {
        return <div className="bi-missing">Image missing</div>
      }
      if (src?.video) {
        return (
          <video
            className="bi-img"
            src={src.video}
            poster={src.thumb || undefined}
            muted
            loop
            playsInline
            draggable={false}
            onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
            onMouseLeave={(e) => {
              e.currentTarget.pause()
              e.currentTarget.currentTime = 0
            }}
          />
        )
      }
      return (
        <img
          className="bi-img"
          src={src.thumb}
          alt=""
          draggable={false}
          onLoad={(e) => {
            const nw = e.target.naturalWidth
            const nh = e.target.naturalHeight
            if (!it.data.naturalWidth && nw && nh) {
              patchItems([it.id], { naturalWidth: nw, naturalHeight: nh }, { history: false })
            }
          }}
        />
      )
    }
    if (it.type === 'frame') {
      return (
        <div className="bi-frame" style={{ background: it.data.fill || '#fff' }}>
          {isEditing ? (
            <div
              className="bi-edit title"
              contentEditable
              suppressContentEditableWarning
              autoFocus
              onBlur={(e) => commitEdit(it, e.currentTarget.innerText)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape' || e.key === 'Enter') e.currentTarget.blur()
              }}
            >
              {it.data.title}
            </div>
          ) : (
            <span className="bi-frame-title">{it.data.title}</span>
          )}
        </div>
      )
    }
    if (it.type === 'sticky') {
      const c = STICKY_COLORS[it.data.color] || STICKY_COLORS.yellow
      return (
        <div
          className="bi-sticky"
          style={{
            background: `linear-gradient(180deg, ${c.top}, ${c.bottom})`,
            fontSize: it.data.fontSize || 16,
            fontFamily: it.data.fontFamily || 'inherit',
            color: it.data.color2 || '#1c1c1e',
            textAlign: it.data.align || 'left'
          }}
        >
          {isEditing ? (
            <div
              className="bi-edit"
              contentEditable
              suppressContentEditableWarning
              autoFocus
              onBlur={(e) => commitEdit(it, e.currentTarget.innerText)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') e.currentTarget.blur()
              }}
            >
              {it.data.text}
            </div>
          ) : (
            <span className="bi-note-text">{it.data.text}</span>
          )}
        </div>
      )
    }
    if (it.type === 'text') {
      return (
        <div
          className="bi-text"
          style={{
            fontSize: it.data.fontSize || 18,
            fontFamily: it.data.fontFamily || 'inherit',
            color: it.data.color || '#0a0a0a',
            textAlign: it.data.align || 'left'
          }}
        >
          {isEditing ? (
            <div
              className="bi-edit"
              contentEditable
              suppressContentEditableWarning
              autoFocus
              onBlur={(e) => commitEdit(it, e.currentTarget.innerText)}
              onKeyDown={(e) => {
                e.stopPropagation()
                if (e.key === 'Escape') e.currentTarget.blur()
              }}
            >
              {it.data.text}
            </div>
          ) : (
            <span>{it.data.text}</span>
          )}
        </div>
      )
    }
    if (it.type === 'shape') {
      const w = it.width
      const h = it.height
      const sw = it.data.strokeWidth ?? 1.5
      const fill = it.data.fill === 'transparent' ? 'transparent' : it.data.fill
      const stroke = it.data.stroke === 'transparent' ? 'none' : it.data.stroke
      const pad = sw / 2
      return (
        <div className="bi-shape">
          <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none">
            {it.data.kind === 'rect' && (
              <rect x={pad} y={pad} width={Math.max(1, w - sw)} height={Math.max(1, h - sw)} rx={8} fill={fill} stroke={stroke} strokeWidth={sw} />
            )}
            {it.data.kind === 'ellipse' && (
              <ellipse cx={w / 2} cy={h / 2} rx={Math.max(1, (w - sw) / 2)} ry={Math.max(1, (h - sw) / 2)} fill={fill} stroke={stroke} strokeWidth={sw} />
            )}
            {it.data.kind === 'triangle' && (
              <polygon points={`${w / 2},${pad} ${w - pad},${h - pad} ${pad},${h - pad}`} fill={fill} stroke={stroke} strokeWidth={sw} strokeLinejoin="round" />
            )}
          </svg>
          {(it.data.text || isEditing) && (
            <div
              className="bi-shape-text"
              style={{
                fontSize: it.data.fontSize || 14,
                fontFamily: it.data.fontFamily || 'inherit',
                color: it.data.color || '#0a0a0a',
                textAlign: it.data.align || 'center'
              }}
            >
              {isEditing ? (
                <div
                  className="bi-edit"
                  contentEditable
                  suppressContentEditableWarning
                  autoFocus
                  onBlur={(e) => commitEdit(it, e.currentTarget.innerText)}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Escape') e.currentTarget.blur()
                  }}
                >
                  {it.data.text}
                </div>
              ) : (
                <span>{it.data.text}</span>
              )}
            </div>
          )}
        </div>
      )
    }
    if (it.type === 'line' || it.type === 'arrow') {
      const pts = it.data.points || []
      const stroke = it.data.stroke || '#0a0a0a'
      const sw = it.data.strokeWidth || 2
      const d = pts.map((p) => p.join(',')).join(' ')
      const markerId = `m_${it.id}`
      const last = pts[pts.length - 1] || [0, 0]
      const before = pts[pts.length - 2] || [0, 0]
      const ang = Math.atan2(last[1] - before[1], last[0] - before[0]) * (180 / Math.PI)
      const headLen = 6 + sw * 2
      const tip = [last[0] - Math.cos((ang * Math.PI) / 180) * headLen * 0.6, last[1] - Math.sin((ang * Math.PI) / 180) * headLen * 0.6]
      return (
        <svg className="bi-line" viewBox={`0 0 ${Math.max(1, it.width)} ${Math.max(1, it.height)}`} preserveAspectRatio="none">
          <polyline points={d} fill="none" stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" />
          {it.data.kind === 'arrow' && pts.length > 1 && (
            <polygon
              points={`${last[0]},${last[1]} ${tip[0] - Math.sin((ang * Math.PI) / 180) * headLen * 0.4},${tip[1] + Math.cos((ang * Math.PI) / 180) * headLen * 0.4} ${tip[0] + Math.sin((ang * Math.PI) / 180) * headLen * 0.4},${tip[1] - Math.cos((ang * Math.PI) / 180) * headLen * 0.4}`}
              fill={stroke}
              stroke="none"
            />
          )}
        </svg>
      )
    }
    return null
  }

  const selBounds = useMemo(() => (selItems.length ? itemsBounds(selItems) : null), [selItems])
  const lockedSingle = !!single?.data?.locked

  const toggleLock = () => {
    const anyUnlocked = selItems.some((i) => !i.data?.locked)
    patchItems(selItems.map((i) => i.id), { locked: anyUnlocked })
  }

  const mediaSrc = (it) => (it?.type === 'image' ? itemsById[it.data.itemId]?.thumb || '' : '')

  const downloadItem = async () => {
    const src = mediaSrc(single)
    if (!src) return
    try {
      const blob = await (await fetch(src)).blob()
      const dataUrl = await new Promise((resolve, reject) => {
        const fr = new FileReader()
        fr.onload = () => resolve(fr.result)
        fr.onerror = reject
        fr.readAsDataURL(blob)
      })
      const base = single.type === 'image' ? itemsById[single.data.itemId]?.title || 'image' : 'board-item'
      window.gather?.downloadFile?.(`${String(base).slice(0, 60)}.png`, dataUrl)
    } catch {
      /* ignore */
    }
  }

  const copyItem = () => {
    const src = mediaSrc(single)
    if (src) copyImageToClipboard(src)
  }

  const hs = 9 / zoom
  const handlePos = {
    nw: { left: -hs / 2, top: -hs / 2 },
    n: { left: '50%', top: -hs / 2, transform: 'translateX(-50%)' },
    ne: { right: -hs / 2, top: -hs / 2 },
    e: { right: -hs / 2, top: '50%', transform: 'translateY(-50%)' },
    se: { right: -hs / 2, bottom: -hs / 2 },
    s: { left: '50%', bottom: -hs / 2, transform: 'translateX(-50%)' },
    sw: { left: -hs / 2, bottom: -hs / 2 },
    w: { left: -hs / 2, top: '50%', transform: 'translateY(-50%)' }
  }

  const empty = items.length === 0

  return (
    <div className={`board ${tool !== 'select' ? 'drawing' : ''}`}>
      <div className="board-top">
        <button className="board-back" title="Back to spaces" onClick={onBack}>
          <IconChevronLeft size={17} />
        </button>
        <input
          className="board-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== board.name && onRename(name.trim())}
          spellCheck={false}
        />
        <div className="board-zoom">
          <button className="icon-btn" title="Zoom out" onClick={() => setZoom((z) => clamp(z / 1.2, 0.1, 4))}>
            <IconMinus size={15} />
          </button>
          <button className="zoom-val" title="Reset zoom" onClick={() => setZoom(1)}>
            {Math.round(zoom * 100)}%
          </button>
          <button className="icon-btn" title="Zoom in" onClick={() => setZoom((z) => clamp(z * 1.2, 0.1, 4))}>
            <IconPlus size={15} />
          </button>
          <button className="icon-btn" title="Zoom to fit" onClick={fit}>
            <IconFit size={15} />
          </button>
        </div>
        <button
          className={`board-del ${confirmDelete ? 'confirm' : ''}`}
          title={confirmDelete ? 'Click again to delete' : 'Delete space'}
          onClick={() => {
            if (!confirmDelete) {
              setConfirmDelete(true)
              setTimeout(() => setConfirmDelete(false), 2600)
            } else {
              onDelete()
            }
          }}
        >
          <IconTrash size={15} />
          {confirmDelete && <span>Confirm</span>}
        </button>
      </div>

      <div
        className="board-canvas"
        ref={rootRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/gather-item')
          if (id) addImage(id, screenToWorld(e.clientX, e.clientY))
        }}
        onDoubleClick={(e) => {
          const target = e.target.closest?.('[data-bi]')
          if (!target) return
          const it = items.find((i) => i.id === target.dataset.bi)
          if (it && (it.type === 'sticky' || it.type === 'text' || it.type === 'shape' || it.type === 'frame')) {
            setEditing(it.id)
          }
        }}
      >
        <div
          className="board-grid"
          style={{
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`
          }}
        />
        <div
          className="board-layer"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {sorted.map((it) => {
            const selected = sel.includes(it.id)
            const isLine = it.type === 'line' || it.type === 'arrow'
            return (
              <div
                key={it.id}
                data-bi={it.id}
                className={`bi bi-${it.type} ${selected ? 'selected' : ''}`}
                style={{
                  transform: `translate(${it.x}px, ${it.y}px) rotate(${it.rotation || 0}deg)`,
                  width: Math.max(1, it.width),
                  height: Math.max(1, it.height),
                  zIndex: Math.round(zOf(it))
                }}
              >
                {renderItem(it)}
                {selected && single && single.id === it.id && !lockedSingle && (
                  <>
                    {isLine
                      ? (it.data.points || []).map((p, idx) => (
                          <div
                            key={idx}
                            data-handle={idx === 0 ? 'p0' : 'p1'}
                            className="bi-handle line"
                            style={{
                              left: p[0] - hs / 2,
                              top: p[1] - hs / 2,
                              width: hs,
                              height: hs
                            }}
                          />
                        ))
                      : HANDLES.map((h) => (
                          <div
                            key={h}
                            data-handle={h}
                            className={`bi-handle ${h}`}
                            style={{ width: hs, height: hs, ...handlePos[h] }}
                          />
                        ))}
                    {!isLine && (
                      <div
                        data-handle="rotate"
                        className="bi-rotate"
                        style={{ left: '50%', top: -26 / zoom, width: hs + 3, height: hs + 3 }}
                      />
                    )}
                  </>
                )}
              </div>
            )
          })}
          {marquee && (
            <div
              className="board-marquee"
              style={{ transform: `translate(${marquee.x}px, ${marquee.y}px)`, width: marquee.w, height: marquee.h }}
            />
          )}
        </div>

        {empty && (
          <div className="board-empty">
            <div className="be-title">Empty space</div>
            <div className="be-sub">
              Press <kbd>S</kbd> for a sticky note, <kbd>T</kbd> for text, <kbd>F</kbd> for a frame — or add images
              from your library with <kbd>I</kbd>.
            </div>
          </div>
        )}

        {selBounds && (
          <div
            className="bi-toolbar"
            style={
              pan.y + selBounds.minY * zoom < 66
                ? {
                    left: pan.x + (selBounds.minX + selBounds.w / 2) * zoom,
                    top: pan.y + (selBounds.minY + selBounds.h) * zoom,
                    transform: 'translate(-50%, 38px)'
                  }
                : {
                    left: pan.x + (selBounds.minX + selBounds.w / 2) * zoom,
                    top: pan.y + selBounds.minY * zoom,
                    transform: 'translate(-50%, calc(-100% - 38px))'
                  }
            }
            onPointerDown={(e) => e.stopPropagation()}
          >
            {single?.type === 'image' && (
              <>
                <button className="ibt" title="Download" onClick={downloadItem}>
                  <IconDownload size={16} />
                </button>
                <button className="ibt" title="Copy image" onClick={copyItem}>
                  <IconCopy size={16} />
                </button>
                <span className="ibt-sep" />
              </>
            )}
            <button className="ibt" title="Bring to front" onClick={() => zOrder('front')}>
              <IconToFront size={16} />
            </button>
            <button className="ibt" title="Send to back" onClick={() => zOrder('back')}>
              <IconToBack size={16} />
            </button>
            <span className="ibt-sep" />
            <button className="ibt" title={lockedSingle ? 'Unlock' : 'Lock'} onClick={toggleLock}>
              {lockedSingle ? <IconUnlock size={16} /> : <IconLock size={16} />}
            </button>
            <span className="ibt-sep" />
            <button className="ibt danger" title="Delete" onClick={deleteSelection}>
              <IconTrash size={16} />
            </button>
          </div>
        )}

        <BoardToolbar
          tool={tool}
          setTool={setTool}
          drawerOpen={drawerOpen}
          onToggleDrawer={() => setDrawerOpen((v) => !v)}
        />

        <BoardInspector
          items={selItems}
          single={!!single}
          onPatch={patchItems}
          onDelete={deleteSelection}
          onDuplicate={duplicateSelection}
          onFront={() => zOrder('front')}
          onBack={() => zOrder('back')}
          onGroup={group}
          onUngroup={ungroup}
          onAlign={align}
          onDistribute={distribute}
        />
      </div>

      {drawerOpen && (
        <BoardLibraryDrawer
          items={library}
          itemsById={itemsById}
          onAdd={(id) => addImage(id)}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  )
}
