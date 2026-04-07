import { useDeferredValue, useEffect, useRef, useState } from 'react'
import {
  createEmptyFilters,
  datePresetOptions,
  filterTransactions,
  getTransactionDirection,
  resolveDatePreset,
} from '../lib/analytics'
import { currencyCode } from '../lib/supabase'
import type {
  Bank,
  DatePreset,
  FinanceSnapshot,
  Transaction,
  TransactionDirection,
  TransactionFilters,
  TransactionSort,
} from '../types'
import {
  formatCurrency,
  formatDateTime,
  formatLongDate,
  formatMonthLabel,
  toInputDate,
} from '../utils/format'

type TransactionsPageProps = {
  snapshot: FinanceSnapshot
}

type FilterOption<T extends string> = {
  label: string
  value: T
}

const directionOptions: FilterOption<TransactionDirection>[] = [
  { label: 'All directions', value: 'ALL' },
  { label: 'Incoming only', value: 'INCOMING' },
  { label: 'Outgoing only', value: 'OUTGOING' },
]

const sortOptions: FilterOption<TransactionSort>[] = [
  { label: 'Newest first', value: 'date-desc' },
  { label: 'Oldest first', value: 'date-asc' },
  { label: 'Largest amount', value: 'amount-desc' },
  { label: 'Smallest amount', value: 'amount-asc' },
  { label: 'Highest balance', value: 'balance-desc' },
  { label: 'Lowest balance', value: 'balance-asc' },
]

const weekdayLabels = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']
const typeOptions = ['CREDIT', 'DEBIT', 'PAYMENT', 'TRANSFER_OUT', 'UNKNOWN']
const initialVisibleRows = 20
const loadMoreBatchSize = 100

export function TransactionsPage({ snapshot }: TransactionsPageProps) {
  const [preset, setPreset] = useState<DatePreset>('all')
  const [filters, setFilters] = useState<TransactionFilters>(createEmptyFilters())
  const [visibleRows, setVisibleRows] = useState(initialVisibleRows)
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null)
  const deferredSearch = useDeferredValue(filters.search)
  const activePresetDates = preset === 'custom' ? null : resolveDatePreset(preset)
  const effectiveFilters = {
    ...filters,
    endDate: activePresetDates?.endDate ?? filters.endDate,
    search: deferredSearch,
    startDate: activePresetDates?.startDate ?? filters.startDate,
  }
  const filteredTransactions = filterTransactions(
    snapshot.transactions,
    snapshot.banks,
    effectiveFilters,
  )
  const activeSelectedTransaction = selectedTransaction
    ? filteredTransactions.find((transaction) => transaction.id === selectedTransaction.id) ?? null
    : null
  const totalBaseRows = snapshot.transactions.length
  const visibleTransactions = filteredTransactions.slice(0, visibleRows)
  const hasMoreRows = visibleTransactions.length < filteredTransactions.length

  const resetVisibleRows = () => setVisibleRows(initialVisibleRows)

  useEffect(() => {
    if (!activeSelectedTransaction) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedTransaction(null)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [activeSelectedTransaction])

  return (
    <>
      <div className="page-stack page-stack--full">
        <section id="filters" className="surface">
        <div className="section-head">
          <div>
            <p className="eyebrow">Filter panel</p>
            <h3 className="section-title">Search, dates, banks, sorting</h3>
          </div>
          <div className="inline-actions">
            <button
              type="button"
              className="button button--ghost"
              onClick={() => {
                resetVisibleRows()
                setPreset('all')
                setFilters(createEmptyFilters())
              }}
            >
              Clear all filters
            </button>
          </div>
        </div>

        <div className="control-stack">
          <div className="pill-row">
            {datePresetOptions.map((option) => (
              <button
                key={option.value}
                type="button"
                className={preset === option.value ? 'pill is-active' : 'pill'}
                onClick={() => {
                  resetVisibleRows()
                  setPreset(option.value)
                }}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              className={preset === 'custom' ? 'pill is-active' : 'pill'}
              onClick={() => {
                resetVisibleRows()
                setPreset('custom')
              }}
            >
              Custom dates
            </button>
          </div>

          <div className="filter-grid">
            <label className="field">
              <span>Search everything</span>
              <input
                type="search"
                value={filters.search}
                placeholder="Reference, bank, sender, counterparty, raw text"
                onChange={(event) => {
                  resetVisibleRows()
                  setFilters({ ...filters, search: event.target.value })
                }}
              />
            </label>

            <div className="field">
              <span>Direction</span>
              <FilterSelect
                ariaLabel="Direction"
                options={directionOptions}
                value={filters.direction}
                onChange={(value) => {
                  resetVisibleRows()
                  setFilters({ ...filters, direction: value })
                }}
              />
            </div>

            <div className="field">
              <span>Sort order</span>
              <FilterSelect
                ariaLabel="Sort order"
                options={sortOptions}
                value={filters.sortBy}
                onChange={(value) => {
                  resetVisibleRows()
                  setFilters({ ...filters, sortBy: value })
                }}
              />
            </div>

            <div className="field">
              <span>Start date</span>
              <DatePickerField
                ariaLabel="Start date"
                placeholder="MM/DD/YYYY"
                value={effectiveFilters.startDate}
                onChange={(value) => {
                  resetVisibleRows()
                  setPreset('custom')
                  setFilters({ ...filters, startDate: value })
                }}
              />
            </div>

            <div className="field">
              <span>End date</span>
              <DatePickerField
                ariaLabel="End date"
                placeholder="MM/DD/YYYY"
                value={effectiveFilters.endDate}
                onChange={(value) => {
                  resetVisibleRows()
                  setPreset('custom')
                  setFilters({ ...filters, endDate: value })
                }}
              />
            </div>

            <label className="field">
              <span>Minimum amount</span>
              <input
                type="number"
                min="0"
                step="1"
                value={filters.minAmount}
                placeholder="0"
                onChange={(event) => {
                  resetVisibleRows()
                  setFilters({ ...filters, minAmount: event.target.value })
                }}
              />
            </label>

            <label className="field">
              <span>Maximum amount</span>
              <input
                type="number"
                min="0"
                step="1"
                value={filters.maxAmount}
                placeholder="100000"
                onChange={(event) => {
                  resetVisibleRows()
                  setFilters({ ...filters, maxAmount: event.target.value })
                }}
              />
            </label>
          </div>

          <div className="filter-group">
            <span className="filter-group__label">Banks</span>
            <div className="pill-row">
              {snapshot.banks.map((bank) => (
                <button
                  key={bank.id}
                  type="button"
                  className={
                    filters.selectedBankIds.includes(bank.id) ? 'pill is-active' : 'pill'
                  }
                  onClick={() => {
                    resetVisibleRows()
                    setFilters({
                      ...filters,
                      selectedBankIds: toggleNumberSelection(
                        filters.selectedBankIds,
                        bank.id,
                      ),
                    })
                  }}
                >
                  {bank.name}
                </button>
              ))}
            </div>
          </div>

          <div className="filter-group">
            <span className="filter-group__label">Transaction types</span>
            <div className="pill-row">
              {typeOptions.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={
                    filters.selectedTypes.includes(type) ? 'pill is-active' : 'pill'
                  }
                  onClick={() => {
                    resetVisibleRows()
                    setFilters({
                      ...filters,
                      selectedTypes: toggleTextSelection(filters.selectedTypes, type),
                    })
                  }}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
        </section>

        <section id="ledger" className="surface">
          <div className="section-head">
            <div>
              <p className="eyebrow">Filtered ledger</p>
              <h3 className="section-title">Advanced transaction list</h3>
            </div>
            <p className="section-copy">
              {visibleTransactions.length} of {filteredTransactions.length} rows
              {filteredTransactions.length !== totalBaseRows ? ' in view' : ''}
            </p>
          </div>

          {filteredTransactions.length ? (
            <>
              <div className="table-wrap">
                <table className="data-table data-table--wide">
                  <thead>
                    <tr>
                      <th>Occurred</th>
                      <th>Type</th>
                      <th>Bank</th>
                      <th>Sender</th>
                      <th>Counterparty</th>
                      <th>Amount</th>
                      <th>Total charged</th>
                      <th>Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTransactions.map((transaction) => (
                      <tr
                        key={transaction.id}
                        className="data-table__row--interactive"
                        onClick={() => setSelectedTransaction(transaction)}
                      >
                        <td>
                          <strong>{formatDateTime(transaction.occurred_at)}</strong>
                          <p>{formatLongDate(transaction.created_at)}</p>
                        </td>
                        <td>
                          <span className="badge">{transaction.type}</span>
                        </td>
                        <td>{getBankLabel(snapshot.banks, transaction.bank_id)}</td>
                        <td>{transaction.sender}</td>
                        <td>{transaction.counterparty || 'Unlabeled'}</td>
                        <td className={valueTone(transaction.type)}>
                          {formatCurrency(transaction.amount, currencyCode)}
                        </td>
                        <td>{formatCurrency(transaction.total_charged, currencyCode)}</td>
                        <td>{formatCurrency(transaction.balance, currencyCode)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {hasMoreRows ? (
                <div className="ledger-load-more">
                  <button
                    type="button"
                    className="button button--ghost"
                    onClick={() => setVisibleRows((count) => count + loadMoreBatchSize)}
                  >
                    Load more
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyChart message="No matching transactions." />
          )}
        </section>
      </div>

      {activeSelectedTransaction ? (
        <TransactionDetailModal
          bankName={getBankLabel(snapshot.banks, activeSelectedTransaction.bank_id)}
          onClose={() => setSelectedTransaction(null)}
          transaction={activeSelectedTransaction}
        />
      ) : null}
    </>
  )
}

function EmptyChart({ message }: { message: string }) {
  return <div className="empty-state">{message}</div>
}

function FilterSelect<T extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string
  onChange: (value: T) => void
  options: FilterOption<T>[]
  value: T
}) {
  const [open, setOpen] = useState(false)
  const shellRef = useDismissiblePopover(open, () => setOpen(false))
  const selectedOption = options.find((option) => option.value === value)

  return (
    <div ref={shellRef} className="field-menu">
      <button
        type="button"
        className={open ? 'field-control field-control--menu is-open' : 'field-control field-control--menu'}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="field-control__value">{selectedOption?.label ?? ''}</span>
        <span className="field-control__icon field-control__icon--chevron" aria-hidden="true">
          <ChevronDownIcon />
        </span>
      </button>

      {open ? (
        <div className="field-popover field-popover--menu" role="listbox" aria-label={ariaLabel}>
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'field-option is-selected' : 'field-option'}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

function DatePickerField({
  ariaLabel,
  onChange,
  placeholder,
  value,
}: {
  ariaLabel: string
  onChange: (value: string) => void
  placeholder: string
  value: string
}) {
  const [open, setOpen] = useState(false)
  const [displayMonth, setDisplayMonth] = useState(() => getCalendarAnchorDate(value))
  const shellRef = useDismissiblePopover(open, () => setOpen(false))
  const todayValue = toInputDate(new Date())

  return (
    <div ref={shellRef} className="field-menu">
      <button
        type="button"
        className={open ? 'field-control field-control--menu is-open' : 'field-control field-control--menu'}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={ariaLabel}
        onClick={() =>
          setOpen((current) => {
            if (current) {
              return false
            }

            setDisplayMonth(getCalendarAnchorDate(value))
            return true
          })
        }
      >
        <span className={value ? 'field-control__value' : 'field-control__placeholder'}>
          {value ? formatPickerDisplay(value) : placeholder}
        </span>
        <span className="field-control__icon" aria-hidden="true">
          <CalendarIcon />
        </span>
      </button>

      {open ? (
        <div className="field-popover field-popover--calendar" role="dialog" aria-label={ariaLabel}>
          <div className="date-picker">
            <div className="date-picker__header">
              <strong className="date-picker__month">
                {formatMonthLabel(toInputDate(displayMonth))}
              </strong>
              <div className="date-picker__nav">
                <button
                  type="button"
                  className="date-picker__nav-button"
                  aria-label="Previous month"
                  onClick={() => setDisplayMonth(shiftCalendarMonth(displayMonth, -1))}
                >
                  <ChevronLeftIcon />
                </button>
                <button
                  type="button"
                  className="date-picker__nav-button"
                  aria-label="Next month"
                  onClick={() => setDisplayMonth(shiftCalendarMonth(displayMonth, 1))}
                >
                  <ChevronRightIcon />
                </button>
              </div>
            </div>

            <div className="date-picker__weekdays">
              {weekdayLabels.map((label) => (
                <span key={label}>{label}</span>
              ))}
            </div>

            <div className="date-picker__grid">
              {buildCalendarDays(displayMonth).map((day) => {
                const dayValue = toInputDate(day.date)
                const isSelected = dayValue === value
                const isToday = dayValue === todayValue
                const className = [
                  'date-picker__day',
                  !day.inCurrentMonth ? 'is-outside' : '',
                  isSelected ? 'is-selected' : '',
                  isToday ? 'is-today' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={dayValue}
                    type="button"
                    className={className}
                    onClick={() => {
                      onChange(dayValue)
                      setOpen(false)
                    }}
                  >
                    {day.date.getDate()}
                  </button>
                )
              })}
            </div>

            <div className="date-picker__footer">
              <button
                type="button"
                className="date-picker__action"
                onClick={() => {
                  onChange('')
                  setOpen(false)
                }}
              >
                Clear
              </button>
              <button
                type="button"
                className="date-picker__action"
                onClick={() => {
                  onChange(todayValue)
                  setOpen(false)
                }}
              >
                Today
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function TransactionDetailModal({
  bankName,
  onClose,
  transaction,
}: {
  bankName: string
  onClose: () => void
  transaction: Transaction
}) {
  const title = buildTransactionTitle(transaction)
  const summary = `${bankName} · ${transaction.type}`
  const tone = transaction.amount > 0 ? 'positive' : transaction.amount < 0 ? 'negative' : 'neutral'

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
      >
        <div className="dashboard-review-modal__head">
          <div>
            <p className="eyebrow">Transaction detail</p>
            <h3 className="section-title">{title}</h3>
          </div>
          <button
            type="button"
            className="button button--ghost"
            onClick={onClose}
          >
            Close
          </button>
        </div>

        <div className="dashboard-review-modal__hero">
          <div>
            <span className="dashboard-review-modal__eyebrow">Amount</span>
            <strong className={`dashboard-review-modal__amount dashboard-review-modal__amount--${tone}`}>
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
          <DetailField label="Summary" value={summary} />
        </div>

        <div className="dashboard-review-modal__section">
          <p className="eyebrow">Raw body</p>
          <pre className="dashboard-review-modal__raw mono">{transaction.raw_body || '--'}</pre>
        </div>
      </section>
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

function useDismissiblePopover(open: boolean, onClose: () => void) {
  const shellRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!open) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target

      if (!(target instanceof Node) || !shellRef.current) {
        return
      }

      if (!shellRef.current.contains(target)) {
        onClose()
      }
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [onClose, open])

  return shellRef
}

function buildCalendarDays(displayMonth: Date) {
  const firstDayOfMonth = new Date(
    displayMonth.getFullYear(),
    displayMonth.getMonth(),
    1,
  )
  const gridStart = new Date(firstDayOfMonth)
  gridStart.setDate(firstDayOfMonth.getDate() - firstDayOfMonth.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)

    return {
      date,
      inCurrentMonth: date.getMonth() === displayMonth.getMonth(),
    }
  })
}

function formatPickerDisplay(value: string) {
  const date = parsePickerDate(value)

  if (!date) {
    return ''
  }

  return new Intl.DateTimeFormat('en-US', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date)
}

function getCalendarAnchorDate(value: string) {
  const parsedDate = parsePickerDate(value) ?? new Date()
  return new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1)
}

function parsePickerDate(value: string) {
  if (!value) {
    return null
  }

  const [year, month, day] = value.split('-').map((part) => Number(part))

  if (!year || !month || !day) {
    return null
  }

  return new Date(year, month - 1, day)
}

function shiftCalendarMonth(value: Date, amount: number) {
  return new Date(value.getFullYear(), value.getMonth() + amount, 1)
}

function toggleNumberSelection(selection: number[], value: number) {
  return selection.includes(value)
    ? selection.filter((item) => item !== value)
    : [...selection, value]
}

function toggleTextSelection(selection: string[], value: string) {
  return selection.includes(value)
    ? selection.filter((item) => item !== value)
    : [...selection, value]
}

function getBankLabel(banks: Bank[], bankId: number) {
  return banks.find((bank) => bank.id === bankId)?.name ?? `Bank ${bankId}`
}

function valueTone(type: string) {
  return type === 'CREDIT' ? 'value-positive' : 'value-negative'
}

function buildTransactionTitle(transaction: Transaction) {
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

  return rawLabel.replace(/\s+/g, ' ').trim().slice(0, 48)
}

function CalendarIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M5.25 1.75V3.25M10.75 1.75V3.25M2.25 5.25H13.75M3.25 2.5H12.75C13.1642 2.5 13.5 2.83579 13.5 3.25V12.75C13.5 13.1642 13.1642 13.5 12.75 13.5H3.25C2.83579 13.5 2.5 13.1642 2.5 12.75V3.25C2.5 2.83579 2.83579 2.5 3.25 2.5Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  )
}

function ChevronDownIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M7.5 3L4.5 6L7.5 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M4.5 3L7.5 6L4.5 9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </svg>
  )
}
