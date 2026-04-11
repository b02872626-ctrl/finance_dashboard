export type AuthMode = 'signin' | 'signup'

export type DatePreset = 'all' | '7d' | '30d' | '90d' | 'ytd' | 'custom'

export type TransactionDirection = 'ALL' | 'INCOMING' | 'OUTGOING'

export type TransactionSort =
  | 'date-desc'
  | 'date-asc'
  | 'amount-desc'
  | 'amount-asc'
  | 'balance-desc'
  | 'balance-asc'

export type Bank = {
  id: number
  name: string
}

export type Transaction = {
  id: number
  user_id: string
  bank_id: number
  bank_name: string | null
  occurred_at: string
  sender: string
  type: string
  amount: number
  balance: number | null
  counterparty: string | null
  ref_num: string | null
  total_charged: number | null
  raw_body: string
  created_at: string
  receipt_link: string | null
}

export type FinanceSnapshot = {
  banks: Bank[]
  transactions: Transaction[]
}

export type TransactionFilters = {
  search: string
  startDate: string
  endDate: string
  minAmount: string
  maxAmount: string
  direction: TransactionDirection
  selectedBankIds: number[]
  selectedTypes: string[]
  sortBy: TransactionSort
}
