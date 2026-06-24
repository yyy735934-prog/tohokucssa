import { reactive } from 'vue'

export const toastState = reactive({ visible: false, text: '', type: 'success' })

let timer = null

export function toast(msg, type = 'success', duration = 2500) {
  clearTimeout(timer)
  toastState.text = msg
  toastState.type = type
  toastState.visible = true
  timer = setTimeout(() => { toastState.visible = false }, duration)
}
