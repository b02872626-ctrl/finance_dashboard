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
  onGoogleSignIn: () => void
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
  onGoogleSignIn,
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

        <div className="auth-separator">
          <span>or sign in with</span>
        </div>

        <button
          type="button"
          className="google-button"
          disabled={loading}
          onClick={onGoogleSignIn}
        >
          <svg
            className="google-button__icon"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              fill="#EA4335"
            />
          </svg>
          Continue with Google
        </button>
      </section>
    </main>
  )
}
