

import { useCallback, useEffect, useMemo, useState } from 'react'
import InvestigationWorkspace from './InvestigationWorkspace'
import { motion } from 'motion/react'
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Command,
  Fingerprint,
  GitBranch,
  LayoutDashboard,
  Network,
  Search,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Target,
  Waypoints,
  RefreshCw,
  Database,
  AlertTriangle,
  Clock3,
  ExternalLink,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import {
  getHealth,
  getStats,
  API_BASE_URL,
  type Evidence,
  type FraudWeaveStats,
  type Neighbor,
  type Transaction,
} from './api'

const SAMPLE_TX_ID = '230425980'

type ApiStatus = 'checking' | 'connected' | 'error'

type DirectedNeighbor = Neighbor & {
  direction: 'Incoming' | 'Outgoing'
}

const navItems: { label: string; icon: LucideIcon }[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Transaction graph', icon: Network },
  { label: 'Investigations', icon: Fingerprint },
  { label: 'Risk intelligence', icon: ShieldAlert },
]

function formatNumber(value: number | undefined): string {
  return typeof value === 'number'
    ? value.toLocaleString('en-IN')
    : '—'
}

function labelName(label: string | undefined): string {
  if (label === 'illicit_labelled') return 'Illicit-labelled'
  if (label === 'licit_labelled') return 'Licit-labelled'
  if (label === 'unknown') return 'Unknown'
  return 'Unavailable'
}

function labelStyle(label: string | undefined): string {
  if (label === 'illicit_labelled') {
    return 'text-rose-300 bg-rose-400/10'
  }
  if (label === 'licit_labelled') {
    return 'text-emerald-300 bg-emerald-400/10'
  }
  return 'text-amber-200 bg-amber-300/10'
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.19em] text-slate-400">
        {children}
      </h2>
    </div>
  )
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  accent,
  delay,
}: {
  label: string
  value: string
  detail: string
  icon: LucideIcon
  accent: string
  delay: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay }}
      whileHover={{
        y: -4,
        borderColor: 'rgba(214,184,120,0.32)',
      }}
      className="group rounded-xl border border-white/[0.075] bg-[#10151e] p-5 transition-colors"
    >
      <div className="mb-5 flex items-start justify-between">
        <span className="text-[12px] text-slate-400">{label}</span>
        <span className={`rounded-lg border border-white/[0.06] bg-white/[0.025] p-2 ${accent}`}>
          <Icon size={16} strokeWidth={1.7} />
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <span className="text-2xl font-semibold tracking-tight text-[#f3f0e8] sm:text-[29px]">
          {value}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-1.5 text-[10px] text-slate-500">
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
        {detail}
      </div>
    </motion.div>
  )
}

function LabelDistribution({ stats }: { stats: FraudWeaveStats | null }) {
  const items = [
    {
      label: 'Illicit-labelled',
      count: stats?.labels.illicit_labelled ?? 0,
      color: 'bg-rose-400',
      text: 'text-rose-300',
    },
    {
      label: 'Licit-labelled',
      count: stats?.labels.licit_labelled ?? 0,
      color: 'bg-emerald-400',
      text: 'text-emerald-300',
    },
    {
      label: 'Unknown',
      count: stats?.labels.unknown ?? 0,
      color: 'bg-amber-300',
      text: 'text-amber-200',
    },
  ]

  const total = stats?.total_transactions ?? 0

  return (
    <div className="rounded-xl border border-white/[0.07] bg-[#10151e] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[11px] text-slate-400">Dataset label distribution</div>
          <div className="mt-2 text-2xl font-semibold tracking-tight text-[#f3f0e8]">
            {formatNumber(total)}
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            Research dataset records
          </div>
        </div>
        <div className="rounded-lg border border-[#d6b878]/15 bg-[#d6b878]/[0.06] p-2.5 text-[#d6b878]">
          <Activity size={17} />
        </div>
      </div>

      <div className="mt-6 space-y-4">
        {items.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0

          return (
            <div key={item.label}>
              <div className="mb-2 flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-400">{item.label}</span>
                <span className={item.text}>
                  {formatNumber(item.count)}
                  <span className="ml-1 text-slate-500">
                    ({percentage.toFixed(1)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.7 }}
                  className={`h-full rounded-full ${item.color}`}
                />
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-slate-500">
        <CircleHelp size={13} className="mt-0.5 shrink-0" />
        Dataset labels are research annotations, not independent proof of
        criminal activity.
      </div>
    </div>
  )
}

function App() {
  const [activeNav, setActiveNav] = useState('Overview')
  const [search, setSearch] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('All records')
  const [showAlerts, setShowAlerts] = useState(false)

  const [stats, setStats] = useState<FraudWeaveStats | null>(null)
  const [apiStatus, setApiStatus] = useState<ApiStatus>('checking')
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null)
  const [neighbors, setNeighbors] = useState<DirectedNeighbor[]>([])
  const [workspaceRefresh, setWorkspaceRefresh] = useState(0)

  const loadData = async () => {
    try {
      const [health, liveStats] = await Promise.all([
        getHealth(),
        getStats(),
      ])

      if (
        health.database.connected &&
        liveStats.status === 'success'
      ) {
        setStats(liveStats)
        setApiStatus('connected')
        setLastUpdated(new Date())
      } else {
        setApiStatus('error')
      }
    } catch {
      setStats(null)
      setApiStatus('error')
    } finally {
      setRefreshing(false)
    }
  }

  const loadSampleTransaction = () => setWorkspaceRefresh(value => value + 1)
  const onSelection = useCallback((evidence: Evidence | null) => {
    if (!evidence) { setSelectedTransaction(null); setNeighbors([]); return }
    setSelectedTransaction(evidence.transaction)
    setNeighbors([
      ...evidence.neighbors.incoming.map(item => ({ ...item, direction: 'Incoming' as const })),
      ...evidence.neighbors.outgoing.map(item => ({ ...item, direction: 'Outgoing' as const })),
    ])
  }, [])

  useEffect(() => {
    const initialRefresh = window.setTimeout(() => { void loadData() }, 0)

    const interval = window.setInterval(() => {
      void loadData()
    }, 30000)

    return () => { window.clearTimeout(initialRefresh); window.clearInterval(interval) }
  }, [])

  const transactionRows = useMemo(() => {
    const rows = [
      ...(selectedTransaction
        ? [{
            tx_id: selectedTransaction.tx_id,
            label: selectedTransaction.label,
            time_step: selectedTransaction.time_step,
            direction: 'Selected transaction',
          }]
        : []),
      ...neighbors,
    ]

    const query = search.trim().toLowerCase()

    return rows.filter((row) => {
      const matchesSearch =
        row.tx_id.toLowerCase().includes(query) ||
        labelName(row.label).toLowerCase().includes(query)

      const matchesFilter =
        selectedFilter === 'All records' ||
        (selectedFilter === 'Illicit-labelled' &&
          row.label === 'illicit_labelled') ||
        (selectedFilter === 'Licit-labelled' &&
          row.label === 'licit_labelled') ||
        (selectedFilter === 'Unknown' && row.label === 'unknown')

      return matchesSearch && matchesFilter
    })
  }, [selectedTransaction, neighbors, search, selectedFilter])

  const apiConnected = apiStatus === 'connected'

  return (
    <div className="min-h-screen bg-[#080b12] text-[#f3f0e8]">
      <div className="flex min-h-screen">
        <aside className="sticky top-0 hidden h-screen w-[232px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.07] bg-[#0b0f17] lg:flex">
          <div className="flex h-[76px] items-center gap-3 border-b border-white/[0.07] px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#d6b878]/30 bg-[#d6b878]/[0.08] text-[#d6b878]">
              <Waypoints size={20} strokeWidth={1.6} />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-[0.04em]">
                FRAUD<span className="text-[#d6b878]">WEAVE</span>
              </div>
              <div className="mt-0.5 text-[9px] uppercase tracking-[0.2em] text-slate-500">
                On-chain intelligence
              </div>
            </div>
          </div>

          <div className="px-4 pt-7">
            <div className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              Workspace
            </div>
            <nav className="space-y-1">
              {navItems.map(({ label, icon: Icon }) => (
                <button
                  key={label}
                  aria-current={activeNav === label ? 'page' : undefined}
                  onClick={() => setActiveNav(label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[12px] transition-all ${
                    activeNav === label
                      ? 'border border-[#d6b878]/15 bg-[#d6b878]/[0.08] text-[#e4c987]'
                      : 'border border-transparent text-slate-400 hover:bg-white/[0.035] hover:text-slate-200'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.7} />
                  {label}

                </button>
              ))}
            </nav>
          </div>

          <div className="px-4 pt-8">
            <div className="mb-3 px-3 text-[9px] font-semibold uppercase tracking-[0.2em] text-slate-600">
              System
            </div>
            <div className="mx-2 rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="flex items-center gap-2 text-[11px] text-slate-300">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    apiStatus === 'connected'
                      ? 'bg-emerald-400'
                      : apiStatus === 'error'
                        ? 'bg-rose-400'
                        : 'animate-pulse bg-amber-300'
                  }`}
                />
                Graph database
              </div>
              <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-500">
                <Database size={12} />
                {apiStatus === 'connected'
                  ? 'FalkorDB connected'
                  : apiStatus === 'error'
                    ? 'Connection unavailable'
                    : 'Checking connection...'}
              </div>
            </div>
          </div>

          <div className="mt-auto border-t border-white/[0.07] p-4">
            <div className="flex items-center gap-3 rounded-lg p-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-[#1b2432] text-[11px] font-medium text-[#d6b878]">
                FW
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-medium text-slate-200">
                  Analyst workspace
                </div>
                <div className="mt-0.5 text-[10px] text-slate-500">
                  Local development
                </div>
              </div>
              <ChevronDown size={14} className="text-slate-500" />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between gap-4 border-b border-white/[0.07] bg-[#080b12]/90 px-5 backdrop-blur-xl sm:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#d6b878]/25 bg-[#d6b878]/[0.07] text-[#d6b878] lg:hidden">
                <Waypoints size={17} />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-[11px] text-slate-500">
                  <span>Workspace</span>
                  <span>/</span>
                  <span className="text-slate-300">{activeNav}</span>
                </div>
                <h1 className="mt-1 truncate text-[16px] font-medium tracking-tight sm:text-[18px]">
                  {activeNav === 'Overview'
                    ? 'Intelligence overview'
                    : activeNav}
                </h1>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2 sm:gap-3">
              <div className="hidden items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.025] px-3 py-2 text-[10px] text-slate-500 md:flex">
                <Command size={12} />
                <span>Local research environment</span>
              </div>

              <button
                onClick={() => setShowAlerts(!showAlerts)}
                aria-label="Toggle notifications"
                className="relative rounded-lg border border-white/[0.08] p-2.5 text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                <Bell size={16} />
                <span
                  className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${
                    apiStatus === 'error' ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                />
              </button>

              <button
                aria-label="Refresh dashboard statistics"
                onClick={() => { setRefreshing(true); void loadData(); setWorkspaceRefresh(value => value + 1) }}
                disabled={refreshing}
                className="flex items-center gap-2 rounded-lg border border-[#d6b878]/25 bg-[#d6b878]/[0.07] px-3 py-2.5 text-[11px] font-medium text-[#e6ce98] transition hover:bg-[#d6b878]/[0.13] disabled:opacity-50"
              >
                <RefreshCw
                  size={13}
                  className={refreshing ? 'animate-spin' : ''}
                />
                <span className="hidden sm:inline">Refresh data</span>
              </button>
            </div>
          </header>
          <nav aria-label="Mobile workspace navigation" className="flex gap-2 overflow-x-auto border-b border-white/[0.07] px-5 py-3 lg:hidden">
            {navItems.map(({label}) => <button key={label} onClick={() => setActiveNav(label)} aria-current={activeNav === label ? 'page' : undefined} className={`shrink-0 rounded-lg px-3 py-2 text-[11px] ${activeNav === label ? 'bg-[#d6b878]/10 text-[#e4c987]' : 'text-slate-400'}`}>{label}</button>)}
          </nav>

          {showAlerts && (
            <div className="mx-5 mt-4 rounded-xl border border-[#d6b878]/20 bg-[#d6b878]/[0.05] p-4 sm:mx-8">
              <div className="flex items-center gap-2 text-sm text-[#e6ce98]">
                <Bell size={15} />
                Data and research notices
              </div>
              <p className="mt-2 text-xs leading-5 text-slate-400">
                Elliptic labels are research-dataset annotations. The platform
                does not independently establish criminal activity. Graph connections come from FalkorDB. Classifier outputs are
                separately identified, evaluated historical-label predictions.
              </p>
              {apiStatus === 'error' && (
                <p className="mt-2 text-xs text-rose-300">
                  The API is currently unavailable. Check the backend terminal.
                </p>
              )}
            </div>
          )}

          <div className="mx-auto max-w-[1600px] space-y-7 p-5 sm:p-8">
            <motion.section
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
            >
              <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-px w-6 bg-[#d6b878]" />
                    <span className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#d6b878]">
                      Financial crime intelligence
                    </span>
                  </div>
                  <h2 className="max-w-2xl text-3xl font-medium leading-tight tracking-[-0.04em] sm:text-[40px]">
                    See the connections.
                    <br className="hidden sm:block" />
                    <span className="text-slate-500"> Uncover the risk.</span>
                  </h2>
                  <p className="mt-3 max-w-xl text-[12px] leading-6 text-slate-400 sm:text-[13px]">
                    Explore transaction relationships, examine research labels,
                    and build evidence-led investigations across Bitcoin
                    transaction networks.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`flex items-center gap-2 rounded-full border px-3 py-2 text-[10px] ${
                      apiConnected
                        ? 'border-emerald-300/15 bg-emerald-300/[0.05] text-emerald-200'
                        : apiStatus === 'error'
                          ? 'border-rose-300/15 bg-rose-300/[0.05] text-rose-200'
                          : 'border-amber-300/15 bg-amber-300/[0.05] text-amber-200'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        apiConnected
                          ? 'bg-emerald-400'
                          : apiStatus === 'error'
                            ? 'bg-rose-400'
                            : 'animate-pulse bg-amber-300'
                      }`}
                    />
                    {apiConnected
                      ? 'Live database connection'
                      : apiStatus === 'error'
                        ? 'API connection issue'
                        : 'Connecting to database'}
                  </span>

                  <button
                    onClick={() => { setActiveNav('Transaction graph'); document.getElementById('investigation-workspace')?.scrollIntoView({ behavior: 'smooth' }) }}
                    className="flex items-center gap-2 rounded-lg bg-[#d6b878] px-4 py-2.5 text-[11px] font-semibold text-[#14130f] transition hover:bg-[#e6cc91]"
                  >
                    <Network size={14} />
                    Open graph explorer
                    <ArrowUpRight size={13} />
                  </button>
                </div>
              </div>
            </motion.section>

            <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Transactions in dataset"
                value={formatNumber(stats?.total_transactions)}
                detail={apiConnected ? 'Loaded from FalkorDB' : 'Waiting for API data'}
                icon={Activity}
                accent="text-[#d6b878]"
                delay={0.05}
              />
              <MetricCard
                label="Illicit-labelled records"
                value={formatNumber(stats?.labels.illicit_labelled)}
                detail="Research labels, not confirmed crimes"
                icon={ShieldAlert}
                accent="text-rose-300"
                delay={0.12}
              />
              <MetricCard
                label="Transaction relationships"
                value={formatNumber(stats?.total_relationships)}
                detail="Stored graph relationships"
                icon={GitBranch}
                accent="text-sky-300"
                delay={0.19}
              />
              <MetricCard
                label="Unknown-label records"
                value={formatNumber(stats?.labels.unknown)}
                detail="Labels unavailable in the dataset"
                icon={Target}
                accent="text-emerald-300"
                delay={0.26}
              />
            </section>

            <InvestigationWorkspace key={workspaceRefresh} activeNav={activeNav} seedId={SAMPLE_TX_ID} refreshKey={workspaceRefresh} onSelection={onSelection} />

            <section className={activeNav === 'Overview' ? 'grid grid-cols-1 gap-4 xl:grid-cols-2' : 'hidden'}>
              <div className="min-w-0">
                <SectionLabel>Dataset labels</SectionLabel>
                <LabelDistribution stats={stats} />
              </div>

              <div className="flex min-w-0 flex-col gap-4">
                <SectionLabel>Database status</SectionLabel>

                <div className="rounded-xl border border-white/[0.07] bg-[#10151e] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-[11px] text-slate-400">
                        Database health
                      </div>
                      <div className="mt-3 flex items-center gap-2 text-lg font-medium text-[#f3f0e8]">
                        {apiConnected ? (
                          <ShieldCheck size={19} className="text-emerald-300" />
                        ) : (
                          <AlertTriangle
                            size={19}
                            className={
                              apiStatus === 'error'
                                ? 'text-rose-300'
                                : 'text-amber-300'
                            }
                          />
                        )}
                        {apiConnected
                          ? 'Systems operational'
                          : apiStatus === 'error'
                            ? 'Connection unavailable'
                            : 'Checking systems'}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.025] p-2.5 text-slate-300">
                      <Database size={17} />
                    </div>
                  </div>

                  <div className="mt-5 space-y-3">
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-slate-500">Graph database</span>
                      <span className={apiConnected ? 'text-emerald-300' : 'text-slate-400'}>
                        {apiConnected ? 'Connected' : 'Not confirmed'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-slate-500">Dataset statistics</span>
                      <span className={stats ? 'text-emerald-300' : 'text-slate-400'}>
                        {stats ? 'Loaded' : 'Pending'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-[11px]">
                      <span className="text-slate-500">Last successful refresh</span>
                      <span className="text-slate-300">
                        {lastUpdated
                          ? lastUpdated.toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })
                          : 'Not yet'}
                      </span>
                    </div>
                  </div>

                  <div className="mt-5 flex items-start gap-2 border-t border-white/[0.06] pt-4 text-[10px] leading-5 text-slate-500">
                    <Clock3 size={13} className="mt-0.5 shrink-0" />
                    Statistics refresh automatically every 30 seconds.
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div>
                  <SectionLabel>Transaction investigation</SectionLabel>
                  <p className="-mt-2 text-[11px] text-slate-500">
                    Real records retrieved from the loaded research dataset
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#10151e] px-3 py-2">
                    <Search size={14} className="text-slate-500" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      aria-label="Filter loaded transaction records"
                      placeholder="Filter loaded records..."
                      className="w-36 bg-transparent text-[11px] text-slate-200 outline-none placeholder:text-slate-600 sm:w-48"
                    />
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#10151e] px-2.5">
                    <SlidersHorizontal size={13} className="text-slate-500" />
                    <select
                      value={selectedFilter}
                      aria-label="Filter loaded records by label"
                      onChange={(event) => setSelectedFilter(event.target.value)}
                      className="bg-transparent py-2 text-[11px] text-slate-300 outline-none"
                    >
                      <option className="bg-[#10151e]">All records</option>
                      <option className="bg-[#10151e]">Illicit-labelled</option>
                      <option className="bg-[#10151e]">Licit-labelled</option>
                      <option className="bg-[#10151e]">Unknown</option>
                    </select>
                  </div>

                  <button
                    onClick={() => void loadSampleTransaction()}
                    className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-[#10151e] px-3 py-2 text-[11px] text-slate-300 transition hover:bg-white/[0.05]"
                  >
                    <RefreshCw size={13} />
                    Reload sample
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-white/[0.07] bg-[#10151e]">
                <table className="w-full min-w-[700px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.07] text-[9px] uppercase tracking-[0.16em] text-slate-500">
                      <th className="px-5 py-4 font-medium">Transaction ID</th>
                      <th className="px-5 py-4 font-medium">Relationship</th>
                      <th className="px-5 py-4 font-medium">Time step</th>
                      <th className="px-5 py-4 font-medium">Research label</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactionRows.map((tx, index) => (
                      <motion.tr
                        key={`${tx.tx_id}-${tx.direction}`}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.04 }}
                        className="border-b border-white/[0.045] last:border-0 transition hover:bg-white/[0.025]"
                      >
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300">
                          {tx.tx_id}
                        </td>
                        <td className="px-5 py-4 text-[11px] text-slate-300">
                          {tx.direction === 'Selected transaction'
                            ? 'Selected record'
                            : tx.direction === 'Incoming'
                              ? 'Incoming relationship'
                              : 'Outgoing relationship'}
                        </td>
                        <td className="px-5 py-4 font-mono text-[11px] text-slate-300">
                          {tx.time_step}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={`rounded-md px-2 py-1 text-[10px] ${labelStyle(tx.label)}`}
                          >
                            {labelName(tx.label)}
                          </span>
                        </td>
                      </motion.tr>
                    ))}

                    {transactionRows.length === 0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="px-5 py-10 text-center text-xs text-slate-500"
                        >
                          {apiConnected
                            ? 'No loaded records match your search or filter.'
                            : 'Waiting for the API to return transaction records.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3 text-[10px] text-slate-500">
                  <span>
                    Showing {transactionRows.length} loaded transaction records (up to 20 per direction)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        apiConnected ? 'bg-emerald-400' : 'bg-amber-300'
                      }`}
                    />
                    {apiConnected ? 'FalkorDB data' : 'Connection pending'}
                  </span>
                </div>
              </div>

              {selectedTransaction && (
                <div className="mt-4 rounded-xl border border-white/[0.07] bg-[#10151e] p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.18em] text-[#d6b878]">
                        Selected transaction
                      </div>
                      <div className="mt-2 break-all font-mono text-lg text-slate-100">
                        {selectedTransaction.tx_id}
                      </div>
                      <div className="mt-2 text-[11px] text-slate-400">
                        Research label: {labelName(selectedTransaction.label)}
                        {' · '}
                        Time step: {selectedTransaction.time_step}
                      </div>
                    </div>
                    <a
                      href={`${API_BASE_URL}/api/transactions/${encodeURIComponent(selectedTransaction.tx_id)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 rounded-lg border border-white/[0.08] px-3 py-2 text-[10px] text-slate-300 transition hover:bg-white/[0.05]"
                    >
                      View API response
                      <ExternalLink size={12} />
                    </a>
                  </div>

                  <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <ArrowDownRight size={13} />
                        Loaded incoming neighbors (max 20)
                      </div>
                      <div className="mt-2 text-xl font-semibold text-[#f3f0e8]">
                        {neighbors.filter((item) => item.direction === 'Incoming').length}
                      </div>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                        <ArrowUpRight size={13} />
                        Loaded outgoing neighbors (max 20)
                      </div>
                      <div className="mt-2 text-xl font-semibold text-[#f3f0e8]">
                        {neighbors.filter((item) => item.direction === 'Outgoing').length}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </section>

            <footer className="flex flex-col justify-between gap-2 border-t border-white/[0.07] py-5 text-[10px] text-slate-600 sm:flex-row sm:items-center">
              <span className="flex items-center gap-2">
                <Sparkles size={12} className="text-[#d6b878]" />
                FRAUDWEAVE
                <span className="text-slate-700">/</span>
                Bitcoin transaction intelligence
              </span>
              <span>
                Elliptic research data · Risk conclusions require further analysis
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  )
}

export default App


