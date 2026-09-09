import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const detail = await readFile(new URL('../web/src/views/EventDetail.vue', import.meta.url), 'utf8')
const discussion = await readFile(new URL('../web/src/components/EventDiscussion.vue', import.meta.url), 'utf8')
const chat = await readFile(new URL('../web/src/views/EventChat.vue', import.meta.url), 'utf8')
const chatLib = await readFile(new URL('../web/src/lib/event-chat.js', import.meta.url), 'utf8')
const signups = await readFile(new URL('../worker/routes/signups.js', import.meta.url), 'utf8')

test('formal event page integrates detail, discussion and participants without the floating entry', () => {
  assert.match(detail, /activeTab === 'detail'/)
  assert.match(detail, /activeTab === 'discussion'/)
  assert.match(detail, /activeTab === 'people'/)
  assert.doesNotMatch(detail, /FloatingChatEntry/)
  assert.match(detail, /EventDiscussion/)
})

test('discussion summaries and participant roles come from native CometChat APIs', () => {
  assert.match(chatLib, /MessagesRequestBuilder\(\).*hideReplies\(true\)/s)
  assert.match(chatLib, /setParentMessageId\(rootId\)/)
  assert.match(chatLib, /GroupMembersRequestBuilder\(guid\)/)
  assert.match(chatLib, /getUnreadMessageCountForGroup/)
  assert.match(detail, /moderatorReplied/)
})

test('UIKit remains responsible for messages, threads, attachments and archived read-only mode', () => {
  assert.match(discussion, /CometChatMessages/)
  assert.match(discussion, /ThreadedMessagesConfiguration/)
  assert.match(discussion, /hide-message-composer="archived"/)
  assert.match(discussion, /threadReplyTextColor/)
})

test('legacy formal-event chat route redirects while gathering chat keeps its existing implementation', () => {
  assert.match(chat, /if \(!isGathering\.value\)/)
  assert.match(chat, /path: `\/e\/\$\{route\.params\.id\}`/)
  assert.match(chat, /api\.chatSession/)
})

test('new signup mail uses the integrated discussion URL and token is scrubbed on arrival', () => {
  assert.match(signups, /\?tab=discussion&token=/)
  assert.doesNotMatch(signups, /\/chat\?token=/)
  assert.match(detail, /router\.replace\(\{ path: `\/e\//)
  assert.match(detail, /query: \{ tab: 'discussion' \}/)
})

test('WeChat float hint waits for interaction and is rate-limited per event', () => {
  assert.match(discussion, /MicroMessenger/)
  assert.match(discussion, /event_float_hint_seen_/)
  assert.match(discussion, /event_float_hint_eventday_/)
  assert.match(discussion, /@pointerdown="registerInteraction"/)
})
