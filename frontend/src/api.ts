
const API_BASE_URL = 'http://127.0.0.1:8000'

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

async function request<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`)

  if (!response.ok) {
    throw new Error(`API request failed: ${response.status}`)
  }

  return response.json() as Promise<T>
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
