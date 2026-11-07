import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, afterEach, expect, test, vi } from 'vitest'
import { ConfirmationProvider } from '../src/shared/components/ConfirmationProvider'
import { useConfirmation } from '../src/shared/components/confirmation'

let container, root, result, mutation
function Harness() {
  const confirm = useConfirmation()
  return <button onClick={async () => result(await confirm({ title: 'Remove leave record?', cancelLabel: 'Keep record', confirmLabel: 'Remove leave record', onConfirm: mutation }))}>Remove</button>
}
const click = async text => act(async () => [...container.querySelectorAll('button')].find(b => b.textContent === text).click())
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
  result = vi.fn(); mutation = vi.fn().mockResolvedValue(undefined)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  await act(async () => root.render(<ConfirmationProvider><Harness /></ConfirmationProvider>))
})
afterEach(async () => { await act(async () => root.unmount()); container.remove() })
test('safe default, Escape and cancel preserve the saved record and restore focus', async () => {
  container.querySelector('button').focus()
  await click('Remove')
  expect(document.activeElement.textContent).toBe('Keep record')
  await act(async () => container.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })))
  expect(result).toHaveBeenCalledWith(false)
  expect(mutation).not.toHaveBeenCalled()
  expect(document.activeElement.textContent).toBe('Remove')
})
test('failed removal stays open for retry and successful removal settles once', async () => {
  mutation.mockRejectedValueOnce(new Error('network'))
  await click('Remove'); await click('Remove leave record')
  expect(container.querySelector('[role="alert"]').textContent).toContain('could not confirm')
  expect(result).not.toHaveBeenCalled()
  await click('Remove leave record')
  expect(mutation).toHaveBeenCalledTimes(2)
  expect(result).toHaveBeenCalledExactlyOnceWith(true)
  expect(container.querySelector('dialog')).toBeNull()
})
test('pending removal disables dismissal and duplicate submissions', async () => {
  let finish
  mutation.mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await click('Remove'); await click('Remove leave record')
  expect([...container.querySelectorAll('dialog button')].every(b => b.disabled)).toBe(true)
  await act(async () => container.querySelector('dialog').dispatchEvent(new Event('cancel', { cancelable: true })))
  expect(result).not.toHaveBeenCalled()
  await act(async () => finish())
  expect(mutation).toHaveBeenCalledTimes(1)
  expect(result).toHaveBeenCalledWith(true)
})
