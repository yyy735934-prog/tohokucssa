export function isReviewer(session) {
  return session?.role === 'reviewer'
}

export async function isAssignedStandardHost(db, eventId, userId) {
  if (!userId) return false
  const row = await db.prepare(
    "SELECT 1 AS allowed FROM event_host_assignments WHERE event_id = ? AND user_id = ? AND status = 'accepted'"
  ).bind(eventId, userId).first()
  return !!row
}

export async function canOperateEvent(db, event, session) {
  if (!event || !session) return false
  if (isReviewer(session)) return true
  if (event.event_mode === 'gathering') return Number(event.created_by) === Number(session.id)
  return isAssignedStandardHost(db, event.id, session.id)
}

export function canEditEventContent(event, session) {
  if (!event || !session) return false
  if (event.event_mode === 'standard') return isReviewer(session)
  return isReviewer(session) || Number(event.created_by) === Number(session.id)
}
