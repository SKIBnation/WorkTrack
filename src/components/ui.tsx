import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react'

const variants = {
  primary: 'bg-gain text-[var(--gain-ink)]',
  solid: 'bg-solid text-[var(--solid-ink)]',
  secondary: 'border border-stroke bg-[var(--field)] text-fg',
  ghost: 'bg-transparent text-fg',
  danger: 'bg-[var(--danger-soft)] text-danger',
} as const

const sizes = {
  large: 'h-14 w-full text-base',
  regular: 'h-10 px-3 text-sm',
} as const

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
  size?: keyof typeof sizes
}

export function Button({ variant = 'primary', size = 'large', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex items-center justify-center rounded-2xl px-4 font-semibold transition active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gain ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-[24px] border border-stroke bg-card p-4 ${className}`}>{children}</section>
}

export function PageHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-center justify-between gap-3">
      <h1 className="text-[32px] font-semibold tracking-tight">{title}</h1>
      {action}
    </header>
  )
}

export function Metric({ label, value, detail, footer }: { label: string; value: string; detail?: string; footer?: string }) {
  return (
    <Card>
      <p className="text-[12px] font-medium uppercase tracking-[0.14em] text-muted">{label}</p>
      <p className="mt-2 text-[22px] font-semibold leading-none tabular-nums">{value}</p>
      {detail && <p className="mt-2 text-[15px] font-medium text-gain tabular-nums">{detail}</p>}
      {footer && <p className="mt-2 text-xs leading-5 text-muted">{footer}</p>}
    </Card>
  )
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0))
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-[var(--track)]"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped * 100)}
    >
      <div className="h-full rounded-full bg-gain" style={{ width: `${clamped * 100}%` }} />
    </div>
  )
}

export function StatusPill({ status }: { status: 'off' | 'working' | 'break' }) {
  const label = status === 'working' ? 'Working' : status === 'break' ? 'On break' : 'Off shift'
  const tone =
    status === 'working'
      ? 'bg-[var(--gain-soft)] text-gain'
      : status === 'break'
        ? 'bg-[var(--amber-soft)] text-amber'
        : 'bg-[var(--field)] text-muted'
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ${tone}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === 'off' ? 'bg-faint' : 'bg-current'}`} />
      {label}
    </span>
  )
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    let startY = 0
    let startX = 0
    let scrollAtStart = 0
    let offset = 0
    let tracking = false
    let dragging = false
    let pointerId = -1

    const blockNextClick = () => {
      const block = (event: Event) => {
        event.preventDefault()
        event.stopPropagation()
        window.clearTimeout(timer)
      }
      document.addEventListener('click', block, { capture: true })
      const timer = window.setTimeout(() => document.removeEventListener('click', block, { capture: true }), 400)
    }

    const snapBack = () => {
      panel.style.transition = 'transform 180ms ease'
      panel.style.transform = ''
      const done = () => {
        panel.style.transition = ''
        panel.removeEventListener('transitionend', done)
      }
      panel.addEventListener('transitionend', done)
    }

    const finish = () => {
      if (!tracking) return
      tracking = false
      if (!dragging) return
      const pulled = offset
      dragging = false
      offset = 0
      blockNextClick()
      if (pulled > 80) {
        panel.style.transition = 'transform 180ms ease'
        panel.style.transform = 'translateY(110%)'
        window.setTimeout(() => onCloseRef.current(), 170)
        return
      }
      snapBack()
    }

    const moveBy = (dy: number, dx: number, prevent: () => void) => {
      if (!tracking) return
      if (!dragging) {
        if (dy < 10 || Math.abs(dx) > dy || scrollAtStart > 0) return
        dragging = true
      }
      prevent()
      offset = dy
      panel.style.transition = ''
      panel.style.transform = `translateY(${dy}px)`
    }

    const onTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      tracking = true
      dragging = false
      offset = 0
      startY = event.touches[0].clientY
      startX = event.touches[0].clientX
      scrollAtStart = panel.scrollTop
    }
    const onTouchMove = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      moveBy(event.touches[0].clientY - startY, event.touches[0].clientX - startX, () => event.preventDefault())
    }

    const onPointerDown = (event: PointerEvent) => {
      if (event.pointerType !== 'mouse' || event.button !== 0) return
      tracking = true
      dragging = false
      offset = 0
      startY = event.clientY
      startX = event.clientX
      scrollAtStart = panel.scrollTop
      pointerId = event.pointerId
    }
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      moveBy(event.clientY - startY, event.clientX - startX, () => {
        if (!panel.hasPointerCapture(event.pointerId)) panel.setPointerCapture(event.pointerId)
      })
    }
    const onPointerUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return
      pointerId = -1
      finish()
    }

    panel.addEventListener('touchstart', onTouchStart, { passive: true })
    panel.addEventListener('touchmove', onTouchMove, { passive: false })
    panel.addEventListener('touchend', finish)
    panel.addEventListener('touchcancel', finish)
    panel.addEventListener('pointerdown', onPointerDown)
    panel.addEventListener('pointermove', onPointerMove)
    panel.addEventListener('pointerup', onPointerUp)
    panel.addEventListener('pointercancel', onPointerUp)
    return () => {
      panel.removeEventListener('touchstart', onTouchStart)
      panel.removeEventListener('touchmove', onTouchMove)
      panel.removeEventListener('touchend', finish)
      panel.removeEventListener('touchcancel', finish)
      panel.removeEventListener('pointerdown', onPointerDown)
      panel.removeEventListener('pointermove', onPointerMove)
      panel.removeEventListener('pointerup', onPointerUp)
      panel.removeEventListener('pointercancel', onPointerUp)
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative max-h-[92dvh] w-full max-w-[480px] overflow-y-auto overscroll-contain rounded-t-[28px] border border-stroke bg-card px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
      >
        <button type="button" aria-label="Close" onClick={onClose} className="sticky top-0 z-10 -mx-5 flex h-8 w-[calc(100%+2.5rem)] items-center justify-center bg-card">
          <span className="h-1.5 w-10 rounded-full bg-[var(--track)]" />
        </button>
        <h2 className="mb-4 text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Confirm({
  title,
  body,
  confirmLabel,
  danger = false,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-5">
      <button className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onCancel} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative w-full max-w-sm rounded-[28px] border border-stroke bg-card p-5">
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted">{body}</p>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}

export const fieldClass = 'w-full rounded-xl bg-[var(--field)] px-3 py-3 text-fg outline-none'
