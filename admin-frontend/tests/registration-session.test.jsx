import { expect, test, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ getUser: vi.fn() }))
vi.mock('../src/shared/lib/supabase', () => ({ supabase: { auth: { getUser: fixture.getUser } } }))
vi.mock('../src/features/auth/components/RegisterForm', () => ({ RegisterForm: () => null }))
vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => options => options,
  redirect: options => ({ redirect: options.to }),
  Link: () => null,
}))
import { Route } from '../src/routes/register'

test('a deleted or expired identity can reach registration', async () => {
  fixture.getUser.mockResolvedValue({ data: { user: null }, error: new Error('User no longer exists') })
  await expect(Route.beforeLoad()).resolves.toBeUndefined()
})

test('a signed-out visitor can reach registration', async () => {
  fixture.getUser.mockResolvedValue({ data: { user: null }, error: null })
  await expect(Route.beforeLoad()).resolves.toBeUndefined()
})

test('a verified returning identity goes through workspace routing', async () => {
  fixture.getUser.mockResolvedValue({ data: { user: { id: 'test-user' } }, error: null })
  await expect(Route.beforeLoad()).rejects.toEqual({ redirect: '/workspace' })
})
