import { startTransition, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Sankey,
  type SankeyElementType,
  type SankeyLinkProps,
  type SankeyNodeProps,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import {
  buildDashboardTransactionReview,
  buildIncomeExpenseSeries,
  buildMetricSummary,
  buildRunningBalanceSeries,
  buildSpendingFlowGraph,
  buildSpendingDayExtremes,
  getTransactionDirection,
  type DashboardTransactionBucket,
  type DashboardTransactionItem,
  type SpendingFlowGraphLink,
  type SpendingFlowGraphNode,
  type SpendingFlowView,
  type TrendGranularity,
} from '../lib/analytics'
import { currencyCode } from '../lib/supabase'
import type { FinanceSnapshot, Transaction } from '../types'
import { formatCompactCurrency, formatCurrency, formatDateTime, formatLongDate } from '../utils/format'
import { getAccountDisplayName } from '../utils/account'

type DashboardPageProps = {
  snapshot: FinanceSnapshot
  userEmail: string
}

type ReviewSectionModalState = {
  items: DashboardTransactionItem[]
  label: string
  total: number
}

const trendOptions: Array<{ label: string; value: TrendGranularity }> = [
  { label: 'Daily', value: 'daily' },
  { label: 'Weekly', value: 'weekly' },
  { label: 'Monthly', value: 'monthly' },
]

const incomeChartColor = '#9a8b2f'
const expenseChartColor = '#d14f34'

const spendingFlowOptions: Array<{ label: string; value: SpendingFlowView }> = [
  { label: 'By category', value: 'category' },
  { label: 'By source', value: 'source' },
  { label: 'By merchant / person', value: 'counterparty' },
  { label: 'Fixed vs variable', value: 'expense-style' },
  { label: 'Essential split', value: 'essentiality' },
]

export function DashboardPage({ snapshot, userEmail }: DashboardPageProps) {
  const [trendView, setTrendView] = useState<TrendGranularity>('daily')
  const [spendingFlowView, setSpendingFlowView] = useState<SpendingFlowView>('category')
  const [selectedRiverId, setSelectedRiverId] = useState<string | null>(null)
  const [selectedReviewSection, setSelectedReviewSection] =
    useState<ReviewSectionModalState | null>(null)
  const [selectedReviewPreviewItem, setSelectedReviewPreviewItem] =
    useState<DashboardTransactionItem | null>(null)
  const [selectedReviewItem, setSelectedReviewItem] = useState<DashboardTransactionItem | null>(null)
  const spendingFlowRef = useRef<HTMLDivElement | null>(null)
  const reviewModalFrameRef = useRef<number | null>(null)
  const reviewModalFrameFollowupRef = useRef<number | null>(null)
  const overallSummary = useMemo(
    () => buildMetricSummary(snapshot.transactions),
    [snapshot.transactions],
  )
  const thisMonthTransactions = useMemo(
    () =>
      snapshot.transactions.filter((transaction) =>
        isInCurrentMonth(transaction.occurred_at),
      ),
    [snapshot.transactions],
  )
  const thisMonthSummary = useMemo(
    () => buildMetricSummary(thisMonthTransactions),
    [thisMonthTransactions],
  )
  const incomeExpenseSeries = useMemo(
    () => buildIncomeExpenseSeries(snapshot.transactions, trendView),
    [snapshot.transactions, trendView],
  )
  const runningBalanceSeries = useMemo(
    () => buildRunningBalanceSeries(snapshot.transactions, trendView),
    [snapshot.transactions, trendView],
  )
  const spendingDayExtremes = useMemo(
    () => buildSpendingDayExtremes(snapshot.transactions),
    [snapshot.transactions],
  )
  const spendingFlowGraph = useMemo(
    () =>
      buildSpendingFlowGraph(
        snapshot.transactions,
        snapshot.banks,
        spendingFlowView,
      ),
    [snapshot.transactions, snapshot.banks, spendingFlowView],
  )
  const transactionReview = useMemo(
    () =>
      buildDashboardTransactionReview(
        snapshot.transactions,
        snapshot.banks,
      ),
    [snapshot.transactions, snapshot.banks],
  )
  const reviewSections = useMemo(
    () => [
      { bucket: transactionReview.recentTransactions, label: 'Recent transactions' },
      { bucket: transactionReview.largestExpenses, label: 'Largest expenses' },
      { bucket: transactionReview.unusualTransactions, label: 'Unusual transactions' },
      {
        bucket: transactionReview.duplicateLookingTransactions,
        label: 'Duplicate-looking transactions',
      },
      {
        bucket: transactionReview.uncategorizedTransactions,
        label: 'Uncategorized transactions',
      },
      {
        bucket: transactionReview.failedParsingTransactions,
        label: 'Failed parsing / low-confidence',
      },
    ],
    [transactionReview],
  )
  const activeReviewItem = selectedReviewItem ?? selectedReviewPreviewItem
  const isReviewModalLoading = Boolean(selectedReviewPreviewItem && !selectedReviewItem)
  const selectedTransaction = useMemo(
    () =>
      selectedReviewItem
        ? resolveReviewTransaction(selectedReviewItem, snapshot.transactions)
        : null,
    [selectedReviewItem, snapshot.transactions],
  )
  const selectedBankName = useMemo(
    () =>
      selectedTransaction
        ? snapshot.banks.find((bank) => bank.id === selectedTransaction.bank_id)?.name ??
          `Bank ${selectedTransaction.bank_id}`
        : null,
    [selectedTransaction, snapshot.banks],
  )
  const duplicateCluster = useMemo(
    () =>
      selectedReviewItem?.amountLabel
        ? resolveDuplicateCluster(selectedReviewItem, snapshot.transactions)
        : [],
    [selectedReviewItem, snapshot.transactions],
  )
  const selectedRiver = useMemo(
    () => (selectedRiverId ? spendingFlowGraph.routes[selectedRiverId] : null),
    [selectedRiverId, spendingFlowGraph.routes],
  )
  const greeting = getGreeting()
  const displayName = getAccountDisplayName(userEmail)

  const clearReviewModalFrames = () => {
    if (reviewModalFrameRef.current !== null) {
      window.cancelAnimationFrame(reviewModalFrameRef.current)
      reviewModalFrameRef.current = null
    }

    if (reviewModalFrameFollowupRef.current !== null) {
      window.cancelAnimationFrame(reviewModalFrameFollowupRef.current)
      reviewModalFrameFollowupRef.current = null
    }
  }

  const closeReviewModal = () => {
    clearReviewModalFrames()
    setSelectedReviewItem(null)
    setSelectedReviewPreviewItem(null)
  }

  const openReviewSection = (
    label: string,
    items: DashboardTransactionItem[],
    total: number,
  ) => {
    setSelectedReviewSection({
      items,
      label,
      total,
    })
  }

  const closeReviewSection = () => {
    setSelectedReviewSection(null)
  }

  const openReviewModal = (item: DashboardTransactionItem) => {
    clearReviewModalFrames()
    setSelectedReviewPreviewItem(item)
    setSelectedReviewItem(null)

    reviewModalFrameRef.current = window.requestAnimationFrame(() => {
      reviewModalFrameFollowupRef.current = window.requestAnimationFrame(() => {
        startTransition(() => {
          setSelectedReviewItem(item)
        })
        reviewModalFrameRef.current = null
        reviewModalFrameFollowupRef.current = null
      })
    })
  }

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Node) || !spendingFlowRef.current) {
        return
      }

      if (!spendingFlowRef.current.contains(target)) {
        setSelectedRiverId(null)
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [])

  useEffect(() => {
    if (!activeReviewItem && !selectedReviewSection) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        clearReviewModalFrames()
        setSelectedReviewItem(null)
        setSelectedReviewPreviewItem(null)
        setSelectedReviewSection(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeReviewItem, selectedReviewSection])

  useEffect(() => clearReviewModalFrames, [])

  return (
    <>
      <div className="page-stack">
      <section className="dashboard-home-header">
        <p className="eyebrow">Home</p>
        <h1 className="dashboard-home-header__title">
          Good {greeting}, {displayName}
        </h1>
      </section>

      <section className="dashboard-kpi-grid">
        <MetricCard
          label="Current balance / net worth"
          value={formatMetricCurrency(overallSummary.balance, currencyCode)}
        />
        <MetricCard
          label="This month income"
          tone="positive"
          value={formatMetricCurrency(thisMonthSummary.incoming, currencyCode)}
        />
        <MetricCard
          label="This month spending"
          tone="negative"
          value={formatMetricCurrency(thisMonthSummary.outgoing, currencyCode)}
        />
        <MetricCard
          label="This month net flow"
          tone={thisMonthSummary.net < 0 ? 'negative' : 'positive'}
          value={formatMetricCurrency(thisMonthSummary.net, currencyCode)}
        />
        <MetricCard
          label="Number of transactions"
          value={{ amount: formatCount(snapshot.transactions.length) }}
        />
      </section>

      <div className="dashboard-divider" aria-hidden="true" />

      <section className="dashboard-analytics">
        <div className="dashboard-analytics__header">
          <div>
            <p className="eyebrow">Trends</p>
            <h2 className="section-title">Income, expense, and balance</h2>
          </div>

          <div className="pill-row" role="tablist" aria-label="Trend view">
            {trendOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={trendView === option.value ? 'pill is-active' : 'pill'}
                onClick={() => setTrendView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div className="dashboard-trends-grid">
          <article className="surface chart-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Flow</p>
                <h3 className="section-title">Income vs expense over time</h3>
              </div>
            </div>

            {incomeExpenseSeries.length ? (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={incomeExpenseSeries}>
                    <defs>
                      <linearGradient id="dashboardIncomeFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor={incomeChartColor} stopOpacity={0.26} />
                        <stop offset="95%" stopColor={incomeChartColor} stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="dashboardExpenseFill" x1="0" x2="0" y1="0" y2="1">
                        <stop offset="5%" stopColor={expenseChartColor} stopOpacity={0.22} />
                        <stop offset="95%" stopColor={expenseChartColor} stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="rgba(116, 101, 87, 0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatAxisValue}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, name) => [
                        formatCompactCurrency(parseChartNumber(value), currencyCode),
                        name === 'incoming' ? 'Income' : 'Expense',
                      ]}
                    />
                    <Area
                      type="monotone"
                      dataKey="incoming"
                      animationDuration={300}
                      stroke={incomeChartColor}
                      fill="url(#dashboardIncomeFill)"
                      strokeWidth={2.25}
                    />
                    <Area
                      type="monotone"
                      dataKey="outgoing"
                      animationDuration={300}
                      stroke={expenseChartColor}
                      fill="url(#dashboardExpenseFill)"
                      strokeWidth={2.25}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No trend data." />
            )}
          </article>

          <article className="surface chart-card">
            <div className="section-head">
              <div>
                <p className="eyebrow">Balance</p>
                <h3 className="section-title">Running balance trend</h3>
              </div>
            </div>

            {runningBalanceSeries.length ? (
              <div className="chart-frame">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={runningBalanceSeries}>
                    <CartesianGrid stroke="rgba(116, 101, 87, 0.08)" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={axisTick}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={formatAxisValue}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value) => formatCompactCurrency(parseChartNumber(value), currencyCode)}
                    />
                    <Line
                      type="monotone"
                      dataKey="balance"
                      animationDuration={300}
                      stroke="#8d6b49"
                      strokeWidth={2.25}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No balance data." />
            )}
          </article>
        </div>

        <div className="dashboard-stat-grid">
          <InsightCard
            label="Best spending day"
            tone="positive"
            title={spendingDayExtremes.best ? formatLongDate(spendingDayExtremes.best.date) : '--'}
            value={
              spendingDayExtremes.best
                ? formatCompactCurrency(spendingDayExtremes.best.value, currencyCode)
                : '--'
            }
          />
          <InsightCard
            label="Worst spending day"
            tone="negative"
            title={spendingDayExtremes.worst ? formatLongDate(spendingDayExtremes.worst.date) : '--'}
            value={
              spendingDayExtremes.worst
                ? formatCompactCurrency(spendingDayExtremes.worst.value, currencyCode)
                : '--'
            }
          />
        </div>

        <div className="dashboard-divider dashboard-divider--section" aria-hidden="true" />

        <section className="dashboard-flow-stack" ref={spendingFlowRef}>
          <div className="dashboard-analytics__header">
            <div>
              <p className="eyebrow">Spend flow</p>
              <h2 className="section-title">Where your spending moves</h2>
            </div>

            <div className="pill-row" role="tablist" aria-label="Spending flow view">
              {spendingFlowOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    spendingFlowView === option.value ? 'pill is-active' : 'pill'
                  }
                  onClick={() => {
                    setSpendingFlowView(option.value)
                    setSelectedRiverId(null)
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {selectedRiver ? (
            <div className="dashboard-flow-selection">
              <span className="dashboard-flow-selection__label">{selectedRiver.label}</span>
              <strong className="dashboard-flow-selection__value">
                {formatCompactCurrency(selectedRiver.amount, currencyCode)}
              </strong>
            </div>
          ) : null}

          <article className="surface chart-card chart-card--full">
            {spendingFlowGraph.links.length ? (
              <div
                className="chart-frame chart-frame--river"
                onClick={() => setSelectedRiverId(null)}
                role="presentation"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <Sankey
                    data={spendingFlowGraph}
                    align="justify"
                    link={(props) => (
                      <FlowLink
                        {...props}
                        activeRiverId={selectedRiverId}
                      />
                    )}
                    margin={{ bottom: 18, left: 24, right: 24, top: 24 }}
                    node={(props) => (
                      <FlowNode
                        {...props}
                        activeRiverId={selectedRiverId}
                      />
                    )}
                    nodePadding={18}
                    nodeWidth={14}
                    sort
                    verticalAlign="justify"
                    onClick={(item, type, event) => {
                      if (type !== 'link') {
                        return
                      }

                      event.stopPropagation()
                      setSelectedRiverId(resolveRiverId(item, type))
                    }}
                  >
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value, _name, item) => [
                        formatCompactCurrency(parseChartNumber(value), currencyCode),
                        formatFlowTooltipLabel(item?.payload),
                      ]}
                    />
                  </Sankey>
                </ResponsiveContainer>
              </div>
            ) : (
              <EmptyState message="No outgoing spending flow." />
            )}
          </article>

          <div className="dashboard-watchlist-grid">
            {reviewSections.map((section) => (
              <TransactionReviewCard
                key={section.label}
                label={section.label}
                bucket={section.bucket}
                items={section.bucket.items}
                onOpenSection={openReviewSection}
                onSelect={openReviewModal}
              />
            ))}
          </div>
        </section>
      </section>
      </div>

      {activeReviewItem ? (
        <TransactionDetailModal
          item={activeReviewItem}
          loading={isReviewModalLoading}
          transaction={selectedTransaction}
          bankName={selectedBankName ?? 'Bank'}
          duplicateCluster={selectedTransaction ? duplicateCluster : []}
          onClose={closeReviewModal}
        />
      ) : selectedReviewSection ? (
        <TransactionReviewListModal
          key={`${selectedReviewSection.label}-${selectedReviewSection.total}`}
          items={selectedReviewSection.items}
          label={selectedReviewSection.label}
          onClose={closeReviewSection}
          onSelect={(item) => {
            closeReviewSection()
            openReviewModal(item)
          }}
          total={selectedReviewSection.total}
        />
      ) : null}
    </>
  )
}

function MetricCard({
  label,
  tone = 'neutral',
  value,
}: {
  label: string
  tone?: 'negative' | 'neutral' | 'positive'
  value: {
    amount: string
    prefix?: string
  }
}) {
  return (
    <article className="surface dashboard-kpi-card">
      <span className="dashboard-kpi-card__label">{label}</span>
      <div className={`dashboard-kpi-card__metric dashboard-kpi-card__value--${tone}`}>
        {value.prefix ? (
          <span className="dashboard-kpi-card__prefix">{value.prefix}</span>
        ) : null}
        <strong className="dashboard-kpi-card__value">{value.amount}</strong>
      </div>
    </article>
  )
}

function InsightCard({
  label,
  title,
  tone,
  value,
}: {
  label: string
  title: string
  tone: 'negative' | 'positive'
  value: string
}) {
  return (
    <article className="surface dashboard-insight-card">
      <span className="dashboard-insight-card__label">{label}</span>
      <strong className="dashboard-insight-card__title">{title}</strong>
      <span className={`dashboard-insight-card__value dashboard-insight-card__value--${tone}`}>
        {value}
      </span>
    </article>
  )
}

function EmptyState({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>
}

function TransactionReviewCard({
  bucket,
  items,
  label,
  onOpenSection,
  onSelect,
}: {
  bucket: DashboardTransactionBucket
  items: DashboardTransactionItem[]
  label: string
  onOpenSection: (label: string, items: DashboardTransactionItem[], total: number) => void
  onSelect: (item: DashboardTransactionItem) => void
}) {
  return (
    <article className="surface dashboard-review-card">
      <button
        type="button"
        className="dashboard-review-card__head-button"
        onClick={() => onOpenSection(label, bucket.allItems, bucket.total)}
      >
        <div className="dashboard-review-card__head">
          <span className="dashboard-review-card__label">{label}</span>
          <span className="dashboard-review-card__count">{bucket.total}</span>
        </div>
      </button>

      {items.length ? (
        <div className="dashboard-review-list">
          {items.map((item) => (
            <TransactionReviewRow
              key={`${label}-${item.id}-${item.date}`}
              item={item}
              onSelect={onSelect}
            />
          ))}
        </div>
      ) : (
        <div className="dashboard-review-card__empty">No matching rows.</div>
      )}
    </article>
  )
}

function TransactionReviewRow({
  item,
  onSelect,
}: {
  item: DashboardTransactionItem
  onSelect: (item: DashboardTransactionItem) => void
}) {
  return (
    <button
      type="button"
      className="dashboard-review-row"
      onClick={() => onSelect(item)}
    >
      <div className="dashboard-review-row__copy">
        <strong>{item.title}</strong>
        <span>{item.subtitle}</span>
        <span>{formatDateTime(item.date)}</span>
      </div>
      <div className="dashboard-review-row__value">
        {item.amountLabel ? (
          <span className="dashboard-review-row__badge">{item.amountLabel}</span>
        ) : null}
        <strong className={`dashboard-review-row__amount dashboard-review-row__amount--${item.tone}`}>
          {formatCompactCurrency(item.amount, currencyCode)}
        </strong>
      </div>
    </button>
  )
}

function TransactionReviewListModal({
  items,
  label,
  onClose,
  onSelect,
  total,
}: {
  items: DashboardTransactionItem[]
  label: string
  onClose: () => void
  onSelect: (item: DashboardTransactionItem) => void
  total: number
}) {
  const [visibleRows, setVisibleRows] = useState(20)
  const visibleItems = items.slice(0, visibleRows)
  const hasMoreRows = visibleItems.length < items.length

  return (
    <div
      className="dashboard-review-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      role="presentation"
    >
      <section
        className="dashboard-review-modal dashboard-review-modal--list surface"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={label}
      >
        <div className="dashboard-review-modal__head">
          <div>
            <p className="eyebrow">Full list</p>
            <h3 className="section-title">{label}</h3>
          </div>
          <div className="dashboard-review-modal__head-actions">
            <span className="dashboard-review-card__count">{total}</span>
            <button
              type="button"
              className="button button--ghost"
              onClick={onClose}
            >
              Close
            </button>
          </div>
        </div>

        {items.length ? (
          <>
            <div className="dashboard-review-list dashboard-review-list--modal">
              {visibleItems.map((item) => (
                <TransactionReviewRow
                  key={`${label}-${item.id}-${item.date}-full`}
                  item={item}
                  onSelect={onSelect}
                />
              ))}
            </div>

            {hasMoreRows ? (
              <div className="ledger-load-more">
                <button
                  type="button"
                  className="button button--ghost"
                  onClick={() => setVisibleRows((count) => count + 100)}
                >
                  Load more
                </button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="dashboard-review-card__empty">No rows in this section.</div>
        )}
      </section>
    </div>
  )
}

function TransactionDetailModal({
  bankName,
  duplicateCluster,
  item,
  loading,
  onClose,
  transaction,
}: {
  bankName: string
  duplicateCluster: Transaction[]
  item: DashboardTransactionItem
  loading: boolean
  onClose: () => void
  transaction: Transaction | null
}) {
  return (
    <div
      className="dashboard-review-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
      role="presentation"
    >
      <section
        className="dashboard-review-modal surface"
        onClick={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Transaction details"
        aria-busy={loading}
      >
        <div className="dashboard-review-modal__head">
          <div>
            <p className="eyebrow">Transaction detail</p>
            <h3 className="section-title">{item.title}</h3>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading || !transaction ? (
          <div className="dashboard-review-modal__loading">
            <div className="dashboard-review-modal__loading-card">
              <div className="dashboard-review-modal__loading-copy">
                <span className="dashboard-review-modal__loading-kicker">Preparing detail</span>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </div>
              <div className="dashboard-review-modal__loading-grid">
                <LoadingField width="58%" />
                <LoadingField width="48%" />
                <LoadingField width="42%" />
                <LoadingField width="64%" />
              </div>
            </div>
          </div>
        ) : (
          <>
        <div className="dashboard-review-modal__hero">
          <div>
            <span className="dashboard-review-modal__eyebrow">Amount</span>
            <strong className={`dashboard-review-modal__amount dashboard-review-modal__amount--${item.tone}`}>
              {formatCurrency(transaction.amount, currencyCode)}
            </strong>
          </div>
          <div>
            <span className="dashboard-review-modal__eyebrow">Occurred</span>
            <strong>{formatDateTime(transaction.occurred_at)}</strong>
          </div>
          <div>
            <span className="dashboard-review-modal__eyebrow">Bank</span>
            <strong>{bankName}</strong>
          </div>
        </div>

        <div className="dashboard-review-modal__grid">
          <DetailField label="Direction" value={getTransactionDirection(transaction.type)} />
          <DetailField label="Type" value={transaction.type} />
          <DetailField label="Sender" value={transaction.sender || '--'} />
          <DetailField label="Counterparty" value={transaction.counterparty || '--'} />
          <DetailField label="Reference" value={transaction.ref_num || '--'} />
          <DetailField label="Created" value={formatDateTime(transaction.created_at)} />
          <DetailField label="Balance" value={formatCurrency(transaction.balance, currencyCode)} />
          <DetailField label="Total charged" value={formatCurrency(transaction.total_charged, currencyCode)} />
          <DetailField label="Bank ID" value={String(transaction.bank_id)} />
          <DetailField label="Transaction ID" value={String(transaction.id)} />
          <div className="dashboard-review-modal__field">
            <span>Receipt</span>
            {transaction.receipt_link ? (
              <a
                href={transaction.receipt_link}
                target="_blank"
                rel="noopener noreferrer"
                className="button button--ghost button--small receipt-button"
                style={{ padding: '0.2rem 0.6rem', minHeight: '1.5rem', fontSize: '0.75rem' }}
              >
                View receipt
              </a>
            ) : (
              <strong>--</strong>
            )}
          </div>
          <DetailField label="Summary" value={item.subtitle} />
        </div>

        {duplicateCluster.length > 1 ? (
          <div className="dashboard-review-modal__section">
            <p className="eyebrow">Related duplicates</p>
            <div className="dashboard-review-modal__duplicates">
              {duplicateCluster.map((entry) => (
                <div key={entry.id} className="dashboard-review-modal__duplicate-row">
                  <span>{formatDateTime(entry.occurred_at)}</span>
                  <strong>{formatCurrency(entry.amount, currencyCode)}</strong>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dashboard-review-modal__section">
          <p className="eyebrow">Raw body</p>
          <pre className="dashboard-review-modal__raw mono">{transaction.raw_body || '--'}</pre>
        </div>
          </>
        )}
      </section>
    </div>
  )
}

function LoadingField({ width }: { width: string }) {
  return (
    <div className="dashboard-review-modal__loading-field">
      <span className="dashboard-review-modal__loading-label shimmer-line" />
      <span className="dashboard-review-modal__loading-value shimmer-line" style={{ width }} />
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="dashboard-review-modal__field">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  )
}

function FlowLink({
  activeRiverId,
  linkWidth,
  payload,
  sourceControlX,
  sourceX,
  sourceY,
  targetControlX,
  targetX,
  targetY,
}: SankeyLinkProps & { activeRiverId: string | null }) {
  const flowLink = payload as SankeyLinkProps['payload'] & SpendingFlowGraphLink
  const isActive = activeRiverId ? flowLink.routeIds.includes(activeRiverId) : true
  const isDimmed = activeRiverId !== null && !isActive

  return (
    <path
      d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
      fill="none"
      stroke={flowLink.color}
      strokeOpacity={isDimmed ? 0.1 : isActive && activeRiverId ? 0.92 : 0.28}
      strokeWidth={linkWidth}
      style={{ transition: 'stroke-opacity 140ms ease' }}
    />
  )
}

function FlowNode({
  activeRiverId,
  height,
  payload,
  width,
  x,
  y,
}: SankeyNodeProps & { activeRiverId: string | null }) {
  const flowNode = payload as SankeyNodeProps['payload'] & SpendingFlowGraphNode
  const isActive = activeRiverId ? flowNode.routeIds.includes(activeRiverId) : true
  const isDimmed = activeRiverId !== null && !isActive
  const label = truncateFlowLabel(flowNode.name)
  const labelX = flowNode.depth === 2 ? x - 10 : flowNode.depth === 1 ? x + width / 2 : x + width + 10
  const labelY = flowNode.depth === 1 ? y - 8 : y + height / 2 + 4
  const textAnchor = flowNode.depth === 2 ? 'end' : flowNode.depth === 1 ? 'middle' : 'start'

  return (
    <g style={{ opacity: isDimmed ? 0.28 : 1, transition: 'opacity 140ms ease' }}>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx={6}
        fill={flowNode.fill}
        stroke="rgba(116, 101, 87, 0.18)"
      />
      <text
        x={labelX}
        y={labelY}
        fill="#6b5846"
        fontFamily="var(--body-font)"
        fontSize="11"
        fontWeight="500"
        textAnchor={textAnchor}
      >
        {label}
      </text>
    </g>
  )
}

function isInCurrentMonth(value: string) {
  const now = new Date()
  const date = new Date(value)

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  )
}

function formatCount(value: number) {
  return new Intl.NumberFormat('en-KE').format(value)
}

function formatMetricCurrency(value: number | null, currency: string) {
  if (value === null || Number.isNaN(value)) {
    return { amount: '--' }
  }

  const absoluteValue = Math.abs(value)
  const amount = new Intl.NumberFormat('en-KE', {
    maximumFractionDigits: absoluteValue >= 1000 ? 1 : 2,
    notation: absoluteValue >= 1000 ? 'compact' : 'standard',
  }).format(absoluteValue)

  return {
    amount,
    prefix: value < 0 ? `- ${currency}` : currency,
  }
}

function parseChartNumber(value: unknown) {
  if (typeof value === 'number') {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  return null
}

function formatFlowTooltipLabel(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return 'Flow'
  }

  if ('source' in payload && 'target' in payload) {
    const link = payload as {
      source?: { name?: string }
      target?: { name?: string }
    }

    return `${link.source?.name ?? 'Source'} -> ${link.target?.name ?? 'Target'}`
  }

  if ('name' in payload && typeof payload.name === 'string') {
    return payload.name
  }

  return 'Flow'
}

function formatAxisValue(value: number) {
  return formatCompactCurrency(value, currencyCode).replace('ETB', '').trim()
}

function getGreeting() {
  const hour = new Date().getHours()

  if (hour < 12) {
    return 'morning'
  }

  if (hour < 18) {
    return 'afternoon'
  }

  return 'evening'
}

function resolveRiverId(
  item: SankeyLinkProps | SankeyNodeProps,
  type: SankeyElementType,
) {
  if (type !== 'link') {
    return null
  }

  const flowLink = item.payload as SankeyLinkProps['payload'] & SpendingFlowGraphLink
  return flowLink.primaryRouteId || null
}

function truncateFlowLabel(value: string) {
  return value.length > 24 ? `${value.slice(0, 21).trim()}...` : value
}

function resolveReviewTransaction(
  item: DashboardTransactionItem,
  transactions: Transaction[],
) {
  const byId = transactions.find((transaction) => transaction.id === item.id)

  if (byId) {
    return byId
  }

  return transactions.find((transaction) => {
    if (transaction.occurred_at !== item.date) {
      return false
    }

    return buildTransactionReviewLabel(transaction) === item.title
  }) ?? null
}

function resolveDuplicateCluster(
  item: DashboardTransactionItem,
  transactions: Transaction[],
) {
  if (!item.amountLabel?.endsWith('x')) {
    return []
  }

  const anchor = resolveReviewTransaction(item, transactions)

  if (!anchor) {
    return []
  }

  const normalizedLabel = buildTransactionReviewLabel(anchor)
  const anchorAmount = Math.abs(anchor.amount)
  const sortedMatches = transactions
    .filter((transaction) => {
      if (Math.abs(transaction.amount) !== anchorAmount) {
        return false
      }

      return buildTransactionReviewLabel(transaction) === normalizedLabel
    })
    .sort(
      (left, right) =>
        new Date(left.occurred_at).getTime() - new Date(right.occurred_at).getTime(),
    )

  if (!sortedMatches.length) {
    return []
  }

  const clusters = splitTransactionClusters(sortedMatches)
  return (
    clusters.find((cluster) => cluster.some((transaction) => transaction.id === anchor.id)) ?? []
  )
}

function splitTransactionClusters(transactions: Transaction[]) {
  const clusters: Transaction[][] = []
  let current: Transaction[] = []

  for (const transaction of transactions) {
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

function buildTransactionReviewLabel(transaction: Transaction) {
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

const axisTick = {
  fill: '#988574',
  fontSize: 11,
}

const tooltipStyle = {
  backgroundColor: 'rgba(253, 250, 245, 0.98)',
  border: '1px solid rgba(116, 101, 87, 0.14)',
  borderRadius: '12px',
  boxShadow: 'none',
  color: '#574838',
}
