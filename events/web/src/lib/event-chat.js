import { CometChat } from '@cometchat/chat-sdk-javascript'
import { CometChatUIKit, UIKitSettingsBuilder } from '@cometchat/chat-uikit-vue'
import { api } from '../api.js'

function valueOf(target, getter, key, fallback = null) {
  try { return target?.[getter]?.() ?? target?.[key] ?? fallback } catch { return target?.[key] ?? fallback }
}

export function messageId(message) { return Number(valueOf(message, 'getId', 'id', 0)) || 0 }
export function parentMessageId(message) { return Number(valueOf(message, 'getParentMessageId', 'parentMessageId', 0)) || 0 }
export function messageSentAt(message) { return Number(valueOf(message, 'getSentAt', 'sentAt', 0)) || 0 }
export function messageSender(message) {
  const sender = valueOf(message, 'getSender', 'sender', {}) || {}
  return {
    uid: String(valueOf(sender, 'getUid', 'uid', '')),
    name: String(valueOf(sender, 'getName', 'name', '参与者')),
  }
}

export function messagePreview(message) {
  const category = String(valueOf(message, 'getCategory', 'category', ''))
  if (category === 'action' || valueOf(message, 'getDeletedAt', 'deletedAt')) return ''
  const type = String(valueOf(message, 'getType', 'type', '')).toLowerCase()
  const text = String(valueOf(message, 'getText', 'text', '') || '').trim()
  if (text) return text
  return ({ image: '[图片]', audio: '[语音]', file: '[文件]', video: '[视频]', media: '[附件]' })[type] || (category === 'message' ? '[消息]' : '')
}

export async function connectEventChat(eventId, chatAccessToken) {
  const data = await api.chatSession({
    event_id: Number(eventId),
    chat_access_token: chatAccessToken || undefined,
  })
  const settings = new UIKitSettingsBuilder()
    .setAppId(data.app_id)
    .setRegion(data.region)
    .setAutoEstablishSocketConnection(true)
    .build()
  await CometChatUIKit.init(settings)
  const logged = await CometChatUIKit.getLoggedinUser()
  if (!logged || logged.getUid() !== data.uid) {
    if (logged) await CometChatUIKit.logout()
    await CometChatUIKit.loginWithAuthToken(data.auth_token)
  }
  return { ...data, group: new CometChat.Group(data.guid) }
}

export async function fetchEventMembers(guid) {
  const request = new CometChat.GroupMembersRequestBuilder(guid).setLimit(100).build()
  const rows = await request.fetchNext()
  return rows.map((member) => {
    const user = valueOf(member, 'getUser', 'user', member) || member
    return {
      uid: String(valueOf(member, 'getUid', 'uid', valueOf(user, 'getUid', 'uid', ''))),
      name: String(valueOf(member, 'getName', 'name', valueOf(user, 'getName', 'name', '参与者'))),
      scope: String(valueOf(member, 'getScope', 'scope', 'participant')).toLowerCase(),
    }
  }).filter((member) => member.uid)
}

async function latestThreadReplies(guid, rootId) {
  const request = new CometChat.MessagesRequestBuilder()
    .setGUID(guid)
    .setParentMessageId(rootId)
    .setLimit(30)
    .build()
  return request.fetchPrevious()
}

function unreadValue(result, guid) {
  return Number(result?.[guid] ?? result?.groups?.[guid] ?? result?.unreadMessageCount ?? 0) || 0
}

export async function fetchDiscussionSnapshot(guid, members = []) {
  const scopeByUid = new Map(members.map((member) => [member.uid, member.scope]))
  const request = new CometChat.MessagesRequestBuilder().setGUID(guid).setLimit(20).hideReplies(true).build()
  const rootMessages = (await request.fetchPrevious()).filter((message) => messagePreview(message) && !parentMessageId(message))
  const summaries = await Promise.all(rootMessages.map(async (root) => {
    const rootId = messageId(root)
    const reportedCount = Number(valueOf(root, 'getReplyCount', 'replyCount', 0)) || 0
    let replies = []
    if (reportedCount > 0 && rootId) replies = await latestThreadReplies(guid, rootId).catch(() => [])
    replies = replies.filter((reply) => messagePreview(reply))
    const latestReply = replies.reduce((latest, reply) => messageSentAt(reply) >= messageSentAt(latest) ? reply : latest, null)
    const replyCount = Math.max(reportedCount, replies.length)
    const latestSender = latestReply ? messageSender(latestReply) : null
    return {
      id: rootId,
      sender: messageSender(root),
      preview: messagePreview(root),
      replyCount,
      unreadReplies: Number(valueOf(root, 'getUnreadRepliesCount', 'unreadRepliesCount', 0)) || 0,
      latestReply: latestReply ? { sender: latestSender, preview: messagePreview(latestReply) } : null,
      moderatorReplied: replies.some((reply) => ['admin', 'moderator'].includes(scopeByUid.get(messageSender(reply).uid))),
      activityAt: Math.max(messageSentAt(root), latestReply ? messageSentAt(latestReply) : 0),
    }
  }))
  const unread = await CometChat.getUnreadMessageCountForGroup(guid).then((value) => unreadValue(value, guid)).catch(() => 0)
  return { summaries: summaries.sort((a, b) => b.activityAt - a.activityAt).slice(0, 3), unread }
}

export function isMessageForGroup(message, guid) {
  return String(valueOf(message, 'getReceiverId', 'receiverId', '')) === String(guid)
}
