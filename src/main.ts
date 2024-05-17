// import { Buffer } from 'buffer'
import { createApp } from 'vue'
import App from './App.vue'
// import App from './components/custom/Recorder/index.vue'
import { setupI18n } from './locales'
import { setupAssets, setupScrollbarStyle } from './plugins'
import { setupStore } from './store'
import { setupRouter } from './router'

// Make Buffer globally available
// (window as any).Buffer = Buffer

async function bootstrap() {
  const app = createApp(App)
  setupAssets()

  setupScrollbarStyle()

  setupStore(app)

  setupI18n(app)

  await setupRouter(app)

  app.mount('#app')
}

bootstrap()
