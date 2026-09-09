import test from 'node:test'
import assert from 'node:assert/strict'
import { addChatMember } from '../worker/lib/cometchat.js'

function fakeDb() {
  return {
    prepare() {
      return {
        bind() {
          return { run: async () => ({ meta: { changes: 1 } }) }
        },
      }
    },
  }
}

function env() {
  return {
    COMETCHAT_APP_ID: 'test-app',
    COMETCHAT_REGION: 'us',
    COMETCHAT_REST_API_KEY: 'secret',
    DB: fakeDb(),
  }
}

test('addChatMember sends only the non-empty participants array', async (t) => {
  const originalFetch = globalThis.fetch
  let body
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response(JSON.stringify({ data: { participants: { 'signup-7': { success: true } } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await addChatMember(env(), 'event-1', 'signup-7')
  assert.deepEqual(body, { participants: ['signup-7'] })
})

test('addChatMember sends only the non-empty moderators array', async (t) => {
  const originalFetch = globalThis.fetch
  let body
  globalThis.fetch = async (_url, options) => {
    body = JSON.parse(options.body)
    return new Response(JSON.stringify({ data: { moderators: { 'account-2': { success: true } } } }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  }
  t.after(() => { globalThis.fetch = originalFetch })

  await addChatMember(env(), 'event-1', 'account-2', 'moderator')
  assert.deepEqual(body, { moderators: ['account-2'] })
})

test('addChatMember does not hide per-user membership failures', async (t) => {
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({
    data: { participants: { 'signup-7': { success: false, error: { message: 'validation failed' } } } },
  }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
  t.after(() => { globalThis.fetch = originalFetch })

  await assert.rejects(
    () => addChatMember(env(), 'event-1', 'signup-7'),
    /validation failed/,
  )
})
