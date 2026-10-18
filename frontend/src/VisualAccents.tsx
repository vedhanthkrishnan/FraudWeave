import { useState } from 'react'
import { motion, useReducedMotion, useScroll } from 'motion/react'

export function ReadingProgress() {
  const { scrollYProgress } = useScroll()
  return <motion.div aria-hidden="true" className="reading-progress" style={{ scaleX: scrollYProgress }} />
}

export function HeroOrbit() {
  const reduced = useReducedMotion()
  const [paused, setPaused] = useState(false)
  return <div className={`hero-orbit ${paused || reduced ? 'orbit-paused' : ''}`}>
    <svg viewBox="0 0 300 300" aria-hidden="true" focusable="false">
      <g className="orbit-lines" fill="none" stroke="currentColor" strokeWidth="0.8">
        <circle cx="150" cy="150" r="112" />
        <ellipse cx="150" cy="150" rx="112" ry="42" transform="rotate(35 150 150)" />
        <ellipse cx="150" cy="150" rx="112" ry="42" transform="rotate(-35 150 150)" />
        <ellipse cx="150" cy="150" rx="42" ry="112" />
        <path d="M25 150h250M150 25v250" strokeDasharray="2 6" />
        <circle cx="150" cy="38" r="5" fill="currentColor" />
        <circle cx="247" cy="206" r="4" fill="currentColor" />
      </g>
      <circle cx="150" cy="150" r="21" fill="currentColor" />
      <path d="m140 150 7 7 13-14" fill="none" stroke="#edebdd" strokeWidth="2" />
    </svg>
    {!reduced && <button type="button" onClick={() => setPaused(!paused)} aria-pressed={paused}>{paused ? 'Resume visual motion' : 'Pause visual motion'}</button>}
  </div>
}
