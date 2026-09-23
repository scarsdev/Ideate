const base = (size = 16, extra = {}) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  ...extra
})

const S = ({ size, children, extra }) => <svg {...base(size, extra)}>{children}</svg>

export const IconSearch = ({ size = 15 }) => (
  <S size={size}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" /></S>
)

export const IconChevronDown = ({ size = 12 }) => (
  <S size={size}><path d="m6 9 6 6 6-6" /></S>
)

export const IconChevronUp = ({ size = 12 }) => (
  <S size={size}><path d="m6 15 6-6 6 6" /></S>
)

export const IconChevronLeft = ({ size = 16 }) => (
  <S size={size}><path d="m15 18-6-6 6-6" /></S>
)

export const IconChevronRight = ({ size = 16 }) => (
  <S size={size}><path d="m9 18 6-6-6-6" /></S>
)

export const IconAperture = ({ size = 15, color = '#fff' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.9" strokeLinecap="round">
    <circle cx="12" cy="12" r="9.5" />
    <path d="M12 2.5 12 12l8.2 5" />
    <path d="M21.2 8.2 12 12 6.5 4.5" />
    <path d="M2.8 15.8 12 12l-4 9" />
  </svg>
)

export const IconContrast = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="12" r="9" /><path d="M12 3a9 9 0 0 1 0 18z" fill="currentColor" stroke="none" /></S>
)

export const IconClock = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></S>
)

export const IconGear = ({ size = 16 }) => (
  <S size={size}>
    <circle cx="12" cy="12" r="3.2" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.6 8.9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.54h.05A1.7 1.7 0 0 0 10 3V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
  </S>
)

export const IconColumns = ({ size = 16 }) => (
  <S size={size}><rect x="3.5" y="4.5" width="17" height="15" rx="3" /><path d="M12 4.5v15" /><path d="M8 9h1.4M15 9h1.4" /></S>
)

export const IconCheck = ({ size = 14 }) => (
  <S size={size}><path d="m5 12.5 4.5 4.5L19 7.5" /></S>
)

export const IconVideo = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <rect x="2.5" y="6" width="14" height="12" rx="3" />
    <path d="M17.5 10.5 21.5 8v8l-4-2.5z" />
  </svg>
)

export const IconPlay = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M8 5.5v13l11-6.5z" /></svg>
)

export const IconPause = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5.5" width="3.4" height="13" rx="1" /><rect x="13.6" y="5.5" width="3.4" height="13" rx="1" /></svg>
)

export const IconDownload = ({ size = 16 }) => (
  <S size={size}><path d="M12 4v11" /><path d="m7.5 11 4.5 4.5L16.5 11" /><path d="M5 19.5h14" /></S>
)

export const IconCopy = ({ size = 16 }) => (
  <S size={size}><rect x="9" y="9" width="11" height="11" rx="2.5" /><path d="M15 5.5A2.5 2.5 0 0 0 12.5 4h-6A2.5 2.5 0 0 0 4 6.5v6A2.5 2.5 0 0 0 6.5 15" /></S>
)

export const IconInfo = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="0.9" fill="currentColor" stroke="none" /></S>
)

export const IconClose = ({ size = 16 }) => (
  <S size={size}><path d="M6 6l12 12M18 6 6 18" /></S>
)

export const IconPlus = ({ size = 16 }) => (
  <S size={size}><path d="M12 5v14M5 12h14" /></S>
)

export const IconLink = ({ size = 14 }) => (
  <S size={size}><path d="M10 13.5a4 4 0 0 1 0-5.6l2.2-2.2a4 4 0 0 1 5.6 5.6l-1 1" /><path d="M14 10.5a4 4 0 0 1 0 5.6l-2.2 2.2a4 4 0 0 1-5.6-5.6l1-1" /></S>
)

export const IconExternal = ({ size = 14 }) => (
  <S size={size}><path d="M14 4h6v6" /><path d="M20 4 11 13" /><path d="M18 14.5V18a2.5 2.5 0 0 1-2.5 2.5h-9A2.5 2.5 0 0 1 4 18V9a2.5 2.5 0 0 1 2.5-2.5H10" /></S>
)

export const IconMore = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <circle cx="5.5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="18.5" cy="12" r="1.6" />
  </svg>
)

export const IconHash = ({ size = 14 }) => (
  <S size={size}><path d="M9 4 7 20M17 4l-2 16M4.5 9h15M3.8 15h15" /></S>
)

export const IconVolume = ({ size = 16 }) => (
  <S size={size}><path d="M5 9.5h3l4-3.5v12l-4-3.5H5z" /><path d="M16 9.5a3.5 3.5 0 0 1 0 5" /></S>
)

export const IconSliders = ({ size = 16 }) => (
  <S size={size}><path d="M4 8h10M18 8h2M4 16h4M12 16h8" /><circle cx="16" cy="8" r="2" /><circle cx="10" cy="16" r="2" /></S>
)

export const IconCast = ({ size = 16 }) => (
  <S size={size}><path d="M4 8.5V7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3h-5" /><path d="M4 20a6 6 0 0 0-6-6M4 15.5a1.5 1.5 0 0 1 1.5 1.5" /></S>
)

export const IconMic = ({ size = 16 }) => (
  <S size={size}><rect x="9" y="3" width="6" height="10" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><path d="M12 17.5V21" /></S>
)

export const IconGrid = ({ size = 16 }) => (
  <S size={size}><rect x="4" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.6" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.6" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.6" /></S>
)

export const IconRows = ({ size = 16 }) => (
  <S size={size}><rect x="4" y="5" width="16" height="6" rx="2" /><rect x="4" y="13" width="16" height="6" rx="2" /></S>
)

export const IconSparkle = ({ size = 14 }) => (
  <S size={size}><path d="M12 4.5 13.6 9l4.4 1.6L13.6 12 12 16.5 10.4 12 6 10.6 10.4 9z" /><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" /></S>
)

export const IconNote = ({ size = 15 }) => (
  <S size={size}><rect x="4.5" y="4" width="15" height="16" rx="3" /><path d="M8 9h8M8 13h5" /></S>
)

export const IconEye = ({ size = 15 }) => (
  <S size={size}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></S>
)

export const IconArchive = ({ size = 15 }) => (
  <S size={size}><rect x="3.5" y="4.5" width="17" height="5" rx="1.8" /><path d="M5.5 9.5V18a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V9.5" /><path d="M10 13h4" /></S>
)

export const IconFolder = ({ size = 14 }) => (
  <S size={size}><path d="M3.5 7.5A2.5 2.5 0 0 1 6 5h3.2a2 2 0 0 1 1.6.8l.7 1a2 2 0 0 0 1.6.8H18A2.5 2.5 0 0 1 20.5 10v6.5A2.5 2.5 0 0 1 18 19H6a2.5 2.5 0 0 1-2.5-2.5z" /></S>
)

export const IconBoard = ({ size = 14 }) => (
  <S size={size}><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="8" r="1.2" fill="currentColor" stroke="none" /><circle cx="16" cy="12" r="1.2" fill="currentColor" stroke="none" /><circle cx="12" cy="16" r="1.2" fill="currentColor" stroke="none" /><circle cx="8" cy="12" r="1.2" fill="currentColor" stroke="none" /></S>
)

export const IconPin = ({ size = 14 }) => (
  <S size={size}><path d="M12 21s-6.2-5.5-6.2-10.4a6.2 6.2 0 1 1 12.4 0C18.2 15.5 12 21 12 21z" /><circle cx="12" cy="10.4" r="2.2" /></S>
)

const PanelIcon = ({ size = 15, side }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7">
    <rect x="3" y="4.5" width="18" height="15" rx="3.2" />
    {side === 'left' && <rect x="4.8" y="6.3" width="6.2" height="11.4" rx="2" fill="currentColor" stroke="none" />}
    {side === 'right' && <rect x="13" y="6.3" width="6.2" height="11.4" rx="2" fill="currentColor" stroke="none" />}
    {side === 'bottom' && <rect x="5.2" y="13.6" width="13.6" height="4.4" rx="2" fill="currentColor" stroke="none" />}
  </svg>
)

export const IconPanelLeft = ({ size = 15 }) => <PanelIcon size={size} side="left" />
export const IconPanelRight = ({ size = 15 }) => <PanelIcon size={size} side="right" />
export const IconPanelBottom = ({ size = 15 }) => <PanelIcon size={size} side="bottom" />

export const IconEyeOff = ({ size = 15 }) => (
  <S size={size}><path d="M3 3l18 18" /><path d="M10.6 5.7A9.9 9.9 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.9" /><path d="M6.4 7.1A17 17 0 0 0 2.5 12S6 18.5 12 18.5c1.3 0 2.5-.3 3.5-.8" /><path d="M9.9 10.1a3 3 0 0 0 4.1 4.2" /></S>
)

export const IconTrash = ({ size = 15 }) => (
  <S size={size}><path d="M4.5 7h15" /><path d="M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" /><path d="M6.5 7l.8 11.1A2 2 0 0 0 9.3 20h5.4a2 2 0 0 0 2-1.9L17.5 7" /><path d="M10.5 11v5M13.5 11v5" /></S>
)

export const IconUndo = ({ size = 15 }) => (
  <S size={size}><path d="M4 9.5h9.5a5.5 5.5 0 0 1 0 11H9" /><path d="M7.5 5.5 3.5 9.5l4 4" /></S>
)

export const IconFolderOpen = ({ size = 15 }) => (
  <S size={size}><path d="M3.5 8V6.5A2 2 0 0 1 5.5 4.5h3a2 2 0 0 1 1.6.8l.7 1a2 2 0 0 0 1.6.8H17a2 2 0 0 1 2 2v1" /><path d="M2.8 10.5h16.7a1.5 1.5 0 0 1 1.4 2l-1.6 5.4a2 2 0 0 1-1.9 1.4H6a2 2 0 0 1-1.9-1.4l-1.7-5.4a1.5 1.5 0 0 1 1.4-2z" /></S>
)

export const IconFocus = ({ size = 17 }) => (
  <S size={size}>
    <path d="M4 8.6V6.5A2.5 2.5 0 0 1 6.5 4h2.1" />
    <path d="M15.4 4h2.1A2.5 2.5 0 0 1 20 6.5v2.1" />
    <path d="M20 15.4v2.1a2.5 2.5 0 0 1-2.5 2.5h-2.1" />
    <path d="M8.6 20H6.5A2.5 2.5 0 0 1 4 17.5v-2.1" />
    <circle cx="12" cy="12" r="2.7" />
  </S>
)

export const IconBookmarkFill = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor"><path d="M7 4h10a2 2 0 0 1 2 2v14l-7-4-7 4V6a2 2 0 0 1 2-2z" /></svg>
)

export const IconUser = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="8" r="3.6" /><path d="M5 19.5c.9-3.4 3.6-5.3 7-5.3s6.1 1.9 7 5.3" /></S>
)

export const IconPalette = ({ size = 16 }) => (
  <S size={size}>
    <path d="M12 3.2a8.8 8.8 0 1 0 0 17.6c1.2 0 1.9-.8 1.9-1.8 0-.9-.6-1.4-.6-2.1 0-1 .8-1.7 2-1.7h1.6a4.8 4.8 0 0 0 4.7-4.8c-.3-4.1-4.4-7.2-9.6-7.2z" />
    <circle cx="8" cy="10.2" r="1" fill="currentColor" stroke="none" />
    <circle cx="12" cy="7.7" r="1" fill="currentColor" stroke="none" />
    <circle cx="15.9" cy="9.5" r="1" fill="currentColor" stroke="none" />
  </S>
)

export const IconBooks = ({ size = 16 }) => (
  <S size={size}><rect x="4" y="4.5" width="16" height="15" rx="2.5" /><path d="M8.5 4.5v15M12 4.5v15M15.5 4.5v15" /></S>
)

export const IconCamera = ({ size = 16 }) => (
  <S size={size}><rect x="3.5" y="6.5" width="17" height="12.5" rx="3" /><circle cx="12" cy="12.7" r="3.4" /><path d="M8.6 6.5 9.7 4.8h4.6l1.1 1.7" /></S>
)

export const IconSync = ({ size = 16 }) => (
  <S size={size}><path d="M19.5 13a7.5 7.5 0 0 1-13 3.6" /><path d="M4.5 11a7.5 7.5 0 0 1 13-3.6" /><path d="M17.5 3.8v3.6H14" /><path d="M6.5 20.2v-3.6H10" /></S>
)

export const IconDatabase = ({ size = 16 }) => (
  <S size={size}><ellipse cx="12" cy="6.2" rx="7" ry="2.8" /><path d="M5 6.2v11.6c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8V6.2" /><path d="M5 12c0 1.5 3.1 2.8 7 2.8s7-1.3 7-2.8" /></S>
)

export const IconPencil = ({ size = 15 }) => (
  <S size={size}><path d="M4.5 19.5h3.2L19 8.2a1.9 1.9 0 0 0 0-2.7l-.9-.9a1.9 1.9 0 0 0-2.7 0L4 16v3.5z" /><path d="M14.2 6.4l3.4 3.4" /></S>
)

export const IconSun = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="12" r="4.1" /><path d="M12 3v2.1M12 18.9V21M3 12h2.1M18.9 12H21M5.7 5.7l1.5 1.5M16.8 16.8l1.5 1.5M18.3 5.7l-1.5 1.5M7.2 16.8l-1.5 1.5" /></S>
)

export const IconMoon = ({ size = 16 }) => (
  <S size={size}><path d="M20 13.5A8.5 8.5 0 0 1 10.5 4a8.5 8.5 0 1 0 9.5 9.5z" /></S>
)

export const IconDisplay = ({ size = 16 }) => (
  <S size={size}><rect x="3.5" y="5" width="17" height="12" rx="2.5" /><path d="M9.5 20h5M12 17v3" /></S>
)

export const IconHistory = ({ size = 16 }) => (
  <S size={size}><path d="M4.2 12a7.8 7.8 0 1 0 2.4-5.6" /><path d="M3.6 4.9v4.3h4.3" /><path d="M12 8.2v4.2l3 1.8" /></S>
)

export const IconXLogo = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.8 3h3.1l-6.8 7.8L22 21h-6.2l-4.9-5.8L5.4 21H2.2l7.3-8.3L2 3h6.3l4.4 5.3L17.8 3zm-1.1 16.1h1.7L7.4 4.8H5.6l11.1 14.3z" />
  </svg>
)

export const IconInstagramLogo = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="3.5" y="3.5" width="17" height="17" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.1" cy="6.9" r="1.1" fill="currentColor" stroke="none" />
  </svg>
)

export const IconCursor = ({ size = 16 }) => (
  <S size={size}><path d="m3 3 7 17 2.5-7.4L20 10 3 3Z" /></S>
)

export const IconImageTool = ({ size = 16 }) => (
  <S size={size}><rect x="3" y="3" width="18" height="18" rx="2.5" /><circle cx="9" cy="9" r="1.8" /><path d="m21 15.5-3.4-3.4a2 2 0 0 0-2.8 0L6 20.5" /></S>
)

export const IconSticky = ({ size = 16 }) => (
  <S size={size}><path d="M15.5 3H5.5a2.5 2.5 0 0 0-2.5 2.5v13a2.5 2.5 0 0 0 2.5 2.5h9L21 14.5v-9A2.5 2.5 0 0 0 18.5 3h-3Z" /><path d="M14.5 21v-5a1.5 1.5 0 0 1 1.5-1.5h5" /></S>
)

export const IconType = ({ size = 16 }) => (
  <S size={size}><path d="M4 7V4h16v3" /><path d="M9 20h6" /><path d="M12 4v16" /></S>
)

export const IconSquare = ({ size = 16 }) => (
  <S size={size}><rect x="3.5" y="3.5" width="17" height="17" rx="2.5" /></S>
)

export const IconCircle = ({ size = 16 }) => (
  <S size={size}><circle cx="12" cy="12" r="8.5" /></S>
)

export const IconTriangle = ({ size = 16 }) => (
  <S size={size}><path d="m12 3.5 8.5 16h-17L12 3.5Z" /></S>
)

export const IconLine = ({ size = 16 }) => (
  <S size={size}><path d="M5 19 19 5" /></S>
)

export const IconArrowTool = ({ size = 16 }) => (
  <S size={size}><path d="M4 12h14" /><path d="m13 6 6 6-6 6" /></S>
)

export const IconFrame = ({ size = 16 }) => (
  <S size={size}><path d="M4.5 8.5h15M4.5 15.5h15M8.5 4.5v15M15.5 4.5v15" /></S>
)

export const IconMinus = ({ size = 16 }) => (
  <S size={size}><path d="M5 12h14" /></S>
)

export const IconFit = ({ size = 16 }) => (
  <S size={size}><path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /></S>
)

export const IconElbow = ({ size = 16 }) => (
  <S size={size}><path d="M5 6h7a4 4 0 0 1 4 4v8" /><path d="m12.5 15 3.5 3.5L19.5 15" /></S>
)

export const IconToFront = ({ size = 16 }) => (
  <S size={size}><path d="M12 19V7" /><path d="m6.5 12.5 5.5-5.5 5.5 5.5" /><path d="M5 3.5h14" /></S>
)

export const IconToBack = ({ size = 16 }) => (
  <S size={size}><path d="M12 5v12" /><path d="m6.5 11.5 5.5 5.5 5.5-5.5" /><path d="M5 20.5h14" /></S>
)

export const IconLock = ({ size = 16 }) => (
  <S size={size}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /></S>
)

export const IconUnlock = ({ size = 16 }) => (
  <S size={size}><rect x="4.5" y="10.5" width="15" height="10" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 7.5-2" /></S>
)


export const IconEraser = ({ size = 16 }) => (
  <S size={size}><path d="m7 21-4.3-4.3a2.5 2.5 0 0 1 0-3.5l9.6-9.6a2.5 2.5 0 0 1 3.5 0l5.6 5.6a2.5 2.5 0 0 1 0 3.5L13 21" /><path d="M22 21H7" /><path d="m5 11 9 9" /></S>
)
