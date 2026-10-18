import { useEffect, useState } from 'react'
import { Database, Cpu, Activity, ExternalLink } from 'lucide-react'
import { API_BASE_URL, getHealth, getModelStatus, getTimeline } from './api'
import type { ModelStatus } from './api'

export default function SystemPanel({ refreshKey }: { refreshKey: number }) {
  const [state, setState] = useState<{connected:boolean; model:ModelStatus; steps:number; checked:string} | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active=true
    void Promise.all([getHealth(),getModelStatus(),getTimeline()]).then(([health,model,timeline]) => {
      if(active) {setState({connected:health.database.connected,model,steps:timeline.steps.length,checked:new Date().toLocaleTimeString()});setError('')}
    }).catch((reason:unknown)=>{if(active){setState(null);setError(reason instanceof Error ? reason.message : 'System unavailable')}})
    return ()=>{active=false}
  },[refreshKey])
  return <section className="system-view" aria-label="System status"><span className="eyebrow">ENVIRONMENT / SERVICE HEALTH</span><h2>Know your data. Trust your tools.</h2><p>Historical research environment · explicit refresh · no streaming blockchain feed</p>
    {error && <div className="fw-error" role="alert">{error} Use Refresh data to retry.</div>}
    {!state && !error && <p role="status">Checking backend, model and dataset…</p>}
    {state && <><div className="system-grid">
      <article className="fw-panel"><Database/><h3>Graph database</h3><strong>{state.connected ? 'Connected' : 'Unavailable'}</strong><p>FalkorDB · read-only investigation tools</p></article>
      <article className="fw-panel"><Cpu/><h3>Local classifier</h3><strong>{state.model.available ? 'Available' : 'Unavailable'}</strong><p>{state.model.algorithm || state.model.reason}</p><p>Version: {state.model.version || 'Not reported'}</p></article>
      <article className="fw-panel"><Activity/><h3>Dataset coverage</h3><strong>{state.steps} time steps</strong><p>Elliptic historical research records · CC BY-NC-ND 4.0</p></article>
    </div><p className="fw-muted">Last successful check: {state.checked}</p></>}
    <article className="fw-panel"><h3>Service references</h3><div className="system-links">{['/docs','/api/health','/api/stats','/api/models/status'].map(path=><a className="fw-button" href={API_BASE_URL+path} key={path} target="_blank" rel="noreferrer">{path}<ExternalLink size={13}/></a>)}</div><p className="fw-muted">Saved investigations and analyst notes reside in this browser. Shared cases, authentication and live blockchain ingestion require backend capabilities.</p></article>
  </section>
}
