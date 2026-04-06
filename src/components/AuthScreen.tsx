import type { FormEvent } from 'react'
import type { AuthMode } from '../types'

type AuthScreenProps = {
  authMode: AuthMode
  email: string
  password: string
  loading: boolean
  message: string | null
  onAuthModeChange: (mode: AuthMode) => void
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}

export function AuthScreen({
  authMode,
  email,
  password,
  loading,
  message,
  onAuthModeChange,
  onEmailChange,
  onPasswordChange,
  onSubmit,
}: AuthScreenProps) {
  const webSignupDisabled = authMode === 'signup'
  const submitLabel = authMode === 'signin' ? 'Open dashboard' : 'Android app only'

  return (
    <main className="auth-shell">
      <section className="auth-card auth-card--centered">
        <div className="auth-card__header">
          <div>
            <p className="eyebrow">Secure access</p>
            <h1 className="headline auth-card__title">
              {authMode === 'signin' ? 'Sign in' : 'Create your account'}
            </h1>
            <p className="kicker">
              {authMode === 'signin' ? 'Verified email only.' : 'Web sign-up is disabled.'}
            </p>
            {webSignupDisabled ? (
              <p className="auth-hint">Download Android app and sign up.</p>
            ) : null}
          </div>

          <div className="auth-switch" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'signin' ? 'is-active' : undefined}
              onClick={() => onAuthModeChange('signin')}
            >
              Sign in
            </button>
            <button
              type="button"
              className={authMode === 'signup' ? 'is-active' : undefined}
              onClick={() => onAuthModeChange('signup')}
            >
              Sign up
            </button>
          </div>
        </div>

        {message ? <div className="notice">{message}</div> : null}

        <form className="auth-form" onSubmit={onSubmit}>
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              required
              disabled={webSignupDisabled || loading}
              value={email}
              onChange={(event) => onEmailChange(event.target.value)}
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={authMode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="Enter a secure password"
              required
              minLength={6}
              disabled={webSignupDisabled || loading}
              value={password}
              onChange={(event) => onPasswordChange(event.target.value)}
            />
          </div>

          <button
            className="submit-button"
            type="submit"
            disabled={loading || webSignupDisabled}
          >
            {loading ? 'Working...' : submitLabel}
          </button>
        </form>
      </section>
    </main>
  )
}
