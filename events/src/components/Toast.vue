<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="state.visible" class="toast" :class="`toast-${state.type}`">{{ state.text }}</div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { toastState as state } from '../lib/toast.js'
</script>

<style>
.toast {
  position: fixed;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  padding: 10px 24px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  z-index: 9999;
  box-shadow: 0 4px 16px rgba(0,0,0,.15);
  pointer-events: none;
  max-width: 90vw;
  text-align: center;
}
.toast-success { background: #10b981; color: #fff; }
.toast-error { background: #ef4444; color: #fff; }
.toast-info { background: #4f46e5; color: #fff; }
.toast-enter-active, .toast-leave-active { transition: all .25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(-50%) translateY(-12px); }
</style>
