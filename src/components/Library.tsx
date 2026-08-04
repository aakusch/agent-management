import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, PanelLeftClose, Plus, Search } from 'lucide-react'
import { iconFor } from '../lib/componentIcons'
import type { ComponentTemplate } from '../types/workflow'

interface LibraryProps {
  components: ComponentTemplate[]
  onAdd: (template: ComponentTemplate) => void
  onCollapse: () => void
  onNewComponent: () => void
  onNewModule?: () => void
  /** 'module' authoring cannot nest modules or workflows, so those shelves are dropped entirely. */
  variant?: 'workflow' | 'module'
}

export function Library({ components, onAdd, onCollapse, onNewComponent, onNewModule, variant = 'workflow' }: LibraryProps) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({
    Entrypoints: true,
    Modules: true,
    Agents: true,
    Logic: true,
    'Tools & people': true,
    Workflows: true,
  })

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return components
    return components.filter((item) =>
      `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(normalized),
    )
  }, [components, query])

  // Why: Modules and Workflows stay listed even when empty — they are how a workspace grows, and a
  // missing section reads as a missing feature rather than an empty shelf.
  const composition = variant === 'workflow'
    ? [
      { label: 'Modules', items: filtered.filter((item) => item.kind === 'module'), empty: 'No modules yet. Compose components into one reusable step.', action: onNewModule && { label: 'New module', run: onNewModule } },
    ]
    : []
  const nested = variant === 'workflow'
    ? [{ label: 'Workflows', items: filtered.filter((item) => item.kind === 'workflow'), empty: 'No saved workflows yet. Save one to nest it inside another.' }]
    : []
  const sections: Array<{ label: string; items: ComponentTemplate[]; empty?: string; action?: { label: string; run: () => void } | undefined }> = [
    { label: 'Entrypoints', items: filtered.filter((item) => item.kind === 'catalyst') },
    ...composition,
    { label: 'Agents', items: filtered.filter((item) => ['agent', 'judge'].includes(item.kind)) },
    { label: 'Logic', items: filtered.filter((item) => item.kind === 'router') },
    { label: 'Tools & people', items: filtered.filter((item) => ['tool', 'human'].includes(item.kind)) },
    ...nested,
  ]

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  return (
    <aside className="library-panel">
      <div className="library-titlebar">
        <div>
          <span className="eyebrow">Workspace</span>
          <h2>Components</h2>
        </div>
        <button className="icon-button" onClick={onCollapse} aria-label="Collapse component library">
          <PanelLeftClose size={17} />
        </button>
      </div>

      <label className="search-box">
        <Search size={15} />
        <input ref={searchRef} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search components" aria-label="Search components" />
        <kbd>⌘K</kbd>
      </label>

      <div className="library-scroll">
        {sections.filter((section) => section.items.length || (!query.trim() && section.empty)).map((section) => (
          <section className="library-section" key={section.label}>
            <button
              className="section-heading"
              aria-expanded={open[section.label]}
              aria-controls={`library-section-${section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
              onClick={() => setOpen((current) => ({ ...current, [section.label]: !current[section.label] }))}
            >
              <span>{section.label}</span>
              <ChevronDown className={open[section.label] ? '' : 'collapsed'} size={15} />
            </button>
            {open[section.label] && <div id={`library-section-${section.label.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
              {!section.items.length && section.empty && <div className="library-section-empty"><span>{section.empty}</span>{section.action && <button onClick={section.action.run}><Plus size={12} /> {section.action.label}</button>}</div>}
              {section.items.map((component) => {
              const Icon = iconFor(component.icon)
              return (
                <button
                  className={`library-item kind-${component.kind}`}
                  key={component.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData('application/relay-component', component.id)
                    event.dataTransfer.effectAllowed = 'copy'
                  }}
                  onClick={() => onAdd(component)}
                  title={`Add ${component.name} to the canvas`}
                >
                  <span className={`library-icon tone-${component.color}`}><Icon size={16} /></span>
                  <span className="library-copy">
                    <strong>{component.name}</strong>
                    <small>{component.description}</small>
                  </span>
                  <Plus className="library-add" size={15} />
                </button>
              )
              })}
            </div>}
          </section>
        ))}
        {query.trim() && filtered.length === 0 && <div className="empty-search">No components found.</div>}
      </div>

      <button className="new-component-button" onClick={onNewComponent}>
        <Plus size={15} /> New Markdown component
      </button>
    </aside>
  )
}
