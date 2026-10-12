/** A configured public mailbox, never an invented fallback or a user-supplied URL. */
export function deletionContact(value: string | undefined) {
  const email = value?.trim()
  if (!email || !/^[a-zA-Z0-9.!#$%&'*+/=_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(email)) return null
  return {
    email,
    href: `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent('Care Harbor account deletion request')}`,
  }
}
