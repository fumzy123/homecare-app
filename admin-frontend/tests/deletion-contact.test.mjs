import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deletionContact } from '../src/features/privacy/lib/deletionContact.ts'

test('only a configured email address becomes the request destination', () => {
  const contact = deletionContact(' privacy+requests@example.com ')
  assert.equal(contact.email, 'privacy+requests@example.com')
  const url = new URL(contact.href)
  assert.equal(url.protocol, 'mailto:')
  assert.equal(decodeURIComponent(url.pathname), contact.email)
  assert.equal(url.searchParams.get('subject'), 'Care Harbor account deletion request')
  assert.equal(url.searchParams.has('body'), false)
})

test('missing configuration and email header/URL injection never produce a request link', () => {
  for (const value of [undefined, '', 'not-an-email', 'https://example.com', 'a@example.com?bcc=other@example.com', 'a@example.com\r\nBcc:other@example.com']) {
    assert.equal(deletionContact(value), null)
  }
})
