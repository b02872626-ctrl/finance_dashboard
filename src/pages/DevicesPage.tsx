import { getAccountDisplayName } from '../utils/account'

type DevicesPageProps = {
  userEmail: string
}

export function DevicesPage({ userEmail }: DevicesPageProps) {
  const username = getAccountDisplayName(userEmail)

  return (
    <div className="page-stack devices-page">
      <section className="devices-page__header">
        <p className="eyebrow">Devices</p>
        <h3 className="section-title">Current account details</h3>
      </section>

      <section className="devices-page__list" aria-label="Current account details">
        <article className="devices-page__row">
          <span className="devices-page__row-label">Username</span>
          <strong className="devices-page__row-value">{username}</strong>
        </article>

        <article className="devices-page__row">
          <span className="devices-page__row-label">Email</span>
          <strong className="devices-page__row-value devices-page__row-value--email">
            {userEmail}
          </strong>
        </article>
      </section>
    </div>
  )
}
