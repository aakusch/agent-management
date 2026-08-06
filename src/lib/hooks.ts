import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Closes a menu on an outside press or Escape, and hands back the ref that marks what is "inside".
 *
 * Why shared: the workspace header and the management header each carried their own copy of these
 * listeners, and only one of them was taught to release them on unmount.
 */
export function useDismissOnOutside<T extends HTMLElement>(open: boolean, onDismiss: () => void) {
  const container = useRef<T>(null)
  const dismiss = useRef(onDismiss)
  dismiss.current = onDismiss

  useEffect(() => {
    if (!open) return
    const closeOnOutsidePress = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) dismiss.current()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss.current()
    }
    document.addEventListener('pointerdown', closeOnOutsidePress)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePress)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [open])

  return container
}

export interface Toast {
  message: string
  tone: 'success' | 'error'
}

/** A single transient status message, cleared on a timer and on unmount. */
export function useToast(durationMs = 3200) {
  const [toast, setToast] = useState<Toast | null>(null)
  const timer = useRef<number | null>(null)

  const showToast = useCallback((message: string, tone: Toast['tone'] = 'success') => {
    if (timer.current) window.clearTimeout(timer.current)
    setToast({ message, tone })
    timer.current = window.setTimeout(() => setToast(null), durationMs)
  }, [durationMs])

  useEffect(() => () => {
    if (timer.current) window.clearTimeout(timer.current)
  }, [])

  return { toast, showToast }
}
