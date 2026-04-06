import { startTransition, useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthScreen } from './components/AuthScreen'
import { FinanceShell } from './components/FinanceShell'
import { loadFinanceSnapshot } from './lib/finance'
import { supabase } from './lib/supabase'
import { BudgetsPage } from './pages/BudgetsPage'
import { DashboardPage } from './pages/DashboardPage'
import { DevicesPage } from './pages/DevicesPage'
import { TransactionsPage } from './pages/TransactionsPage'
import type { AuthMode, FinanceSnapshot } from './types'
import './App.css'

const emptySnapshot: FinanceSnapshot = {
  banks: [],
  transactions: [],
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(true)
  const [authMode, setAuthMode] = useState<AuthMode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<FinanceSnapshot>(emptySnapshot)
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [snapshotError, setSnapshotError] = useState<string | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    const initializeSession = async () => {
      const { data, error } = await supabase.auth.getSession()

      if (!active) {
        return
      }

      if (error) {
        setAuthMessage(error.message)
      }

      setSession(data.session)
      setBooting(false)
    }

    void initializeSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) {
        return
      }

      startTransition(() => {
        setSession(nextSession)
        setAuthMessage(null)

        if (!nextSession) {
          setSnapshot(emptySnapshot)
          setSnapshotError(null)
          setSnapshotLoading(false)
          setLastSyncedAt(null)
        }
      })

      setBooting(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user.id

    if (!userId) {
      return
    }

    let cancelled = false

    const syncSnapshot = async () => {
      setSnapshotLoading(true)
      setSnapshotError(null)

      try {
        const nextSnapshot = await loadFinanceSnapshot(userId)

        if (cancelled) {
          return
        }

        startTransition(() => {
          setSnapshot(nextSnapshot)
          setLastSyncedAt(new Date().toISOString())
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        const message =
          error instanceof Error
            ? error.message
            : 'Unable to load the finance dashboard right now.'

        setSnapshotError(message)
      } finally {
        if (!cancelled) {
          setSnapshotLoading(false)
        }
      }
    }

    void syncSnapshot()

    return () => {
      cancelled = true
    }
  }, [session?.user.id])

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    setAuthLoading(true)
    setAuthMessage(null)

    try {
      if (authMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })

        if (error) {
          throw error
        }

        setPassword('')
        return
      }

      setAuthMessage('Sign-up is only available in the Android app.')
      return
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Authentication failed.'
      setAuthMessage(message)
    } finally {
      setAuthLoading(false)
    }
  }

  const handleRefresh = async () => {
    const userId = session?.user.id

    if (!userId) {
      return
    }

    setSnapshotLoading(true)
    setSnapshotError(null)

    try {
      const nextSnapshot = await loadFinanceSnapshot(userId)

      startTransition(() => {
        setSnapshot(nextSnapshot)
        setLastSyncedAt(new Date().toISOString())
      })
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to refresh the workspace.'

      setSnapshotError(message)
    } finally {
      setSnapshotLoading(false)
    }
  }

  const handleSignOut = async () => {
    setAuthLoading(true)
    setAuthMessage(null)

    try {
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unable to sign out right now.'
      setAuthMessage(message)
    } finally {
      setAuthLoading(false)
    }
  }

  if (booting) {
    return (
      <main className="loading-shell">
        <div className="loading-shell__panel">
          <p className="eyebrow">Finance Lore</p>
          <h1>Connecting your workspace</h1>
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  if (!session) {
    return (
      <AuthScreen
        authMode={authMode}
        email={email}
        password={password}
        loading={authLoading}
        message={authMessage}
        onAuthModeChange={setAuthMode}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={handleAuthSubmit}
      />
    )
  }

  const userEmail = session.user.email ?? 'Signed-in user'

  return (
    <BrowserRouter>
      <Routes>
        <Route
          element={
            <FinanceShell
              error={snapshotError}
              lastSyncedAt={lastSyncedAt}
              loading={snapshotLoading}
              onRefresh={handleRefresh}
              onSignOut={handleSignOut}
              userEmail={userEmail}
            />
          }
        >
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route
            path="/dashboard"
            element={<DashboardPage snapshot={snapshot} userEmail={userEmail} />}
          />
          <Route
            path="/devices"
            element={<DevicesPage userEmail={userEmail} />}
          />
          <Route path="/transactions" element={<TransactionsPage snapshot={snapshot} />} />
          <Route path="/budgets" element={<BudgetsPage />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
