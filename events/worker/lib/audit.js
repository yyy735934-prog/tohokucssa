export async function audit(db, action, targetType, targetId, detail, actor) {
  await db.prepare(
    'INSERT INTO audit_logs (action, target_type, target_id, detail, actor) VALUES (?, ?, ?, ?, ?)'
  ).bind(action, targetType, targetId || null, detail || '', actor || '').run()
}
