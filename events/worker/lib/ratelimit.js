// Fixed-window counters stored in KV. KV is eventually consistent, so limits
// are approximate under heavy concurrency; that is acceptable for slowing down
// password guessing and verification-code abuse at this site's traffic level.

function windowKey(scope, id, windowSec) {
  const bucket = Math.floor(Date.now() / 1000 / windowSec)
  return `rl:${scope}:${id}:${bucket}`
}

export async function getCount(kv, scope, id, windowSec) {
  const raw = await kv.get(windowKey(scope, id, windowSec))
  return Number(raw) || 0
}

export async function increment(kv, scope, id, windowSec) {
  const key = windowKey(scope, id, windowSec)
  const next = (Number(await kv.get(key)) || 0) + 1
  // KV requires expirationTtl >= 60
  await kv.put(key, String(next), { expirationTtl: Math.max(60, windowSec) })
  return next
}

export async function reset(kv, scope, id, windowSec) {
  await kv.delete(windowKey(scope, id, windowSec))
}

export function clientIp(c) {
  return c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for')?.split(',')[0].trim() || 'unknown'
}
