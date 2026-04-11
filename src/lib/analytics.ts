import type {
  Bank,
  DatePreset,
  Transaction,
  TransactionDirection,
  TransactionFilters,
  TransactionSort,
} from '../types'
import {
  formatMonthLabel,
  formatShortDate,
  toInputDate,
} from '../utils/format'

export const transactionTypeOrder = [
  'CREDIT',
  'DEBIT',
  'PAYMENT',
  'TRANSFER_OUT',
  'UNKNOWN',
]

export const transactionTypePalette: Record<string, string> = {
  CREDIT: '#9a8b2f',
  DEBIT: '#d14f34',
  PAYMENT: '#f2a93b',
  TRANSFER_OUT: '#5776d6',
  UNKNOWN: '#8b95a7',
}

export const datePresetOptions: { label: string; value: DatePreset }[] = [
  { label: 'All time', value: 'all' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
  { label: '90 days', value: '90d' },
  { label: 'YTD', value: 'ytd' },
]

export type TrendGranularity = 'daily' | 'monthly' | 'weekly'
export type SpendingFlowView =
  | 'category'
  | 'counterparty'
  | 'essentiality'
  | 'expense-style'
  | 'source'

export type SpendingFlowGraphNode = {
  depth: number
  fill: string
  key: string
  name: string
  routeIds: string[]
}

export type SpendingFlowGraphLink = {
  color: string
  primaryRouteId: string
  routeIds: string[]
  source: number
  target: number
  value: number
}

export type SpendingFlowRoute = {
  amount: number
  color: string
  id: string
  label: string
  steps: [string, string, string]
}

export type SpendingFlowGraph = {
  links: SpendingFlowGraphLink[]
  nodes: SpendingFlowGraphNode[]
  routes: Record<string, SpendingFlowRoute>
}

export type DashboardTransactionItem = {
  amount: number
  amountLabel?: string
  date: string
  id: number
  subtitle: string
  title: string
  tone: 'negative' | 'neutral' | 'positive'
}

export type DashboardTransactionBucket = {
  allItems: DashboardTransactionItem[]
  items: DashboardTransactionItem[]
  total: number
}

export type DashboardTransactionReview = {
  duplicateLookingTransactions: DashboardTransactionBucket
  failedParsingTransactions: DashboardTransactionBucket
  largestExpenses: DashboardTransactionBucket
  recentTransactions: DashboardTransactionBucket
  uncategorizedTransactions: DashboardTransactionBucket
  unusualTransactions: DashboardTransactionBucket
}

const outgoingTypes = new Set(['DEBIT', 'PAYMENT', 'TRANSFER_OUT'])
const incomingTypes = new Set(['CREDIT'])
const sourcePalette = ['#c6a483', '#89a787', '#c49ab7', '#88a2bf', '#d0a780', '#93a5a6']
const categoryPalette: Record<string, string> = {
  'Bills & utilities': '#bf8a55',
  'Dining & hospitality': '#d4875f',
  Education: '#8b87d4',
  Entertainment: '#a586d7',
  Fees: '#b07a63',
  Groceries: '#4fa07d',
  Health: '#5a98a6',
  Housing: '#8d6b49',
  'Lifestyle & shopping': '#d57ea2',
  'People & transfers': '#7c8fc4',
  'Savings & debt': '#8aa05a',
  Transport: '#dd9b42',
  Uncategorized: '#a6a29a',
}

export function createEmptyFilters(): TransactionFilters {
  return {
    direction: 'ALL',
    endDate: '',
    maxAmount: '',
    minAmount: '',
    search: '',
    selectedBankIds: [],
    selectedTypes: [],
    sortBy: 'date-desc',
    startDate: '',
  }
}

export function resolveDatePreset(preset: DatePreset) {
  const today = new Date()
  const endDate = toInputDate(today)

  if (preset === 'all') {
    return {
      endDate: '',
      startDate: '',
    }
  }

  if (preset === 'ytd') {
    const start = new Date(today.getFullYear(), 0, 1)
    return {
      endDate,
      startDate: toInputDate(start),
    }
  }

  const daysBack = preset === '7d' ? 6 : preset === '30d' ? 29 : 89
  const start = new Date(today)
  start.setDate(today.getDate() - daysBack)

  return {
    endDate,
    startDate: toInputDate(start),
  }
}

export function filterTransactions(
  transactions: Transaction[],
  banks: Bank[],
  filters: TransactionFilters,
) {
  const bankLookup = new Map<number, string>(banks.map((bank) => [bank.id, bank.name]))
  const searchNeedle = filters.search.trim().toLowerCase()
  const startTime = filters.startDate
    ? new Date(`${filters.startDate}T00:00:00`).getTime()
    : null
  const endTime = filters.endDate
    ? new Date(`${filters.endDate}T23:59:59.999`).getTime()
    : null
  const minAmount = parseNumberish(filters.minAmount)
  const maxAmount = parseNumberish(filters.maxAmount)

  return [...transactions]
    .filter((transaction) => {
      const occurredAt = new Date(transaction.occurred_at).getTime()
      const absoluteAmount = Math.abs(transaction.amount)

      if (startTime !== null && occurredAt < startTime) {
        return false
      }

      if (endTime !== null && occurredAt > endTime) {
        return false
      }

      if (
        filters.direction !== 'ALL' &&
        getTransactionDirection(transaction.type) !== filters.direction
      ) {
        return false
      }

      if (
        filters.selectedBankIds.length > 0 &&
        !filters.selectedBankIds.includes(transaction.bank_id)
      ) {
        return false
      }

      if (
        filters.selectedTypes.length > 0 &&
        !filters.selectedTypes.includes(transaction.type)
      ) {
        return false
      }

      if (minAmount !== null && absoluteAmount < minAmount) {
        return false
      }

      if (maxAmount !== null && absoluteAmount > maxAmount) {
        return false
      }

      if (!searchNeedle) {
        return true
      }

      const searchHaystack = [
        getBankName(bankLookup, transaction.bank_id, transaction.bank_name),
        transaction.sender,
        transaction.counterparty,
        transaction.ref_num,
        transaction.raw_body,
        transaction.type,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()

      return searchHaystack.includes(searchNeedle)
    })
    .sort((left, right) => compareTransactions(left, right, filters.sortBy))
}

export function getTransactionDirection(type: string): TransactionDirection {
  if (incomingTypes.has(type)) {
    return 'INCOMING'
  }

  if (outgoingTypes.has(type)) {
    return 'OUTGOING'
  }

  return 'ALL'
}

export function isOutgoingType(type: string) {
  return outgoingTypes.has(type)
}

export function buildMetricSummary(transactions: Transaction[]) {
  const incoming = transactions.reduce((sum, transaction) => {
    return incomingTypes.has(transaction.type) ? sum + transaction.amount : sum
  }, 0)
  const outgoing = transactions.reduce((sum, transaction) => {
    return outgoingTypes.has(transaction.type)
      ? sum + Math.abs(transaction.amount)
      : sum
  }, 0)
  const absoluteAmounts = transactions.map((transaction) => Math.abs(transaction.amount))
  const sortedAmounts = [...absoluteAmounts].sort((left, right) => left - right)
  const midpoint = Math.floor(sortedAmounts.length / 2)
  const median =
    sortedAmounts.length === 0
      ? null
      : sortedAmounts.length % 2 === 0
        ? (sortedAmounts[midpoint - 1] + sortedAmounts[midpoint]) / 2
        : sortedAmounts[midpoint]
  const largest = sortedAmounts.length ? sortedAmounts[sortedAmounts.length - 1] : null
  const chargeTotal = transactions.reduce((sum, transaction) => {
    return sum + (transaction.total_charged ?? 0)
  }, 0)
  const balance = calculateLatestBalance(transactions)
  const counterparties = new Set(
    transactions
      .map((transaction) => transaction.counterparty || transaction.sender)
      .filter(Boolean),
  ).size

  return {
    average: absoluteAmounts.length
      ? absoluteAmounts.reduce((sum, amount) => sum + amount, 0) /
        absoluteAmounts.length
      : null,
    balance,
    chargeTotal,
    counterparties,
    count: transactions.length,
    incoming,
    largest,
    median,
    net: incoming - outgoing,
    outgoing,
  }
}

export function calculateLatestBalance(transactions: Transaction[]) {
  const balances = new Map<number, number>()

  for (const transaction of transactions) {
    if (transaction.balance == null || balances.has(transaction.bank_id)) {
      continue
    }

    balances.set(transaction.bank_id, transaction.balance)
  }

  if (!balances.size) {
    return null
  }

  return Array.from(balances.values()).reduce((sum, value) => sum + value, 0)
}

export function buildDailySeries(transactions: Transaction[], limit = 30) {
  const grouped = new Map<
    string,
    { count: number; incoming: number; net: number; outgoing: number }
  >()

  for (const transaction of [...transactions].reverse()) {
    const key = toInputDate(transaction.occurred_at)
    const current = grouped.get(key) ?? {
      count: 0,
      incoming: 0,
      net: 0,
      outgoing: 0,
    }

    current.count += 1

    if (incomingTypes.has(transaction.type)) {
      current.incoming += transaction.amount
      current.net += transaction.amount
    } else if (outgoingTypes.has(transaction.type)) {
      current.outgoing += Math.abs(transaction.amount)
      current.net -= Math.abs(transaction.amount)
    } else {
      current.net += transaction.amount
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit)
    .map(([key, values]) => ({
      key,
      label: formatShortDate(key),
      ...values,
    }))
}

export function buildMonthlySeries(transactions: Transaction[], limit = 12) {
  const grouped = new Map<
    string,
    { count: number; incoming: number; net: number; outgoing: number }
  >()

  for (const transaction of transactions) {
    const date = new Date(transaction.occurred_at)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    const current = grouped.get(key) ?? {
      count: 0,
      incoming: 0,
      net: 0,
      outgoing: 0,
    }

    current.count += 1

    if (incomingTypes.has(transaction.type)) {
      current.incoming += transaction.amount
      current.net += transaction.amount
    } else if (outgoingTypes.has(transaction.type)) {
      current.outgoing += Math.abs(transaction.amount)
      current.net -= Math.abs(transaction.amount)
    } else {
      current.net += transaction.amount
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-limit)
    .map(([key, values]) => ({
      key,
      label: formatMonthLabel(key),
      ...values,
    }))
}

export function buildIncomeExpenseSeries(
  transactions: Transaction[],
  granularity: TrendGranularity,
) {
  const grouped = new Map<
    string,
    { incoming: number; label: string; outgoing: number }
  >()

  for (const transaction of [...transactions].reverse()) {
    const { key, label } = getBucketMeta(transaction.occurred_at, granularity)
    const current = grouped.get(key) ?? {
      incoming: 0,
      label,
      outgoing: 0,
    }

    if (incomingTypes.has(transaction.type)) {
      current.incoming += transaction.amount
    } else if (outgoingTypes.has(transaction.type)) {
      current.outgoing += Math.abs(transaction.amount)
    }

    grouped.set(key, current)
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-resolveTrendLimit(granularity))
    .map(([key, values]) => ({
      key,
      ...values,
    }))
}

export function buildRunningBalanceSeries(
  transactions: Transaction[],
  granularity: TrendGranularity,
) {
  const sortedTransactions = [...transactions].sort(
    (left, right) =>
      new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
  )
  const latestBalances = new Map<number, number>()
  let runningNet = 0
  const grouped = new Map<string, { balance: number; label: string }>()

  for (const transaction of sortedTransactions) {
    if (incomingTypes.has(transaction.type)) {
      runningNet += transaction.amount
    } else if (outgoingTypes.has(transaction.type)) {
      runningNet -= Math.abs(transaction.amount)
    } else {
      runningNet += transaction.amount
    }

    if (transaction.balance !== null) {
      latestBalances.set(transaction.bank_id, transaction.balance)
    }

    const { key, label } = getBucketMeta(transaction.occurred_at, granularity)
    const totalBalance = latestBalances.size
      ? Array.from(latestBalances.values()).reduce((sum, value) => sum + value, 0)
      : runningNet

    grouped.set(key, {
      balance: totalBalance,
      label,
    })
  }

  return Array.from(grouped.entries())
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-resolveTrendLimit(granularity))
    .map(([key, values]) => ({
      key,
      ...values,
    }))
}

export function buildSpendingDayExtremes(transactions: Transaction[]) {
  const grouped = new Map<string, { label: string; value: number }>()

  for (const transaction of transactions) {
    if (!outgoingTypes.has(transaction.type)) {
      continue
    }

    const key = toInputDate(transaction.occurred_at)
    const current = grouped.get(key) ?? {
      label: formatShortDate(key),
      value: 0,
    }

    current.value += Math.abs(transaction.amount)
    grouped.set(key, current)
  }

  const rankedDays = Array.from(grouped.entries())
    .map(([key, value]) => ({
      date: key,
      ...value,
    }))
    .sort((left, right) => left.value - right.value)

  if (!rankedDays.length) {
    return {
      best: null,
      worst: null,
    }
  }

  return {
    best: rankedDays[0],
    worst: rankedDays[rankedDays.length - 1],
  }
}

export function buildBankVolumeData(transactions: Transaction[], banks: Bank[], limit = 6) {
  const bankLookup = new Map<number, string>(banks.map((bank) => [bank.id, bank.name]))
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
      const label = getBankName(bankLookup, transaction.bank_id, transaction.bank_name)
    const current = totals.get(label) ?? 0
    totals.set(label, current + Math.abs(transaction.amount))
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit)
}

export function buildTypeBreakdown(
  transactions: Transaction[],
  mode: 'count' | 'value' = 'value',
) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    const current = totals.get(transaction.type) ?? 0
    totals.set(
      transaction.type,
      current + (mode === 'count' ? 1 : Math.abs(transaction.amount)),
    )
  }

  return transactionTypeOrder
    .map((type) => ({
      color: transactionTypePalette[type] ?? '#8b95a7',
      label: type,
      value: totals.get(type) ?? 0,
    }))
    .filter((entry) => entry.value > 0)
}

export function buildTopCounterparties(transactions: Transaction[], limit = 8) {
  const totals = new Map<string, number>()

  for (const transaction of transactions) {
    const label = transaction.counterparty || transaction.sender || 'Unlabeled'
    const current = totals.get(label) ?? 0
    totals.set(label, current + Math.abs(transaction.amount))
  }

  return Array.from(totals.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, limit)
}

export function buildWeekdaySeries(transactions: Transaction[]) {
  const weekdayOrder = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const grouped = new Map<string, { count: number; value: number }>(
    weekdayOrder.map((day) => [day, { count: 0, value: 0 }]),
  )

  for (const transaction of transactions) {
    const day = weekdayOrder[new Date(transaction.occurred_at).getDay()]
    const current = grouped.get(day)

    if (!current) {
      continue
    }

    current.count += 1
    current.value += Math.abs(transaction.amount)
  }

  return weekdayOrder.map((day) => ({
    count: grouped.get(day)?.count ?? 0,
    label: day,
    value: grouped.get(day)?.value ?? 0,
  }))
}

export function buildAmountBuckets(transactions: Transaction[]) {
  const buckets = [
    { label: '< 1k', max: 1000, min: 0 },
    { label: '1k - 5k', max: 5000, min: 1000 },
    { label: '5k - 20k', max: 20000, min: 5000 },
    { label: '20k - 100k', max: 100000, min: 20000 },
    { label: '100k+', max: Number.POSITIVE_INFINITY, min: 100000 },
  ]

  return buckets.map((bucket) => ({
    count: transactions.filter((transaction) => {
      const amount = Math.abs(transaction.amount)
      return amount >= bucket.min && amount < bucket.max
    }).length,
    label: bucket.label,
  }))
}

export function buildSpendingFlowGraph(
  transactions: Transaction[],
  banks: Bank[],
  view: SpendingFlowView,
): SpendingFlowGraph {
  const outgoingTransactions = transactions.filter(
    (transaction) => outgoingTypes.has(transaction.type) && Math.abs(transaction.amount) > 0,
  )

  if (!outgoingTransactions.length) {
    return {
      links: [],
      nodes: [],
      routes: {},
    }
  }

  const bankLookup = new Map<number, string>(banks.map((bank) => [bank.id, bank.name]))
  const sourceColors = new Map(
    banks.map((bank, index) => [bank.name, sourcePalette[index % sourcePalette.length]]),
  )
  const recurrenceLookup = buildCounterpartyRecurrenceLookup(outgoingTransactions)
  const records = outgoingTransactions.map((transaction) => {
      const source =
        getBankName(bankLookup, transaction.bank_id, transaction.bank_name) || 'Unknown source'
    const profile = analyzeTransactionProfile(
      transaction,
      recurrenceLookup.get(resolveCounterpartyLabel(transaction)),
    )

    return {
      amount: Math.abs(transaction.amount),
      category: profile.category,
      counterparty: profile.counterparty,
      essentiality: profile.essentiality,
      expenseStyle: profile.expenseStyle,
      source,
    }
  })

  const topCategories = buildTopLabelSet(
    records.map((record) => ({
      label: record.category,
      value: record.amount,
    })),
    6,
  )
  const topCounterparties = buildTopLabelSet(
    records.map((record) => ({
      label: record.counterparty,
      value: record.amount,
    })),
    7,
  )
  const routeTotals = new Map<
    string,
    { amount: number; color: string; steps: [string, string, string] }
  >()

  for (const record of records) {
    const steps = resolveSpendingFlowSteps(record, view, topCategories, topCounterparties)
    const routeId = steps.join('|||')
    const current = routeTotals.get(routeId)

    if (current) {
      current.amount += record.amount
      continue
    }

    routeTotals.set(routeId, {
      amount: record.amount,
      color: resolveSpendingFlowColor(steps[1], view, sourceColors),
      steps,
    })
  }

  const routes = Object.fromEntries(
    Array.from(routeTotals.entries())
      .sort((left, right) => right[1].amount - left[1].amount)
      .map(([id, route]) => [
        id,
        {
          amount: route.amount,
          color: route.color,
          id,
          label: route.steps.join(' -> '),
          steps: route.steps,
        },
      ]),
  ) as Record<string, SpendingFlowRoute>
  const nodes: SpendingFlowGraphNode[] = []
  const nodeIndex = new Map<string, number>()
  const nodeRoutes = new Map<string, Set<string>>()
  const links = new Map<
    string,
    {
      color: string
      routeIds: Set<string>
      routeValues: Map<string, number>
      source: number
      target: number
      value: number
    }
  >()

  const ensureNode = (label: string, depth: number) => {
    const key = `${depth}:${label}`
    const existing = nodeIndex.get(key)

    if (existing !== undefined) {
      return existing
    }

    const index = nodes.length
    nodeIndex.set(key, index)
    nodes.push({
      depth,
      fill: resolveSpendingFlowColor(label, view, sourceColors, depth),
      key,
      name: label,
      routeIds: [],
    })
    return index
  }

  const appendNodeRoute = (nodeId: number, routeId: string) => {
    const key = nodes[nodeId].key
    const current = nodeRoutes.get(key) ?? new Set<string>()
    current.add(routeId)
    nodeRoutes.set(key, current)
  }

  const appendLink = (source: number, target: number, routeId: string, value: number, color: string) => {
    const key = `${source}:${target}`
    const current = links.get(key) ?? {
      color,
      routeIds: new Set<string>(),
      routeValues: new Map<string, number>(),
      source,
      target,
      value: 0,
    }

    current.value += value
    current.routeIds.add(routeId)
    current.routeValues.set(routeId, (current.routeValues.get(routeId) ?? 0) + value)
    links.set(key, current)
  }

  for (const [routeId, route] of Object.entries(routes)) {
    const [left, middle, right] = route.steps
    const leftNode = ensureNode(left, 0)
    const middleNode = ensureNode(middle, 1)
    const rightNode = ensureNode(right, 2)

    appendNodeRoute(leftNode, routeId)
    appendNodeRoute(middleNode, routeId)
    appendNodeRoute(rightNode, routeId)
    appendLink(leftNode, middleNode, routeId, route.amount, route.color)
    appendLink(middleNode, rightNode, routeId, route.amount, route.color)
  }

  for (const node of nodes) {
    node.routeIds = Array.from(nodeRoutes.get(node.key) ?? [])
  }

  return {
    links: Array.from(links.values()).map((link) => {
      const primaryRouteId =
        Array.from(link.routeValues.entries()).sort((left, right) => right[1] - left[1])[0]?.[0] ??
        ''

      return {
        color: link.color,
        primaryRouteId,
        routeIds: Array.from(link.routeIds),
        source: link.source,
        target: link.target,
        value: link.value,
      }
    }),
    nodes,
    routes,
  }
}

export function buildDashboardTransactionReview(
  transactions: Transaction[],
  banks: Bank[],
): DashboardTransactionReview {
  const bankLookup = new Map<number, string>(banks.map((bank) => [bank.id, bank.name]))
  const recurrenceLookup = buildCounterpartyRecurrenceLookup(
    transactions.filter((transaction) => outgoingTypes.has(transaction.type)),
  )
  const profiles = transactions.map((transaction) => ({
    profile: analyzeTransactionProfile(
      transaction,
      recurrenceLookup.get(resolveCounterpartyLabel(transaction)),
    ),
    transaction,
  }))
  const outgoingProfiles = profiles.filter(({ transaction }) => outgoingTypes.has(transaction.type))
  const recentTransactionsAll = [...transactions]
    .sort(
      (left, right) =>
        new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime(),
    )
    .map((transaction) => createDashboardTransactionItem(transaction, bankLookup))
  const largestExpensesAll = [...outgoingProfiles]
    .sort(
      (left, right) => Math.abs(right.transaction.amount) - Math.abs(left.transaction.amount),
    )
    .map(({ profile, transaction }) =>
      createDashboardTransactionItem(transaction, bankLookup, {
        subtitle: `${profile.category} · ${getBankName(bankLookup, transaction.bank_id)}`,
      }),
    )
  const unusualTransactionsAll = buildUnusualTransactionItems(outgoingProfiles, bankLookup)
  const duplicateLookingTransactionsAll = buildDuplicateTransactionItems(
    outgoingProfiles.map(({ transaction }) => transaction),
    bankLookup,
  )
  const uncategorizedTransactionsAll = outgoingProfiles
    .filter(({ profile }) => profile.category === 'Uncategorized')
    .sort(
      (left, right) =>
        new Date(right.transaction.occurred_at).getTime() -
        new Date(left.transaction.occurred_at).getTime(),
    )
    .map(({ transaction }) =>
      createDashboardTransactionItem(transaction, bankLookup, {
        subtitle: `${getBankName(bankLookup, transaction.bank_id)} · ${buildRawSnippet(transaction.raw_body)}`,
      }),
    )
  const failedParsingTransactionsAll = profiles
    .filter(({ profile }) => profile.isLowConfidence)
    .sort(
      (left, right) =>
        new Date(right.transaction.occurred_at).getTime() -
        new Date(left.transaction.occurred_at).getTime(),
    )
    .map(({ profile, transaction }) =>
      createDashboardTransactionItem(transaction, bankLookup, {
        subtitle: profile.lowConfidenceReasons.join(' · '),
      }),
    )

  return {
    duplicateLookingTransactions: {
      allItems: duplicateLookingTransactionsAll,
      items: duplicateLookingTransactionsAll.slice(0, 5),
      total: duplicateLookingTransactionsAll.length,
    },
    failedParsingTransactions: {
      allItems: failedParsingTransactionsAll,
      items: failedParsingTransactionsAll.slice(0, 5),
      total: failedParsingTransactionsAll.length,
    },
    largestExpenses: {
      allItems: largestExpensesAll,
      items: largestExpensesAll.slice(0, 5),
      total: largestExpensesAll.length,
    },
    recentTransactions: {
      allItems: recentTransactionsAll,
      items: recentTransactionsAll.slice(0, 5),
      total: recentTransactionsAll.length,
    },
    uncategorizedTransactions: {
      allItems: uncategorizedTransactionsAll,
      items: uncategorizedTransactionsAll.slice(0, 5),
      total: uncategorizedTransactionsAll.length,
    },
    unusualTransactions: {
      allItems: unusualTransactionsAll,
      items: unusualTransactionsAll.slice(0, 5),
      total: unusualTransactionsAll.length,
    },
  }
}

export function buildSankeyData(transactions: Transaction[], banks: Bank[]) {
  if (!transactions.length) {
    return {
      links: [],
      nodes: [],
    }
  }

  const bankLookup = new Map<number, string>(banks.map((bank) => [bank.id, bank.name]))
  const topCounterparties = new Set(
    buildTopCounterparties(transactions, 6).map((entry) => entry.label),
  )
  const nodes: { fill: string; name: string }[] = []
  const nodeIndex = new Map<string, number>()
  const links = new Map<string, number>()

  const ensureNode = (key: string, name: string, fill: string) => {
    if (nodeIndex.has(key)) {
      return nodeIndex.get(key)!
    }

    const index = nodes.length
    nodeIndex.set(key, index)
    nodes.push({ fill, name })
    return index
  }

  const appendLink = (source: number, target: number, value: number) => {
    const key = `${source}:${target}`
    const current = links.get(key) ?? 0
    links.set(key, current + value)
  }

  for (const transaction of transactions) {
      const bankLabel = getBankName(bankLookup, transaction.bank_id, transaction.bank_name)
    const typeLabel = transaction.type
    const counterpartyLabel = topCounterparties.has(
      transaction.counterparty || transaction.sender || 'Unlabeled',
    )
      ? transaction.counterparty || transaction.sender || 'Unlabeled'
      : 'Other counterparties'
    const amount = Math.abs(transaction.amount)

    const bankNode = ensureNode(`bank:${bankLabel}`, bankLabel, '#98d8bf')
    const typeNode = ensureNode(
      `type:${typeLabel}`,
      typeLabel,
      transactionTypePalette[typeLabel] ?? '#8b95a7',
    )
    const counterpartyNode = ensureNode(
      `counterparty:${counterpartyLabel}`,
      counterpartyLabel,
      '#c6d2f7',
    )

    appendLink(bankNode, typeNode, amount)
    appendLink(typeNode, counterpartyNode, amount)
  }

  return {
    links: Array.from(links.entries()).map(([key, value]) => {
      const [source, target] = key.split(':').map(Number)
      return { source, target, value }
    }),
    nodes,
  }
}

function compareTransactions(
  left: Transaction,
  right: Transaction,
  sortBy: TransactionSort,
) {
  switch (sortBy) {
    case 'date-asc':
      return (
        new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime()
      )
    case 'amount-desc':
      return Math.abs(right.amount) - Math.abs(left.amount)
    case 'amount-asc':
      return Math.abs(left.amount) - Math.abs(right.amount)
    case 'balance-desc':
      return (right.balance ?? Number.NEGATIVE_INFINITY) - (left.balance ?? Number.NEGATIVE_INFINITY)
    case 'balance-asc':
      return (left.balance ?? Number.POSITIVE_INFINITY) - (right.balance ?? Number.POSITIVE_INFINITY)
    case 'date-desc':
    default:
      return (
        new Date(right.occurred_at).getTime() - new Date(left.occurred_at).getTime()
      )
  }
}

function parseNumberish(value: string) {
  if (!value.trim()) {
    return null
  }

  const parsed = Number(value)
  return Number.isNaN(parsed) ? null : parsed
}

function getBucketMeta(value: string, granularity: TrendGranularity) {
  const date = new Date(value)

  if (granularity === 'monthly') {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
    return {
      key,
      label: formatMonthLabel(key),
    }
  }

  if (granularity === 'weekly') {
    const startOfWeek = new Date(date)
    const day = startOfWeek.getDay()
    const mondayOffset = (day + 6) % 7
    startOfWeek.setDate(startOfWeek.getDate() - mondayOffset)
    const key = toInputDate(startOfWeek)
    return {
      key,
      label: formatShortDate(key),
    }
  }

  const key = toInputDate(date)
  return {
    key,
    label: formatShortDate(key),
  }
}

function resolveTrendLimit(granularity: TrendGranularity) {
  if (granularity === 'daily') {
    return 21
  }

  if (granularity === 'weekly') {
    return 14
  }

  return 12
}

function buildCounterpartyRecurrenceLookup(transactions: Transaction[]) {
  const lookup = new Map<
    string,
    {
      count: number
      months: Set<string>
    }
  >()

  for (const transaction of transactions) {
    const label = resolveCounterpartyLabel(transaction)
    const current = lookup.get(label) ?? {
      count: 0,
      months: new Set<string>(),
    }

    current.count += 1
    current.months.add(transaction.occurred_at.slice(0, 7))
    lookup.set(label, current)
  }

  return lookup
}

function buildDuplicateTransactionItems(
  transactions: Transaction[],
  bankLookup: Map<number, string>,
) {
  const grouped = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    const label = normalizeDuplicateLabel(resolveCounterpartyLabel(transaction))
    const amount = Math.abs(transaction.amount).toFixed(2)
    const key = `${label}:::${amount}`
    const current = grouped.get(key) ?? []
    current.push(transaction)
    grouped.set(key, current)
  }

  return Array.from(grouped.values())
    .flatMap((group) => splitDuplicateClusters(group))
    .filter((group) => group.length >= 2)
    .sort((left, right) => {
      const leftLast = new Date(left[left.length - 1].occurred_at).getTime()
      const rightLast = new Date(right[right.length - 1].occurred_at).getTime()
      return rightLast - leftLast
    })
    .slice(0, 5)
    .map((group, index) => {
      const transaction = group[group.length - 1]
      const title = resolveCounterpartyLabel(transaction)
      const subtitle = `${group.length} similar transactions · ${getBankName(bankLookup, transaction.bank_id)}`

      return {
        amount: Math.abs(transaction.amount) * group.length,
        amountLabel: `${group.length}x`,
        date: transaction.occurred_at,
        id: transaction.id * 100 + index,
        subtitle,
        title,
        tone: 'negative' as const,
      }
    })
}

function buildRawSnippet(value: string) {
  const compact = value.replace(/\s+/g, ' ').trim()
  return compact.length > 42 ? `${compact.slice(0, 39).trim()}...` : compact || 'Raw body only'
}

function buildUnusualTransactionItems(
  transactions: Array<{
    profile: ReturnType<typeof analyzeTransactionProfile>
    transaction: Transaction
  }>,
  bankLookup: Map<number, string>,
) {
  if (!transactions.length) {
    return []
  }

  const globalMedian = calculateMedian(
    transactions.map(({ transaction }) => Math.abs(transaction.amount)),
  )
  const categoryMedians = new Map<string, number>()
  const byCategory = new Map<string, number[]>()

  for (const entry of transactions) {
    const current = byCategory.get(entry.profile.category) ?? []
    current.push(Math.abs(entry.transaction.amount))
    byCategory.set(entry.profile.category, current)
  }

  for (const [category, amounts] of byCategory.entries()) {
    categoryMedians.set(category, calculateMedian(amounts))
  }

  return transactions
    .map(({ profile, transaction }) => {
      const amount = Math.abs(transaction.amount)
      const categoryMedian = categoryMedians.get(profile.category) ?? globalMedian
      const baseline = Math.max(globalMedian, categoryMedian, 1)
      const score = amount / baseline

      return {
        amount,
        profile,
        score,
        transaction,
      }
    })
    .filter(({ amount, profile, score, transaction }) => {
      const heavyCharge =
        transaction.total_charged !== null &&
        transaction.total_charged > Math.abs(transaction.amount) * 1.1

      return (
        score >= 2.4 ||
        amount >= Math.max(globalMedian * 3, 2500) ||
        heavyCharge ||
        profile.isLowConfidence
      )
    })
    .sort((left, right) => right.score - left.score || right.amount - left.amount)
    .slice(0, 5)
    .map(({ amount, profile, score, transaction }) =>
      createDashboardTransactionItem(transaction, bankLookup, {
        subtitle: `${profile.category} · ${score.toFixed(1)}x typical`,
        title: profile.counterparty,
        tone: 'negative',
        value: amount,
      }),
    )
}

function calculateMedian(values: number[]) {
  if (!values.length) {
    return 0
  }

  const sorted = [...values].sort((left, right) => left - right)
  const midpoint = Math.floor(sorted.length / 2)

  return sorted.length % 2 === 0
    ? (sorted[midpoint - 1] + sorted[midpoint]) / 2
    : sorted[midpoint]
}

function buildSearchText(transaction: Transaction) {
  return [
    transaction.counterparty,
    transaction.ref_num,
    transaction.raw_body,
    transaction.sender,
    transaction.type,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

function buildTopLabelSet(entries: Array<{ label: string; value: number }>, limit: number) {
  const totals = new Map<string, number>()

  for (const entry of entries) {
    totals.set(entry.label, (totals.get(entry.label) ?? 0) + entry.value)
  }

  return new Set(
    Array.from(totals.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, limit)
      .map(([label]) => label),
  )
}

function classifyEssentiality(category: string) {
  return new Set([
    'Bills & utilities',
    'Education',
    'Fees',
    'Groceries',
    'Health',
    'Housing',
    'People & transfers',
    'Savings & debt',
    'Transport',
  ]).has(category)
    ? 'Essential'
    : 'Non-essential'
}

function classifyExpenseStyle(
  transaction: Transaction,
  category: string,
  counterparty: string,
  recurrence:
    | {
        count: number
        months: Set<string>
      }
    | undefined,
) {
  const text = buildSearchText(transaction)
  const recurring = recurrence ? recurrence.months.size >= 2 || recurrence.count >= 3 : false
  const fixedLikeCategory = new Set([
    'Bills & utilities',
    'Fees',
    'Housing',
    'Savings & debt',
  ]).has(category)

  if (
    recurring ||
    fixedLikeCategory ||
    matchesAny(text, [
      'bundle',
      'insurance',
      'internet',
      'loan',
      'membership',
      'monthly',
      'netflix',
      'rent',
      'school',
      'spotify',
      'subscription',
      'tuition',
      'utility',
      'wifi',
      'water',
    ])
  ) {
    return 'Fixed'
  }

  if (counterparty === 'Unlabeled' && fixedLikeCategory) {
    return 'Fixed'
  }

  return 'Variable'
}

function classifySpendingCategory(transaction: Transaction) {
  const text = buildSearchText(transaction)

  if (matchesAny(text, ['fee', 'charge', 'commission', 'levy', 'penalty', 'stamp duty'])) {
    return 'Fees'
  }

  if (matchesAny(text, ['rent', 'landlord', 'house', 'apartment', 'compound'])) {
    return 'Housing'
  }

  if (
    matchesAny(text, [
      'electric',
      'ethio telecom',
      'internet',
      'mobile data',
      'telecom',
      'utility',
      'water',
      'wifi',
    ])
  ) {
    return 'Bills & utilities'
  }

  if (
    matchesAny(text, [
      'grocery',
      'market',
      'mart',
      'minimarket',
      'shop',
      'supermarket',
      'vegetable',
    ])
  ) {
    return 'Groceries'
  }

  if (
    matchesAny(text, [
      'bar',
      'burger',
      'cafe',
      'coffee',
      'food',
      'hotel',
      'juice',
      'pizza',
      'restaurant',
    ])
  ) {
    return 'Dining & hospitality'
  }

  if (
    matchesAny(text, ['bus', 'fuel', 'ride', 'taxi', 'transport', 'uber', 'parking'])
  ) {
    return 'Transport'
  }

  if (
    matchesAny(text, ['clinic', 'doctor', 'hospital', 'medical', 'pharmacy'])
  ) {
    return 'Health'
  }

  if (
    matchesAny(text, ['book', 'course', 'school', 'tuition', 'university'])
  ) {
    return 'Education'
  }

  if (
    matchesAny(text, [
      'boutique',
      'cloth',
      'cosmetic',
      'mall',
      'perfume',
      'shoe',
      'shopping',
      'store',
    ])
  ) {
    return 'Lifestyle & shopping'
  }

  if (
    matchesAny(text, [
      'cinema',
      'game',
      'movie',
      'netflix',
      'show',
      'spotify',
      'stream',
      'youtube',
    ])
  ) {
    return 'Entertainment'
  }

  if (
    transaction.type === 'TRANSFER_OUT' ||
    matchesAny(text, ['cash', 'send', 'transfer', 'wallet'])
  ) {
    return 'People & transfers'
  }

  if (
    matchesAny(text, ['credit', 'debt', 'equb', 'idir', 'investment', 'loan', 'saving'])
  ) {
    return 'Savings & debt'
  }

  return 'Uncategorized'
}

function collapseLabel(label: string, allowList: Set<string>, fallback: string) {
  return allowList.has(label) ? label : fallback
}

function hexToRgbParts(color: string) {
  const normalized = color.replace('#', '').trim()

  if (!/^[0-9a-f]{3}([0-9a-f]{3})?$/i.test(normalized)) {
    return null
  }

  const expanded =
    normalized.length === 3
      ? normalized
          .split('')
          .map((value) => `${value}${value}`)
          .join('')
      : normalized

  return {
    blue: Number.parseInt(expanded.slice(4, 6), 16),
    green: Number.parseInt(expanded.slice(2, 4), 16),
    red: Number.parseInt(expanded.slice(0, 2), 16),
  }
}

function matchesAny(text: string, keywords: string[]) {
  return keywords.some((keyword) => text.includes(keyword))
}

function mixWithWhite(color: string, weight: number) {
  const rgb = hexToRgbParts(color)

  if (!rgb) {
    return color
  }

  const mixChannel = (channel: number) =>
    Math.round(channel * (1 - weight) + 255 * weight)

  return `rgb(${mixChannel(rgb.red)}, ${mixChannel(rgb.green)}, ${mixChannel(rgb.blue)})`
}

function resolveCounterpartyLabel(transaction: Transaction) {
  const rawLabel =
    transaction.counterparty ||
    transaction.sender ||
    transaction.ref_num ||
    transaction.raw_body
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 4)
      .join(' ')

  if (!rawLabel) {
    return 'Unlabeled'
  }

  return rawLabel.replace(/\s+/g, ' ').trim().slice(0, 28)
}

function analyzeTransactionProfile(
  transaction: Transaction,
  recurrence:
    | {
        count: number
        months: Set<string>
      }
    | undefined,
) {
  const counterparty = resolveCounterpartyLabel(transaction)
  const category = classifySpendingCategory(transaction)
  const expenseStyle = classifyExpenseStyle(transaction, category, counterparty, recurrence)
  const lowConfidenceReasons: string[] = []

  if (transaction.type === 'UNKNOWN') {
    lowConfidenceReasons.push('Unknown transaction type')
  }

  if (!transaction.counterparty && !transaction.sender) {
    lowConfidenceReasons.push('Missing counterparty')
  }

  if (!transaction.ref_num) {
    lowConfidenceReasons.push('No reference')
  }

  if (category === 'Uncategorized') {
    lowConfidenceReasons.push('No category signal')
  }

  if (counterparty === 'Unlabeled') {
    lowConfidenceReasons.push('Unlabeled entity')
  }

  return {
    category,
    counterparty,
    essentiality: classifyEssentiality(category),
    expenseStyle,
    isLowConfidence: lowConfidenceReasons.length > 0,
    lowConfidenceReasons: lowConfidenceReasons.slice(0, 3),
  }
}

function createDashboardTransactionItem(
  transaction: Transaction,
  bankLookup: Map<number, string>,
  options?: {
    subtitle?: string
    title?: string
    tone?: 'negative' | 'neutral' | 'positive'
    value?: number
    amountLabel?: string
  },
): DashboardTransactionItem {
  return {
    amount: options?.value ?? Math.abs(transaction.amount),
    amountLabel: options?.amountLabel,
    date: transaction.occurred_at,
    id: transaction.id,
    subtitle:
      options?.subtitle ?? `${getBankName(bankLookup, transaction.bank_id)} · ${transaction.type}`,
    title: options?.title ?? resolveCounterpartyLabel(transaction),
    tone:
      options?.tone ??
      (transaction.type === 'CREDIT' ? 'positive' : transaction.type === 'UNKNOWN' ? 'neutral' : 'negative'),
  }
}

function getBankName(
  bankLookup: Map<number, string>,
  bankId: number,
  bankName?: string | null,
) {
  return bankLookup.get(bankId) ?? bankName ?? 'Unknown source'
}

function normalizeDuplicateLabel(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function splitDuplicateClusters(transactions: Transaction[]) {
  const sorted = [...transactions].sort(
    (left, right) =>
      new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
  )
  const clusters: Transaction[][] = []
  let current: Transaction[] = []

  for (const transaction of sorted) {
    if (!current.length) {
      current = [transaction]
      continue
    }

    const previous = current[current.length - 1]
    const gap =
      Math.abs(
        new Date(transaction.occurred_at).getTime() - new Date(previous.occurred_at).getTime(),
      ) /
      (1000 * 60 * 60 * 24)

    if (gap <= 3) {
      current.push(transaction)
      continue
    }

    clusters.push(current)
    current = [transaction]
  }

  if (current.length) {
    clusters.push(current)
  }

  return clusters
}

function resolveSpendingFlowColor(
  label: string,
  view: SpendingFlowView,
  sourceColors: Map<string, string>,
  depth = 1,
) {
  const baseColor =
    sourceColors.get(label) ??
    categoryPalette[label] ??
    (label === 'Fixed'
      ? '#89a26d'
      : label === 'Variable'
        ? '#d4875f'
        : label === 'Essential'
          ? '#4fa07d'
          : label === 'Non-essential'
            ? '#c5878b'
            : view === 'counterparty'
              ? '#8d82bd'
              : '#b69473')

  if (depth === 2) {
    return mixWithWhite(baseColor, 0.45)
  }

  if (depth === 0) {
    return mixWithWhite(baseColor, 0.18)
  }

  return baseColor
}

function resolveSpendingFlowSteps(
  record: {
    amount: number
    category: string
    counterparty: string
    essentiality: string
    expenseStyle: string
    source: string
  },
  view: SpendingFlowView,
  topCategories: Set<string>,
  topCounterparties: Set<string>,
): [string, string, string] {
  if (view === 'source') {
    return [
      collapseLabel(record.category, topCategories, 'Other categories'),
      record.source,
      collapseLabel(record.counterparty, topCounterparties, 'Other counterparties'),
    ]
  }

  if (view === 'counterparty') {
    return [
      record.source,
      collapseLabel(record.counterparty, topCounterparties, 'Other counterparties'),
      collapseLabel(record.category, topCategories, 'Other categories'),
    ]
  }

  if (view === 'expense-style') {
    return [
      record.source,
      record.expenseStyle,
      collapseLabel(record.category, topCategories, 'Other categories'),
    ]
  }

  if (view === 'essentiality') {
    return [
      record.source,
      record.essentiality,
      collapseLabel(record.category, topCategories, 'Other categories'),
    ]
  }

  return [
    record.source,
    collapseLabel(record.category, topCategories, 'Other categories'),
    collapseLabel(record.counterparty, topCounterparties, 'Other counterparties'),
  ]
}
