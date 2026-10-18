import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import './scroll-cover.css'

export default function ScrollCover() {
  const section = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: section, offset: ['start start', 'end end'] })
  const scale = useTransform(scrollYProgress, [0, 1], [1, .82])
  const titleScale = useTransform(scrollYProgress, [0, 1], [1, .72])
  const orbitScale = useTransform(scrollYProgress, [0, 1], [.8, 1.6])
  const rotate = useTransform(scrollYProgress, [0, 1], [-18, 35])
  const x = useTransform(scrollYProgress, [0, 1], ['6%', '-16%'])
  const enter = () => {
    const workspace = document.getElementById('workspace-shell')
    workspace?.focus({ preventScroll: true })
    workspace?.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth' })
  }
  return <section ref={section} className={`scroll-cover ${reduced ? 'cover-static' : ''}`} aria-label="FraudWeave introduction">
    <div className="cover-pin">
      <motion.div className="cover-scene" style={{ scale: reduced ? 1 : scale }}>
        <div className="cover-top"><span>FW / FRAUDWEAVE</span><button onClick={enter}>Enter workspace <span aria-hidden="true">↗</span></button></div>
        <motion.svg className="cover-art" viewBox="0 0 600 600" aria-hidden="true" style={{ scale: reduced ? 1 : orbitScale, rotate: reduced ? 0 : rotate }}>
          <g fill="none" stroke="currentColor" strokeWidth="1">
            {Array.from({length:12},(_,i)=><ellipse key={i} cx="300" cy="300" rx={90+i*14} ry={240-i*9} transform={`rotate(${i*15} 300 300)`}/>)}
            <circle cx="300" cy="60" r="7" fill="currentColor"/><circle cx="90" cy="390" r="5" fill="currentColor"/>
          </g>
        </motion.svg>
        <motion.div className="cover-title" style={{ scale: reduced ? 1 : titleScale }}>
          <p>BITCOIN TRANSACTION INTELLIGENCE</p>
          <h1>Follow the <em>connection.</em><br/>Find the <em>context.</em></h1>
          <div className="cover-description">A connected view of transactions, research labels,<br/>and the evidence between them.</div>
        </motion.div>
        <motion.div className="cover-wordmark" aria-hidden="true" style={{ x: reduced ? 0 : x }}>TRACE. CONNECT. UNDERSTAND.</motion.div>
        <div className="cover-bottom"><span>01 / EXPLORE THE CONNECTIONS</span><span>Scroll to investigate ↓</span><span>POWERED BY FALKORDB</span></div>
      </motion.div>
    </div>
  </section>
}
