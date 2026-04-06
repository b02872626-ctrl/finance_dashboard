export function getAccountDisplayName(email: string) {
  const [localPart] = email.split('@')
  const parts = localPart
    .split(/[._-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))

  return parts.length > 0 ? parts.join(' ') : 'Account'
}

export function getAccountInitials(email: string) {
  const displayName = getAccountDisplayName(email)
  const parts = displayName.split(/\s+/).filter(Boolean)

  if (parts.length === 0) {
    return 'AC'
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('')
}
