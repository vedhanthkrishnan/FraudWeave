import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowRight,
  Bookmark,
  Download,
  LoaderCircle,
  MessageSquare,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import {
  API_BASE_URL,
  askCopilot,
  downloadReport,
  getEvidence,
  getGraph,
  getModelStatus,
  getTimeline,
  getTransaction,
  listTransactions,
} from './api'
import type {
  Evidence,
  EvidenceSource,
  GraphData,
  ModelStatus,
  Neighbor,
  Transaction,
} from './api'
const LiveGraph = lazy(() => import('./LiveGraph'))
const NeighborChart = lazy(() =>
  import('./Charts').then((module) => ({ default: module.NeighborChart })),
)
const TimelineChart = lazy(() =>
  import('./Charts').then((module) => ({ default: module.TimelineChart })),
)
import './investigation.css'

type Case = { id: string; label: string; saved: string; notes: string }
type Message = {
  question: string
  answer: string
  sources: EvidenceSource[]
  tools: string[]
  trace?: { transaction_id: string; tool: string; reason: string; depth: number }[]
  findings?: { transaction_id: string; path: string[]; edges: { source: string; target: string }[] }[]
}
const STORAGE_KEY = 'fraudweave.cases.v1'
const labelName = (label: string) => label.replaceAll('_', ' ')
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'Something went wrong. Please retry.'

function readCases(): Case[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (item): item is Case =>
          item &&
          typeof item.id === 'string' &&
          /^\d{1,20}$/.test(item.id) &&
          typeof item.notes === 'string' &&
          typeof item.saved === 'string' &&
          typeof item.label === 'string',
      )
      .slice(0, 50)
  } catch {
    return []
  }
}

export default function InvestigationWorkspace({
  activeNav,
  seedId,
  requestedId,
  selectionKey,
  refreshKey,
  onSelection,
}: {
  activeNav: string
  seedId: string
  requestedId: string
  selectionKey: number
  refreshKey: number
  onSelection: (data: Evidence | null) => void
}) {
  const [copilotOpen, setCopilotOpen] = useState(false)
  const [immersive, setImmersive] = useState(false)
  const assistantTrigger = useRef<HTMLButtonElement>(null)
  const [id, setId] = useState(seedId)
  const [attempt, setAttempt] = useState(0)
  const [input, setInput] = useState(seedId)
  const [depth, setDepth] = useState(1)
  const [nodeLimit, setNodeLimit] = useState(80)
  const [data, setData] = useState<Evidence | null>(null)
  const [transaction, setTransaction] = useState<Transaction | null>(null)
  const [graph, setGraph] = useState<GraphData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [model, setModel] = useState<ModelStatus | null>(null)
  const [timeline, setTimeline] = useState<
    Awaited<ReturnType<typeof getTimeline>>['steps']
  >([])
  const [analyticsError, setAnalyticsError] = useState('')
  const [suggestions, setSuggestions] = useState<Neighbor[]>([])
  const [suggestionLabel, setSuggestionLabel] = useState('all')
  const [cases, setCases] = useState<Case[]>(readCases)
  const [notes, setNotes] = useState('')
  const [notice, setNotice] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [asking, setAsking] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [format, setFormat] = useState<'markdown' | 'json' | 'html'>('markdown')
  const requestNumber = useRef(0)
  const selection = useRef(onSelection)
  const savedCases = useRef(cases)
  const loadedId = useRef('')
  const currentId = useRef(id)
  useEffect(() => {
    currentId.current = id
  }, [id])
  useEffect(() => {
    selection.current = onSelection
  }, [onSelection])
  useEffect(() => {
    savedCases.current = cases
  }, [cases])

  const selectTransaction = useCallback((next: string) => {
    setId(next)
    setInput(next)
    setAttempt((value) => value + 1)
    setNotice('')
    setMessages([])
  }, [])

  useEffect(() => {
    if (selectionKey > 0) void Promise.resolve().then(() => selectTransaction(requestedId))
  }, [requestedId, selectionKey, selectTransaction])
  useEffect(() => {
    if (!copilotOpen) return
    document.getElementById('copilot-question')?.focus()
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setCopilotOpen(false); assistantTrigger.current?.focus() } }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [copilotOpen])
  useEffect(() => {
    let alive = true
    const number = ++requestNumber.current
    // Start the asynchronous load after mounting; no stale results can replace a newer selection.
    void Promise.resolve().then(async () => {
      if (!alive) return
      setLoading(true)
      setError('')
      setGraph(null)
      setData(null)
      setTransaction(null)
      selection.current(null)
      try {
        const [evidence, liveGraph, detail] = await Promise.all([
          getEvidence(id),
          getGraph(id, depth, nodeLimit),
          getTransaction(id),
        ])
        if (!alive || number !== requestNumber.current) return
        setData(evidence)
        setGraph(liveGraph)
        setTransaction(detail.transaction)
        if (loadedId.current !== id) {
          setNotes(
            savedCases.current.find((item) => item.id === id)?.notes || '',
          )
          loadedId.current = id
        }
        selection.current(evidence)
      } catch (reason) {
        if (alive && number === requestNumber.current)
          setError(errorText(reason))
      } finally {
        if (alive && number === requestNumber.current) setLoading(false)
      }
    })
    return () => {
      alive = false
    }
  }, [id, depth, nodeLimit, refreshKey, attempt])

  useEffect(() => {
    let alive = true
    void Promise.all([getModelStatus(), getTimeline()])
      .then(([status, history]) => {
        if (alive) {
          setModel(status)
          setTimeline(history.steps)
        }
      })
      .catch((reason) => {
        if (alive) setAnalyticsError(errorText(reason))
      })
    return () => {
      alive = false
    }
  }, [refreshKey])

  useEffect(() => {
    let alive = true
    void listTransactions(suggestionLabel)
      .then((result) => {
        if (alive) setSuggestions(result.transactions)
      })
      .catch((reason) => {
        if (alive) {
          setSuggestions([])
          setNotice(errorText(reason))
        }
      })
    return () => {
      alive = false
    }
  }, [suggestionLabel])

  function persist(next: Case[]) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      setCases(next)
      return true
    } catch {
      setNotice(
        'Browser storage is unavailable. Export the report to keep a copy.',
      )
      return false
    }
  }
  function saveCase() {
    if (!data) return
    if (cases.length >= 50 && !cases.some((item) => item.id === id)) {
      setNotice(
        'The casebook already has 50 investigations. Export or remove an entry before adding another.',
      )
      return
    }
    const item = {
      id,
      label: data.transaction.label,
      saved: new Date().toISOString(),
      notes,
    }
    const next = [item, ...cases.filter((item) => item.id !== id)].slice(0, 50)
    if (persist(next))
      setNotice('Investigation and notes saved in this browser.')
  }
  function exportNotes() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              saved_cases: cases,
              note: 'Analyst notes are unverified opinions, separate from dataset evidence.',
            },
            null,
            2,
          ),
        ],
        { type: 'application/json' },
      ),
    )
    const link = document.createElement('a')
    link.href = url
    link.download = 'fraudweave-casebook.json'
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function ask(prompt = question) {
    if (!prompt.trim() || asking) return
    if (prompt.toLowerCase().includes('multi-hop')) {setImmersive(true);setDepth(3)}
    setAsking(true)
    setQuestion('')
    const context = id
    try {
      const result = await askCopilot(prompt, id)
      if (currentId.current !== context) return
      setMessages((previous) => [
        ...previous.slice(-7),
        {
          question: prompt,
          answer: result.answer,
          sources: result.sources,
          tools: result.tools_used,
          trace: result.trace,
          findings: result.findings,
        },
      ])
    } catch (reason) {
      setNotice(errorText(reason))
    } finally {
      setAsking(false)
    }
  }
  async function exportEvidence() {
    setExporting(true)
    try {
      await downloadReport(id, format)
      setNotice(
        'Evidence report downloaded. HTML reports can be opened and printed to PDF. Analyst notes are exported separately from the casebook.',
      )
    } catch (reason) {
      setNotice(errorText(reason))
    } finally {
      setExporting(false)
    }
  }
  const showGraph =
    activeNav === 'Overview' || activeNav === 'Transaction graph'
  const chart = data
    ? [
        {
          label: 'Illicit-labelled',
          count: data.risk.neighbor_labels.illicit_labelled,
          fill: '#cf837c',
        },
        {
          label: 'Licit-labelled',
          count: data.risk.neighbor_labels.licit_labelled,
          fill: '#edebdd',
        },
        {
          label: 'Unknown',
          count: data.risk.neighbor_labels.unknown,
          fill: '#b7a28c',
        },
      ]
    : []

  return (
    <section
      id="investigation-workspace"
      className={`investigation-workspace ${immersive ? 'immersive-workspace' : ''}`}
      aria-label="Investigation workspace"
    >
      <div className="workspace-heading">
        <div>
          <span className="eyebrow">INVESTIGATION WORKSPACE</span>
          <h2>
            {activeNav === 'Overview' ? 'Follow the evidence' : activeNav}
          </h2>
          <p>
            Search a transaction, explore its connections, then review the evidence.
          </p>
        </div>
        <span className="source-badge">
          <ShieldCheck size={14} /> Read-only graph tools
        </span>
      </div>
      <div className="context-toolbar"><span>WORKSPACE TOOLS</span><div><button className="fw-button" aria-pressed={immersive} onClick={() => setImmersive(!immersive)}>{immersive ? 'Exit focus layout' : 'Focus layout'}</button><button ref={assistantTrigger} className="fw-button" aria-expanded={copilotOpen} aria-controls="copilot-panel" onClick={() => setCopilotOpen(!copilotOpen)}><MessageSquare size={14}/> Evidence copilot</button></div></div>
      <form
        className="investigation-search"
        onSubmit={(event) => {
          event.preventDefault()
          if (/^\d{1,20}$/.test(input.trim())) selectTransaction(input.trim())
          else
            setNotice(
              'Enter a numeric Elliptic transaction ID, up to 20 digits.',
            )
        }}
      >
        <label htmlFor="transaction-id">Transaction ID</label>
        <p className="search-guidance" id="transaction-guidance">Start with the loaded example, or enter another Elliptic transaction ID.</p>
        <div className="search-row">
          <div className="search-field">
            <Search size={16} />
            <input
              id="transaction-id"
              aria-describedby="transaction-guidance"
              inputMode="numeric"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Enter transaction ID"
              maxLength={20}
            />
          </div>
          <button className="fw-button gold" type="submit" disabled={loading}>
            Investigate <ArrowRight size={14} />
          </button>
        </div>
      </form>
      <details className="discovery-disclosure">
        <summary>Browse example transactions <span>Choose from the dataset</span></summary>
      <div className="discovery-row">
        <span>Browse dataset</span>
        <select
          aria-label="Browse research label"
          value={suggestionLabel}
          onChange={(event) => setSuggestionLabel(event.target.value)}
        >
          <option value="all">All labels</option>
          <option value="illicit_labelled">Illicit-labelled</option>
          <option value="licit_labelled">Licit-labelled</option>
          <option value="unknown">Unknown</option>
        </select>
        <div className="discovery-items">
          {suggestions.map((item) => (
            <button
              title={labelName(item.label)}
              className="transaction-chip"
              key={item.tx_id}
              onClick={() => selectTransaction(item.tx_id)}
            >
              {item.tx_id}
            </button>
          ))}
        </div>
      </div>
      </details>
      {notice && (
        <div className="fw-notice" role="status">
          {notice}
          <button onClick={() => setNotice('')} aria-label="Dismiss notice">
            ×
          </button>
        </div>
      )}
      {error && (
        <div className="fw-error" role="alert">
          {error}
          <button
            className="fw-button"
            onClick={() => {
              setInput(seedId)
              selectTransaction(seedId)
            }}
          >
            Return to example
          </button>
        </div>
      )}
      {loading && (
        <div className="fw-loading" role="status">
          <div className="loading-skeleton" aria-hidden="true"><i/><i/><i/></div><span>Querying transaction, graph and evidence…</span>
        </div>
      )}

      {showGraph && (
        <article className="fw-panel graph-panel">
          <div className="panel-heading">
            <div>
              <h3>Transaction flow graph</h3>
              <p>
                Click a node to investigate it · drag to move · scroll to zoom
              </p>
            </div>
            <div className="graph-controls">
              <label>
                Depth
                <select
                  aria-label="Graph depth"
                  value={depth}
                  onChange={(event) => setDepth(Number(event.target.value))}
                >
                  {[1, 2, 3].map((value) => (
                    <option key={value} value={value}>
                      {value} hop{value > 1 ? 's' : ''}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Node cap
                <select
                  aria-label="Graph node cap"
                  value={nodeLimit}
                  onChange={(event) => setNodeLimit(Number(event.target.value))}
                >
                  {[20, 80, 150].map((value) => (
                    <option key={value}>{value}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
          <div className="graph-legend">
            <span>◆ Illicit-labelled</span>
            <span>● Licit-labelled</span>
            <span>■ Unknown</span>
            <span>→ Bitcoin flow</span><span>White outline: selected</span><span>Cotton: incoming · rose: outgoing</span>
          </div>
          {graph ? (
            <>
              <Suspense
                fallback={<p className="fw-loading">Loading graph renderer…</p>}
              >
                <LiveGraph data={graph} onSelect={selectTransaction} />
              </Suspense>
              {graph.nodes.length === 1 && (
                <p className="fw-muted">
                  This transaction has no direct neighbors in the imported
                  graph.
                </p>
              )}
              {graph.truncated && (
                <p className="fw-notice">
                  This view reached a traversal limit. Select another node or
                  adjust depth and node cap. Absence from the view does not mean
                  absence of a connection.
                </p>
              )}
            </>
          ) : (
            !loading && (
              <p className="fw-muted">
                Choose an available transaction to display its real connections.
              </p>
            )
          )}
        </article>
      )}

      {data && (
        <>
          <div className="evidence-toolbar">
            <div>
              <span className="eyebrow">SELECTED TRANSACTION</span>
              <h3 className="mono">{id}</h3>
              <p>
                Research label:{' '}
                <strong>{labelName(data.transaction.label)}</strong> · Time step{' '}
                {data.transaction.time_step} of 49
              </p>
            </div>
            <div className="toolbar-actions">
              <button className="fw-button" onClick={saveCase}>
                <Bookmark size={14} /> Save investigation
              </button>
              <select
                aria-label="Report format"
                value={format}
                onChange={(event) =>
                  setFormat(event.target.value as typeof format)
                }
              >
                <option value="markdown">Markdown report</option>
                <option value="json">JSON evidence</option>
                <option value="html">Printable HTML</option>
              </select>
              <button
                className="fw-button gold"
                onClick={() => void exportEvidence()}
                disabled={exporting}
              >
                <Download size={14} /> {exporting ? 'Exporting…' : 'Export'}
              </button>
            </div>
          </div>
          <div className="evidence-grid">
            <article className="fw-panel">
              <div className="panel-heading">
                <div>
                  <h3>Explainable risk indicators</h3>
                  <p>{data.risk.assessment}</p>
                </div>
              </div>
              <div className="indicator-grid">
                {data.risk.indicators.map((item) => (
                  <div className="indicator" key={item.name}>
                    <span>{item.name}</span>
                    <strong>
                      {item.name.includes('coverage')
                        ? `${item.value}%`
                        : item.value}
                    </strong>
                    <p>{item.explanation}</p>
                  </div>
                ))}
              </div>
              <p className="fw-muted">
                Exact one-hop aggregates · {data.risk.unique_neighbors} distinct
                neighbors · Source: FalkorDB
              </p>
              <Suspense
                fallback={<p className="fw-muted">Loading neighbor chart…</p>}
              >
                <NeighborChart data={chart} />
              </Suspense>
              <div className="model-signal">
                <h4>Local classifier · separate from research label</h4>
                {data.risk.model.available ? (
                  <>
                    <div className="model-score">
                      {data.risk.model.score?.toFixed(3)}
                      <span>Classifier score / 0–1</span>
                    </div>
                    <p>
                      Predicted label:{' '}
                      <strong>
                        {labelName(data.risk.model.predicted_label || '')}
                      </strong>
                    </p>
                    <p>
                      Decision threshold:{' '}
                      {data.risk.model.threshold?.toFixed(3)} ·{' '}
                      {data.risk.model.evaluation_context}
                    </p>
                    <p className="fw-muted">
  {data.risk.model.note ||
    'A model score is not a calibrated fraud probability or confidence level.'}
  {' '}The historical label is never overwritten.
</p>
                  </>
                ) : (
                  <p>{data.risk.model.reason}</p>
                )}
              </div>
            </article>
            <article className="fw-panel">
              <div className="panel-heading">
                <div>
                  <h3>Evidence brief</h3>
                  <p>
                    Generated from returned database records and model output
                  </p>
                </div>
              </div>
              <div className="evidence-summary">
                {data.summary.split('\n\n').map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="evidence-sources">
                {data.sources.map((source) => (
                  <a
                    key={source.id}
                    href={`${API_BASE_URL}${source.endpoint}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    [{source.id}] {source.title} ↗
                  </a>
                ))}
              </div>
              <p className="fw-muted">{data.note}</p>
              <label className="notes-label" htmlFor="analyst-notes">
                Analyst notes{' '}
                <span>
                  Separate from database evidence · saved only when you save the
                  investigation
                </span>
              </label>
              <textarea
                id="analyst-notes"
                value={notes}
                maxLength={5000}
                rows={4}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Record your observations and open questions…"
              />
              <details className="feature-details">
                <summary>
                  Inspect stored features (
                  {transaction
                    ? Object.keys(transaction).filter((key) =>
                        /^f\d{3}$/.test(key),
                      ).length
                    : 0}
                  )
                </summary>
                <p className="fw-muted">
                  Anonymized numerical features; no invented descriptions or
                  Bitcoin amounts.
                </p>
                <div className="feature-grid">
                  {transaction &&
                    Object.entries(transaction)
                      .filter(([name]) => /^f\d{3}$/.test(name))
                      .map(([name, value]) => (
                        <div key={name}>
                          <span>{name}</span>
                          <span>{Number(value).toFixed(4)}</span>
                        </div>
                      ))}
                </div>
              </details>
            </article>
          </div>
        </>
      )}

      {(activeNav === 'Risk intelligence' || activeNav === 'Overview') && (
        <article className="fw-panel">
          <div className="panel-heading">
            <div>
              <h3>Model evaluation & dataset context</h3>
              <p>
                Chronological separation: training → validation → untouched test
                period
              </p>
            </div>
          </div>
          {analyticsError && <p className="fw-error">{analyticsError}</p>}
          {model?.available && model.test_metrics ? (
            <>
              <p className="fw-muted">
                {model.algorithm} · train {model.split?.train} · threshold
                selection {model.split?.validation} · test {model.split?.test}
              </p>
              <p className="fw-muted">Model version: {model.version || 'Not reported'} · dataset time-step coverage: {timeline.length} returned steps</p>
              <div className="model-metrics">
                {(
                  ['precision', 'recall', 'f1', 'average_precision'] as const
                ).map((key) => (
                  <div className="indicator" key={key}>
                    <span>{key.replaceAll('_', ' ')}</span>
                    <strong>
                      {(model.test_metrics![key] * 100).toFixed(1)}%
                    </strong>
                  </div>
                ))}
              </div>
              <p className="fw-muted">
                Test records: {model.partitions?.test.records.toLocaleString()}{' '}
                · illicit-labelled test records:{' '}
                {model.partitions?.test.illicit_labelled.toLocaleString()}
              </p>
              <p className="fw-muted">
                Confusion matrix (rows actual, columns predicted; licit then
                illicit): {JSON.stringify(model.test_metrics.confusion_matrix)}
              </p>
              {model.limitations?.map((item) => (
                <p key={item} className="fw-muted">
                  • {item}
                </p>
              ))}
            </>
          ) : (
            <p>{model?.reason || 'Loading model evaluation…'}</p>
          )}
          <h4 className="chart-title">
            Label distribution across historical time steps
          </h4>
          {timeline.length > 0 && (
            <Suspense fallback={<p className="fw-muted">Loading timeline…</p>}>
              <TimelineChart data={timeline} />
            </Suspense>
          )}
        </article>
      )}

      {activeNav === 'Investigations' && (
        <article className="fw-panel">
          <div className="panel-heading">
            <div>
              <h3>Saved investigations ({cases.length})</h3>
              <p>
                Stored in this browser · maximum 50 · not a shared team database
              </p>
            </div>
            <button
              className="fw-button"
              onClick={exportNotes}
              disabled={!cases.length}
            >
              <Download size={14} /> Export casebook
            </button>
          </div>
          {!cases.length && (
            <p className="fw-muted">
              Save a transaction and its notes to begin your casebook.
            </p>
          )}
          <div className="case-list">
            {cases.map((item) => (
              <div className="case-row" key={item.id}>
                <button
                  className="case-open"
                  onClick={() => selectTransaction(item.id)}
                >
                  <strong>{item.id}</strong>
                  <span>
                    {labelName(item.label)} ·{' '}
                    {new Date(item.saved).toLocaleDateString()}
                  </span>
                  <p>{item.notes || 'No analyst notes'}</p>
                </button>
                <button
                  className="fw-button"
                  aria-label={`Remove saved investigation ${item.id}`}
                  onClick={() => {
                    if (
                      window.confirm(
                        `Remove saved investigation ${item.id} and its notes from this browser?`,
                      )
                    )
                      persist(cases.filter((other) => other.id !== item.id))
                  }}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </article>
      )}

      <article id="copilot-panel" className={`fw-panel copilot-panel ${copilotOpen ? 'copilot-open' : ''}`} hidden={!copilotOpen} aria-label="Evidence copilot panel">
        <button className="fw-button copilot-close" onClick={() => {setCopilotOpen(false);assistantTrigger.current?.focus()}}>Close copilot ×</button>
        <div className="panel-heading">
          <div>
            <h3>
              <MessageSquare size={17} /> Investigation copilot
            </h3>
            <p>
              Follow connected evidence with a bounded investigation policy.
              Read-only tools · transparent decisions · no generative LLM
            </p>
          </div>
        </div>
        <div className="copilot-prompts">
          {[
            'Trace multi-hop paths',
            'Summarize this transaction',
            'Explain its risk indicators',
            'Show dataset statistics',
            'Explain model precision and recall',
          ].map((prompt) => (
            <button
              className="transaction-chip"
              key={prompt}
              disabled={asking || loading}
              onClick={() => void ask(prompt)}
            >
              {prompt}
            </button>
          ))}
        </div>
        <div className="copilot-messages" aria-live="polite">
          {messages.map((message, index) => (
            <div className="copilot-message" key={index}>
              <strong>{message.question}</strong>
              <div className="evidence-summary">
                {message.answer.split('\n\n').map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
              <div className="evidence-sources">
                {message.sources.map((source) => (
                  <a
                    key={source.id}
                    href={`${API_BASE_URL}${source.endpoint}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    [{source.id}] {source.title} ↗
                  </a>
                ))}
              </div>
              {message.findings?.map((finding) => (
                <div className="trace-path" key={finding.transaction_id}>
                  <span className="eyebrow">OBSERVED CONNECTION</span>
                  <div>{finding.path.map((tx, i) => <button className="transaction-chip" key={tx} onClick={() => selectTransaction(tx)}>{i > 0 ? '↔ ' : ''}{tx}</button>)}</div>
                  <p className="fw-muted">Actual flow: {finding.edges.map(edge => `${edge.source} → ${edge.target}`).join(' · ')}</p>
                </div>
              ))}
              {!!message.trace?.length && <button className="fw-button" onClick={() => {
                const url = URL.createObjectURL(new Blob([JSON.stringify(message, null, 2)], { type: 'application/json' }))
                const link = document.createElement('a'); link.href = url; link.download = `fraudweave-${id}-trail.json`; link.click()
                window.setTimeout(() => URL.revokeObjectURL(url), 1000)
              }}><Download size={14} /> Export investigation trail</button>}
              {!!message.trace?.length && <details className="trace-details"><summary>Inspect {message.trace.length} investigation decisions</summary><ol>{message.trace.map((step, i) => <li key={i}><strong>{step.transaction_id}</strong><span>Hop {step.depth} · {step.tool}</span><p>{step.reason}</p></li>)}</ol></details>}
              {message.tools.length > 0 && (
                <span className="fw-muted">
                  Tools used: {message.tools.join(' · ')}
                </span>
              )}
            </div>
          ))}
        </div>
        <form
          className="copilot-input"
          onSubmit={(event) => {
            event.preventDefault()
            void ask()
          }}
        >
          <label className="sr-only" htmlFor="copilot-question">
            Ask the evidence assistant
          </label>
          <input
            id="copilot-question"
            placeholder={`Ask about transaction ${id}…`}
            value={question}
            maxLength={600}
            onChange={(event) => setQuestion(event.target.value)}
          />
          <button
            className="fw-button gold"
            disabled={asking || loading || question.trim().length < 3}
          >
            {asking ? <LoaderCircle className="spin" size={15} /> : 'Ask'}
          </button>
        </form>
        <p className="fw-muted">
          This assistant cannot identify owners, prove wrongdoing, or retrieve
          live blockchain activity. Every factual answer links to its data
          sources.
        </p>
      </article>
    </section>
  )
}
