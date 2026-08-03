import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Accessibility,
  Bot,
  Bug,
  ChevronDown,
  CircleUserRound,
  Eye,
  FileCheck2,
  GitFork,
  PanelLeftClose,
  Plus,
  ScanSearch,
  Search,
  ShieldCheck,
  TerminalSquare,
  Zap,
  WandSparkles,
  Workflow,
} from 'lucide-react'
import type { ComponentTemplate } from '../types/workflow'

const icons = {
  wand: WandSparkles,
  bot: Bot,
  shield: ShieldCheck,
  accessibility: Accessibility,
  bug: Bug,
  scan: ScanSearch,
  eye: Eye,
  terminal: TerminalSquare,
  split: GitFork,
  'user-check': CircleUserRound,
  'file-check': FileCheck2,
  workflow: Workflow,
  zap: Zap,
} as const

interface LibraryProps {
  components: ComponentTemplate[]
  onAdd: (template: ComponentTemplate) => void
  onCollapse: () => void
  onNewComponent: () => void
}

export function Library({ components, onAdd, onCollapse, onNewComponent }: LibraryProps) {
  const [query, setQuery] = useState('')
  const searchRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState<Record<string, boolean>>({
    Agents: true,
    Logic: true,
    'Tools & people': true,
    Entrypoints: true,
    Workflows: true,
  })

  const filtered = useMemo(() => {
    const normalized = query.toLowerCase().trim()
    if (!normalized) return components
    return components.filter((item) =>
      `${item.name} ${item.description} ${item.tags.join(' ')}`.toLowerCase().includes(normalized),
    )
  }, [components, query])

  const sections = [
    { label: 'Agents', items: filtered.filter((item) => ['agent', 'judge'].includes(item.kind)) },
    { label: 'Logic', items: filtered.filter((item) => item.kind === 'router') },
    { label: 'Tools & people', items: filtered.filter((item) => ['tool', 'human'].includes(item.kind)) },
    { label: 'Entrypoints', items: filtered.filter((item) => item.kind === 'catalyst') },
    { label: 'Workflows', items: filtered.filter((item) => item.kind === 'workflow') },
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
        {sections.map((section) => (
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
              {section.items.map((component) => {
              const Icon = icons[component.icon as keyof typeof icons] ?? Bot
              return (
                <button
                  className="library-item"
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
        {filtered.length === 0 && <div className="empty-search">No components found.</div>}
      </div>

      <button className="new-component-button" onClick={onNewComponent}>
        <Plus size={15} /> New Markdown component
      </button>
    </aside>
  )
}
