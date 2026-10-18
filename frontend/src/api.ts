export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'
).replace(/\/$/, '')

export interface FraudWeaveStats {
  status: string
  source: string
  total_transactions: number
  total_relationships: number
  labels: {
    illicit_labelled: number
    licit_labelled: number
    unknown: number
  }
  label_note: string
}

export interface Transaction {
  tx_id: string
  time_step: number
  label: 'illicit_labelled' | 'licit_labelled' | 'unknown'
  [feature: string]: string | number
}

export interface Neighbor {
  tx_id: string
  label: string
  time_step: number
}

export interface TransactionNeighbors {
  status: string
  transaction_id: string
  outgoing: Neighbor[]
  incoming: Neighbor[]
  limit_per_direction: number
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    signal: AbortSignal.timeout(30000),
  })

  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new Error(
      typeof body?.detail === 'string'
        ? body.detail
        : `API request failed: ${response.status}`,
    )
  }

  return response.json() as Promise<T>
}

export interface GraphData {
  root: string
  nodes: Neighbor[]
  edges: { id: string; source: string; target: string }[]
  depth: number
  max_nodes: number
  expanded_nodes: number
  truncated: boolean
  scope_note: string
}

export interface Prediction {
  available: boolean
  reason?: string
  score?: number
  threshold?: number
  predicted_label?: string
  evaluation_context?: string
  note?: string
}

export interface RiskData {
  transaction_id: string
  research_label: string
  time_step: number
  degrees: { incoming: number; outgoing: number }
  neighbor_labels: {
    illicit_labelled: number
    licit_labelled: number
    unknown: number
  }
  unique_neighbors: number
  label_coverage: number
  indicators: { name: string; value: number | string; explanation: string }[]
  model: Prediction
  assessment: string
  note: string
  source: string
}

export interface EvidenceSource {
  id: string
  title: string
  endpoint: string
}
export interface Evidence {
  transaction_id: string
  generated_at: string
  transaction: Transaction
  risk: RiskData
  neighbors: TransactionNeighbors
  summary: string
  sources: EvidenceSource[]
  note: string
  dataset: { name: string; url: string; license: string; context: string }
}
export interface ModelStatus {
  available: boolean
  algorithm?: string
  reason?: string
  split?: { train: string; validation: string; test: string }
  partitions?: Record<string, { records: number; illicit_labelled: number }>
  test_metrics?: {
    precision: number
    recall: number
    f1: number
    average_precision: number
    roc_auc: number
    confusion_matrix: number[][]
  }
  limitations?: string[]
}
export function getGraph(id: string, depth = 1, maxNodes = 80) {
  return request<GraphData>(
    `/api/transactions/${encodeURIComponent(id)}/graph?depth=${depth}&max_nodes=${maxNodes}`,
  )
}
export function getEvidence(id: string) {
  return request<Evidence>(
    `/api/transactions/${encodeURIComponent(id)}/summary`,
  )
}
export function getModelStatus() {
  return request<ModelStatus>('/api/models/status')
}
export function getTimeline() {
  return request<{
    steps: {
      time_step: number
      illicit_labelled: number
      licit_labelled: number
      unknown: number
    }[]
  }>('/api/dataset/timeline')
}
export function listTransactions(label = 'all') {
  return request<{ transactions: Neighbor[] }>(
    `/api/transactions?label=${encodeURIComponent(label)}&limit=8`,
  )
}
export function askCopilot(question: string, txId?: string) {
  return request<{
    answer: string
    sources: EvidenceSource[]
    tools_used: string[]
    engine_note: string
    trace?: { transaction_id: string; tool: string; reason: string; depth: number }[]
    findings?: { transaction_id: string; path: string[]; edges: { source: string; target: string }[] }[]
  }>('/api/copilot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, tx_id: txId }),
  })
}
export async function downloadReport(
  id: string,
  format: 'markdown' | 'json' | 'html',
) {
  const response = await fetch(
    `${API_BASE_URL}/api/transactions/${encodeURIComponent(id)}/report?format=${format}`,
    { signal: AbortSignal.timeout(30000) },
  )
  if (!response.ok)
    throw new Error(
      'Report export failed. Please retry when the database is available.',
    )
  const url = URL.createObjectURL(await response.blob())
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `fraudweave-${id}.${format === 'markdown' ? 'md' : format}`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function getStats() {
  return request<FraudWeaveStats>('/api/stats')
}

export function getTransaction(txId: string) {
  return request<{ status: string; transaction: Transaction }>(
    `/api/transactions/${encodeURIComponent(txId)}`,
  )
}

export function getTransactionNeighbors(txId: string, limit = 10) {
  return request<TransactionNeighbors>(
    `/api/transactions/${encodeURIComponent(txId)}/neighbors?limit=${limit}`,
  )
}

export function getHealth() {
  return request<{
    status: string
    service: string
    database: { connected: boolean; graph: string }
    mode: string
  }>('/api/health')
}
