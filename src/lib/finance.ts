import { supabase } from './supabase'
import type { Bank, FinanceSnapshot, Transaction } from '../types'

const bankColumns = 'id,user_id,name,created_at'
const transactionColumns =
  'id,user_id,bank_id,occurred_at,sender,type,amount,balance,counterparty,ref_num,total_charged,raw_body,created_at'

export async function loadFinanceSnapshot(
  userId: string,
): Promise<FinanceSnapshot> {
  const [banksResponse, transactionsResponse] = await Promise.all([
    supabase
      .from('i_banks')
      .select(bankColumns)
      .eq('user_id', userId)
      .order('created_at', { ascending: true }),
    supabase
      .from('i_transactions')
      .select(transactionColumns)
      .eq('user_id', userId)
      .order('occurred_at', { ascending: false }),
  ])

  if (banksResponse.error) {
    throw new Error(banksResponse.error.message)
  }

  if (transactionsResponse.error) {
    throw new Error(transactionsResponse.error.message)
  }

  return {
    banks: normalizeBanks(banksResponse.data ?? []),
    transactions: normalizeTransactions(transactionsResponse.data ?? []),
  }
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
}
