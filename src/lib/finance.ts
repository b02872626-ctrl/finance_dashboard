import { supabase } from './supabase'
import type { Bank, FinanceSnapshot, Transaction } from '../types'

const bankColumns = 'id,bank_name'
const transactionColumns =
  'id,user_id,bank_name,occurred_at,sender,type,amount,balance,counterparty,ref_num,total_charged,raw_body,created_at,recipt_link'
const transactionPageSize = 1000

export async function loadFinanceSnapshot(
  userId: string,
): Promise<FinanceSnapshot> {
  const [bankRecords, transactionRecords] = await Promise.all([
    loadBanks(),
    loadAllTransactions(userId),
  ])
  const banks = mergeBanksWithTransactionNames(
    normalizeBanks(bankRecords),
    transactionRecords,
  )

  return {
    banks,
    transactions: normalizeTransactions(transactionRecords, banks),
  }
}

async function loadBanks(): Promise<BankRecord[]> {
  const { data, error } = await supabase
    .from('i_banks')
    .select(bankColumns)
    .order('bank_name', { ascending: true })

  if (error) {
    return []
  }

  return data ?? []
}

async function loadAllTransactions(userId: string): Promise<TransactionRecord[]> {
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

  return records
}

function normalizeBanks(records: BankRecord[]): Bank[] {
  return records.map((record) => ({
    id: Number(record.id),
    name: cleanBankName(record.bank_name) || `Bank ${record.id}`,
  }))
}

function mergeBanksWithTransactionNames(
  banks: Bank[],
  records: TransactionRecord[],
): Bank[] {
  const merged = [...banks]
  const seenNames = new Set(
    merged
      .map((bank) => normalizeBankName(bank.name))
      .filter((value): value is string => Boolean(value)),
  )
  let syntheticBankId = -1
  let needsUnknownSource = false

  for (const record of records) {
    const bankName = cleanBankName(record.bank_name)

    if (!bankName) {
      needsUnknownSource = true
      continue
    }

    const normalizedBankName = normalizeBankName(bankName)

    if (!normalizedBankName || seenNames.has(normalizedBankName)) {
      continue
    }

    merged.push({
      id: syntheticBankId,
      name: bankName,
    })
    seenNames.add(normalizedBankName)
    syntheticBankId -= 1
  }

  if (needsUnknownSource && !seenNames.has('unknown source')) {
    merged.push({
      id: syntheticBankId,
      name: 'Unknown source',
    })
  }

  return merged
}

function normalizeTransactions(records: TransactionRecord[], banks: Bank[]): Transaction[] {
  const bankIdByName = new Map(
    banks.map((bank) => [normalizeBankName(bank.name), bank.id] as const),
  )
  const unknownBankId =
    bankIdByName.get(normalizeBankName('Unknown source')) ?? 0

  return records.map((record) => ({
    id: Number(record.id),
    user_id: record.user_id,
    bank_id:
      cleanBankName(record.bank_name) &&
      bankIdByName.has(normalizeBankName(cleanBankName(record.bank_name))!)
        ? bankIdByName.get(normalizeBankName(cleanBankName(record.bank_name))!) ?? unknownBankId
        : unknownBankId,
    bank_name: cleanBankName(record.bank_name),
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

function cleanBankName(value: string | null | undefined) {
  const normalized = value?.replace(/\s+/g, ' ').trim()
  return normalized ? normalized : null
}

function normalizeBankName(value: string | null | undefined) {
  return cleanBankName(value)?.toLowerCase() ?? null
}

type BankRecord = {
  id: number | string
  bank_name: string
}

type TransactionRecord = {
  id: number | string
  user_id: string
  bank_name: string | null
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
