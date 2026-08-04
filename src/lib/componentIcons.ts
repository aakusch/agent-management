import {
  Accessibility,
  Bot,
  Bug,
  CircleUserRound,
  Eye,
  FileCheck2,
  GitFork,
  Layers3,
  ScanSearch,
  ShieldCheck,
  TerminalSquare,
  WandSparkles,
  Workflow,
  Zap,
  type LucideIcon,
} from 'lucide-react'

/**
 * The single icon vocabulary for components — the picker, the library shelf, and the canvas node all
 * read it here.
 *
 * Why: three separate maps had drifted apart, so `layers` rendered as a module in the picker and as a
 * generic bot on the canvas. One list means an icon added to the authoring spec works everywhere.
 */
export const componentIconOptions: ReadonlyArray<{ id: string; label: string; Icon: LucideIcon }> = [
  { id: 'wand', label: 'Builder', Icon: WandSparkles },
  { id: 'bot', label: 'Agent', Icon: Bot },
  { id: 'scan', label: 'Review', Icon: ScanSearch },
  { id: 'eye', label: 'Visual', Icon: Eye },
  { id: 'terminal', label: 'Terminal', Icon: TerminalSquare },
  { id: 'split', label: 'Router', Icon: GitFork },
  { id: 'shield', label: 'Safety', Icon: ShieldCheck },
  { id: 'user-check', label: 'Human', Icon: CircleUserRound },
  { id: 'accessibility', label: 'Access', Icon: Accessibility },
  { id: 'bug', label: 'Debug', Icon: Bug },
  { id: 'file-check', label: 'Handoff', Icon: FileCheck2 },
  { id: 'workflow', label: 'Flow', Icon: Workflow },
  { id: 'layers', label: 'Module', Icon: Layers3 },
  { id: 'zap', label: 'Catalyst', Icon: Zap },
]

const byId = new Map(componentIconOptions.map((option) => [option.id, option.Icon]))
// `module` is the legacy alias for `layers`, still present in assets written by earlier builds.
byId.set('module', Layers3)

export const iconFor = (icon: string): LucideIcon => byId.get(icon) ?? Bot

/** Accent palette shared by the component creator, the module composer, and every card. */
export const componentColors = ['mint', 'blue', 'violet', 'amber', 'coral', 'rose', 'cyan'] as const

/** The icon a role defaults to when an author has not picked one. */
export const iconForKind = (kind: string) => ({
  router: 'split', tool: 'terminal', human: 'user-check', judge: 'scan', module: 'layers', workflow: 'workflow', catalyst: 'zap',
}[kind] ?? 'bot')
