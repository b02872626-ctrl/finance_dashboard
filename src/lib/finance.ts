import { supabase } from './supabase'
import type { Bank, FinanceSnapshot, Transaction } from '../types'

const bankColumns = 'id,user_id,name,created_at'
const transactionColumns =
  'id,user_id,bank_id,occurred_at,sender,type,amount,balance,counterparty,ref_num,total_charged,raw_body,created_at,recipt_link'
const transactionPageSize = 1000

export async function loadFinanceSnapshot(
  userId: string,
): Promise<FinanceSnapshot> {
  const [banksResponse, transactions] = await Promise.all([
    supabase
      .from('i_banks')
      .select(bankColumns)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    loadAllTransactions(userId),
  ])

  if (banksResponse.error) {
    throw new Error(banksResponse.error.message)
  }

  return {
    banks: normalizeBanks(banksResponse.data ?? []),
    transactions,
  }
}

async function loadAllTransactions(userId: string): Promise<Transaction[]> {
  const records: TransactionRecord[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('i_transactions')
      .select(transactionColumns)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false })
      .range(from, from + transactionPageSize - 1)

    if (error) {
      throw new Error(error.message)
    }

    const page = data ?? []
    records.push(...page)

    if (page.length < transactionPageSize) {
      break
    }

    from += transactionPageSize
  }

  return normalizeTransactions(records)
}

function normalizeBanks(records: BankRecord[]): Bank[] {
  return records.map((record) => ({
    id: Number(record.id),
    user_id: record.user_id,
    name: record.name,
    created_at: record.created_at,
  }))
}

function normalizeTransactions(records: TransactionRecord[]): Transaction[] {
  return records.map((record) => ({
    id: Number(record.id),
    user_id: record.user_id,
    bank_id: Number(record.bank_id),
    occurred_at: record.occurred_at,
    sender: record.sender,
    type: record.type,
    amount: Number(record.amount),
    balance:
      record.balance === null || record.balance === undefined
        ? null
        : Number(record.balance),
    counterparty: record.counterparty,
    ref_num: record.ref_num,
    total_charged:
      record.total_charged === null || record.total_charged === undefined
        ? null
        : Number(record.total_charged),
    raw_body: record.raw_body,
    created_at: record.created_at,
    receipt_link: record.recipt_link || null,
  }))
}

type BankRecord = {
  id: number | string
  user_id: string
  name: string
  created_at: string
}

type TransactionRecord = {
  id: number | string
  user_id: string
  bank_id: number | string
  occurred_at: string
  sender: string
  type: string
  amount: number | string
  balance: number | string | null
  counterparty: string | null
  ref_num: string | null
  total_charged: number | string | null
  raw_body: string
  created_at: string
  recipt_link: string | null
}
