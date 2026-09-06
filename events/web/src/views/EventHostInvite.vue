<template><div class="page"><div class="card panel"><div v-if="loading">加载中…</div><template v-else-if="invite"><h1>活动担当邀请</h1><p>你被邀请担当「{{ invite.title }}」的运营工作。</p><p>{{ invite.event_date }}<span v-if="invite.location"> · {{ invite.location }}</span></p><div class="actions"><button class="btn btn-primary" :disabled="busy" @click="respond('accept')">接受邀请</button><button class="btn btn-outline" :disabled="busy" @click="respond('decline')">谢绝</button></div></template><p v-if="message">{{ message }}</p></div></div></template>
<script setup>
import { onMounted,ref } from 'vue';import{useRoute,useRouter}from'vue-router';import{api}from'../api.js';import{auth}from'../auth.js'
const route=useRoute(),router=useRouter(),invite=ref(null),loading=ref(true),busy=ref(false),message=ref('')
onMounted(async()=>{try{invite.value=(await api.getEventHostInvite(route.params.token)).invite}catch(e){message.value=e.message}loading.value=false})
async function respond(action){if(!auth.isLoggedIn){location.href=`/api/auth/google?from=public&return_to=${encodeURIComponent(route.fullPath)}`;return}busy.value=true;try{await api.respondEventHostInvite(route.params.token,action);message.value=action==='accept'?'已接受邀请，即将进入管理后台。':'已谢绝邀请。';if(action==='accept')setTimeout(()=>router.push('/admin/events'),700)}catch(e){message.value=e.message}busy.value=false}
</script>
<style scoped>.panel{max-width:620px;margin:40px auto;padding:28px}.panel h1{font-size:22px}.panel p{margin-top:14px}.actions{display:flex;gap:12px;margin-top:22px}</style>
