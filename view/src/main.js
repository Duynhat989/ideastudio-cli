import './assets/main.css'
import './styles/flow-node-gen.css'

import { createApp } from 'vue'
import App from './App.vue'
import vue3GoogleLogin from 'vue3-google-login'
const app = createApp(App)
app.config.devtools = false;
app.use(vue3GoogleLogin, {
  clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
  popupType: 'popup'
})

app.mount('#app')
