import { useEffect, useState } from 'react'
import { IconClose } from './Icons.jsx'
import { SECTIONS } from './SettingsPanels.jsx'

export default function SettingsModal({ section, setSection, onClose, settings, setSettings, data }) {
  const [version, setVersion] = useState('0.1.0')

  useEffect(() => {
    window.gather?.info?.().then((info) => {
      if (info?.version) setVersion(info.version)
    })
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.querySelector('.keycaps.rec')) return
      onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const active = SECTIONS.find((s) => s.id === section) || SECTIONS[0]
  const Panel = active.view

  return (
    <div
      className="set-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="set-modal" role="dialog" aria-modal="true" aria-label="Settings">
        <aside className="set-nav scroll">
          <div className="set-nav-title">Settings</div>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              data-section={s.id}
              className={`set-nav-item ${s.id === active.id ? 'active' : ''}`}
              onClick={() => setSection(s.id)}
            >
              <span className="set-nav-ic">{s.icon}</span>
              {s.label}
            </button>
          ))}
        </aside>

        <section className="set-content scroll" data-pane={active.id}>
          <button className="set-close" title="Close settings" onClick={onClose}>
            <IconClose size={18} />
          </button>
          <Panel
            settings={settings}
            setSettings={setSettings}
            version={version}
            {...data}
          />
        </section>
      </div>
    </div>
  )
}
