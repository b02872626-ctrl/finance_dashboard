import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { getAccountDisplayName, getAccountInitials } from '../utils/account'
import { formatDateTime } from '../utils/format'

type FinanceShellProps = {
  error: string | null
  lastSyncedAt: string | null
  loading: boolean
  onRefresh: () => void
  onSignOut: () => void
  userEmail: string
}

const mainItems = [
  {
    description: 'Primary overview',
    label: 'Home',
    short: 'HM',
    to: '/dashboard',
  },
  {
    description: 'Every movement',
    label: 'Transactions',
    short: 'TX',
    to: '/transactions',
  },
  {
    description: 'Connections and sync',
    label: 'Devices',
    short: 'DV',
    to: '/devices',
  },
  {
    description: 'Planning workspace',
    label: 'Budgets',
    short: 'BG',
    to: '/budgets',
  },
]

export function FinanceShell({
  error,
  lastSyncedAt,
  loading,
  onRefresh,
  onSignOut,
  userEmail,
}: FinanceShellProps) {
  const [isAccountMenuOpen, setIsAccountMenuOpen] = useState(false)
  const displayName = getAccountDisplayName(userEmail)
  const initials = getAccountInitials(userEmail)

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <section className="sidebar-card sidebar-card--main">
          <div className="sidebar-card__brand">
            <div className="sidebar-card__logo">FL</div>
            <div>
              <p className="sidebar-caption">Finance Lore</p>
              <strong className="sidebar-card__title">Personal finance board</strong>
            </div>
          </div>

          <div className="sidebar-main-list">
            {mainItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  isActive ? 'sidebar-main-link is-active' : 'sidebar-main-link'
                }
              >
                <span className="sidebar-main-link__icon">{item.short}</span>
                <span className="sidebar-main-link__copy">
                  <strong>{item.label}</strong>
                  <span>{item.description}</span>
                </span>
              </NavLink>
            ))}
          </div>
        </section>

        <div className={isAccountMenuOpen ? 'sidebar-account-stack is-open' : 'sidebar-account-stack'}>
          <div className="sidebar-account-shell">
            {isAccountMenuOpen ? (
              <section id="sidebar-account-menu" className="sidebar-account">
                <div className="sidebar-account__summary">
                  <div className="sidebar-account__avatar">
                    {initials}
                  </div>
                  <div className="sidebar-account__copy">
                    <strong>{displayName}</strong>
                    <span>{userEmail}</span>
                  </div>
                  <button
                    type="button"
                    className="sidebar-account__toggle"
                    aria-controls="sidebar-account-menu"
                    aria-expanded={isAccountMenuOpen}
                    aria-label="Collapse account menu"
                    onClick={() => setIsAccountMenuOpen(false)}
                  >
                    <span className="sidebar-account-bar__chevron" aria-hidden="true">
                      <ChevronIcon />
                    </span>
                  </button>
                </div>

                <div className="sidebar-account__menu">
                  <button type="button" className="sidebar-account__item" disabled>
                    Account
                  </button>
                  <button
                    type="button"
                    className="sidebar-account__item"
                    onClick={onSignOut}
                  >
                    Log out
                  </button>
                  <button type="button" className="sidebar-account__item" disabled>
                    Delete account
                  </button>
                </div>
              </section>
            ) : (
              <button
                type="button"
                className="sidebar-account-bar"
                aria-controls="sidebar-account-menu"
                aria-expanded={isAccountMenuOpen}
                onClick={() => setIsAccountMenuOpen(true)}
              >
                <div className="sidebar-account-bar__avatar">
                  {initials}
                </div>
                <div className="sidebar-account-bar__copy">
                  <strong>{displayName}</strong>
                  <span>{userEmail}</span>
                </div>
                <span className="sidebar-account-bar__chevron" aria-hidden="true">
                  <ChevronIcon />
                </span>
              </button>
            )}
          </div>
        </div>

        <div className="sidebar-spacer" />
      </aside>

      <section className="workspace">
        <header className="workspace-header">
          <div className="workspace-header__inner">
            <div className="workspace-header__title">
              <span className="workspace-header__icon">{initials}</span>
              <div className="workspace-header__copy">
                <strong>{displayName}</strong>
                <span>{userEmail}</span>
              </div>
            </div>

            <div className="workspace-header__actions">
              <button
                type="button"
                className="toolbar-button"
                onClick={onRefresh}
                disabled={loading}
              >
                {loading ? 'Refreshing' : 'Refresh'}
              </button>
              <span className="toolbar-meta">
                {lastSyncedAt ? `Synced ${formatDateTime(lastSyncedAt)}` : 'Waiting for sync'}
              </span>
            </div>
          </div>
        </header>

        {error ? <div className="alert alert--error">{error}</div> : null}

        <div className="workspace-body">
          <Outlet />
        </div>
      </section>
    </div>
  )
}

function ChevronIcon() {
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
