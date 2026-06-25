import { reactive } from 'vue'

export const toasts = reactive([])

let nextId = 0

export function showToast(message, type = 'success') {
  const id = ++nextId
  toasts.push({ id, message, type })
  setTimeout(() => {
    const idx = toasts.findIndex(t => t.id === id)
    if (idx !== -1) toasts.splice(idx, 1)
  }, 3000)
}
