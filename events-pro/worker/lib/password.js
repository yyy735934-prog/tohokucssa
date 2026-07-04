const ITERATIONS = 100000

export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return b64(salt) + ':' + b64(new Uint8Array(bits))
}

export async function verifyPassword(password, stored) {
  const [saltB64, hashB64] = stored.split(':')
  const salt = unb64(saltB64)
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' }, key, 256)
  return b64(new Uint8Array(bits)) === hashB64
}

function b64(buf) { return btoa(String.fromCharCode(...buf)) }
function unb64(s) { return Uint8Array.from(atob(s), c => c.charCodeAt(0)) }
