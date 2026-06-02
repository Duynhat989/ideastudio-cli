import './assets/main.css'
import './styles/flow-node-gen.css'

import { createApp } from 'vue'
import App from './App.vue'
import vue3GoogleLogin from 'vue3-google-login'
import { runtime } from './services/runtime'

if (!window.electronAPI) {
  window.electronAPI = {
    invoke: async (channel, payload = {}) => {
      const routes = {
        'profiles:list': { method: 'GET', path: '/api/profiles' },
        'profiles:create': { method: 'POST', path: '/api/profiles' },
        'profiles:update': { method: 'PUT', path: `/api/profiles/${payload.id}` },
        'profiles:delete': { method: 'DELETE', path: `/api/profiles/${payload.id}` },
        'profiles:open': { method: 'POST', path: `/api/profiles/${payload.id}/open` },
        'profiles:close': { method: 'POST', path: `/api/profiles/${payload.id}/close` },
        'loopflow:list-media': { method: 'POST', path: '/api/loopflow/list-media' },
        'shell:open-external': { method: 'POST', path: '/api/system/open-external' },
        'shell:open-directory': { method: 'POST', path: '/api/system/open-directory' },
        'dialog:save-video-path': { method: 'POST', path: '/api/system/save-video-path' },
      }
      const route = routes[channel]
      if (!route) return { success: false, message: `Unsupported channel: ${channel}` }

      const url = runtime.api(route.path)
      const res = await fetch(url, {
        method: route.method,
        headers: { 'Content-Type': 'application/json' },
        body: route.method === 'GET' ? undefined : JSON.stringify(
          channel === 'shell:open-external' ? { url: payload } :
          channel === 'shell:open-directory' ? { path: payload } :
          payload
        ),
      })
      const data = await res.json().catch(() => ({ success: false, message: `Request failed (${res.status})` }))
      return data
    },
    send: () => {},
  }
}

if (!window.electronEvent) {
  window.electronEvent = {
    onServerStatus: () => () => {},
  }
}

const app = createApp(App)
app.config.devtools = false;
app.use(vue3GoogleLogin, {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  popupType: 'popup'
})

app.mount('#app')
