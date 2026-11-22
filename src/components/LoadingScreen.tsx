import { useEffect, useRef } from 'react'

const LETTERS = [...'WorkTrack']
const TICKS = Array.from({ length: 60 }, (_, index) => {
  const angle = (index / 60) * Math.PI * 2 - Math.PI / 2
  const hour = index % 5 === 0
  const inner = hour ? 64 : 70
  const outer = 76
  return {
    hour,
    x1: 100 + Math.cos(angle) * inner,
    y1: 100 + Math.sin(angle) * inner,
    x2: 100 + Math.cos(angle) * outer,
    y2: 100 + Math.sin(angle) * outer,
  }
})

const INTRO_MS = 2500

export function LoadingScreen({ onDone }: { onDone: () => void }) {
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const ringRef = useRef<SVGCircleElement>(null)
  const handRef = useRef<SVGLineElement>(null)
  const hubRef = useRef<SVGCircleElement>(null)
  const tickRefs = useRef<Array<SVGLineElement | null>>([])
  const letterRefs = useRef<Array<HTMLSpanElement | null>>([])

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const started = performance.now()
    let frame = 0

    const paint = (elapsed: number) => {
      const appear = ease(span(elapsed, 0, 280))
      const sweep = reduce ? 1 : ease(span(elapsed, 280, 1500))
      const settle = reduce ? 1 : ease(span(elapsed, 1500, 1900))
      const shown = reduce ? 1 : appear

      const ring = ringRef.current
      if (ring) {
        ring.setAttribute('stroke-dashoffset', String(490 * (1 - settle * shown)))
        ring.setAttribute('opacity', String(shown))
      }

      tickRefs.current.forEach((tick, index) => {
        if (!tick) return
        const passed = sweep >= index / 60
        tick.setAttribute('stroke', passed ? '#30d158' : 'rgba(255,255,255,0.55)')
        tick.setAttribute('opacity', String((passed ? 1 : 0.22) * shown * (1 - settle * 0.85)))
      })

      const hand = handRef.current
      if (hand) {
        hand.setAttribute('opacity', String(shown * (1 - settle)))
        hand.setAttribute('transform', `rotate(${sweep * 360} 100 100)`)
      }

      const hub = hubRef.current
      if (hub) {
        hub.setAttribute('opacity', String(shown * (0.25 + settle * 0.75)))
        hub.setAttribute('transform', `translate(100 100) scale(${0.4 + settle * 0.6}) translate(-100 -100)`)
      }

      letterRefs.current.forEach((letter, index) => {
        if (!letter) return
        const rise = reduce ? 1 : ease(span(elapsed, 1650 + index * 55, 1900 + index * 55))
        letter.style.opacity = String(rise)
        letter.style.transform = `translateY(${(1 - rise) * 14}px)`
      })
    }

    if (reduce) {
      paint(INTRO_MS)
      const timer = window.setTimeout(() => onDoneRef.current(), 400)
      return () => window.clearTimeout(timer)
    }

    const step = (now: number) => {
      const elapsed = now - started
      paint(elapsed)
      if (elapsed >= INTRO_MS) {
        onDoneRef.current()
        return
      }
      frame = window.requestAnimationFrame(step)
    }
    frame = window.requestAnimationFrame(step)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <div className="mx-auto flex h-dvh max-w-[480px] flex-col items-center justify-center bg-black text-white" role="status" aria-label="WorkTrack">
      <svg viewBox="0 0 200 200" width="168" height="168" aria-hidden="true">
        <circle ref={ringRef} cx="100" cy="100" r="78" fill="none" stroke="#30d158" strokeWidth="1.5" strokeLinecap="round" strokeDasharray="490" strokeDashoffset="490" opacity="0" transform="rotate(-90 100 100)" />
        {TICKS.map((tick, index) => (
          <line
            key={index}
            ref={(node) => {
              tickRefs.current[index] = node
            }}
            x1={tick.x1}
            y1={tick.y1}
            x2={tick.x2}
            y2={tick.y2}
            strokeLinecap="round"
            strokeWidth={tick.hour ? 2.4 : 1.3}
            opacity="0"
          />
        ))}
        <line ref={handRef} x1="100" y1="100" x2="100" y2="38" stroke="#30d158" strokeWidth="2" strokeLinecap="round" opacity="0" />
        <circle ref={hubRef} cx="100" cy="100" r="4" fill="#30d158" opacity="0" />
      </svg>
      <p className="mt-[26px] flex h-[34px] text-[32px] leading-none font-semibold tracking-[-0.045em]">
        {LETTERS.map((letter, index) => (
          <span
            key={`${letter}-${index}`}
            ref={(node) => {
              letterRefs.current[index] = node
            }}
            className="inline-block opacity-0"
          >
            {letter}
          </span>
        ))}
      </p>
    </div>
  )
}

function ease(value: number): number {
  return value < 0.5 ? 2 * value * value : 1 - (-2 * value + 2) ** 2 / 2
}

function span(time: number, start: number, end: number): number {
  return Math.min(1, Math.max(0, (time - start) / (end - start)))
}
