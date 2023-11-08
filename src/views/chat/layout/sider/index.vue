<script setup lang='ts'>
import type { CSSProperties } from 'vue'
import { computed, h, ref, watch } from 'vue'
import { NButton, NLayoutSider, useDialog } from 'naive-ui'
import List from './List.vue'
import Footer from './Footer.vue'
import { useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { PromptStore, SvgIcon } from '@/components/common'
import { t } from '@/locales'

const appStore = useAppStore()
const chatStore = useChatStore()

const dialog = useDialog()

const { isMobile } = useBasicLayout()
const show = ref(false)

const collapsed = computed(() => appStore.siderCollapsed)

function handleAdd() {
  const dialogObj = dialog.info({
    title: t('请选择使用场景'),
    content: () => {
      return [
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(0)
            dialogObj.destroy()
          },
        }, t('本地ChatGLM3模型')),
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(10)
            dialogObj.destroy()
          },
        }, t('百度文心一言模型')),
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(20)
            dialogObj.destroy()
          },
        }, t('科大讯飞星火认知V3.0')),
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(30)
            dialogObj.destroy()
          },
        }, t('')),
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(90)
            dialogObj.destroy()
          },
        }, t('GPT3.5')),
        h(NButton, {
          onClick: () => {
            proceedToAddHistory(100)
            dialogObj.destroy()
          },
        }, t('政策事项查询')),
      ]
    },
    // ...其他配置项
  })
}

function proceedToAddHistory(businessType: number) {
  chatStore.addHistory({ title: 'New Chat', uuid: Date.now(), isEdit: false, businessType })
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

function handleUpdateCollapsed() {
  appStore.setSiderCollapsed(!collapsed.value)
}

function handleClearAll() {
  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.clearHistoryConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearHistory()
      if (isMobile.value)
        appStore.setSiderCollapsed(true)
    },
  })
}

const getMobileClass = computed<CSSProperties>(() => {
  if (isMobile.value) {
    return {
      position: 'fixed',
      zIndex: 50,
    }
  }
  return {}
})

const mobileSafeArea = computed(() => {
  if (isMobile.value) {
    return {
      paddingBottom: 'env(safe-area-inset-bottom)',
    }
  }
  return {}
})

watch(
  isMobile,
  (val) => {
    appStore.setSiderCollapsed(val)
  },
  {
    immediate: true,
    flush: 'post',
  },
)
</script>

<template>
  <NLayoutSider
    :collapsed="collapsed"
    :collapsed-width="0"
    :width="260"
    :show-trigger="isMobile ? false : 'arrow-circle'"
    collapse-mode="transform"
    position="absolute"
    bordered
    :style="getMobileClass"
    @update-collapsed="handleUpdateCollapsed"
  >
    <div class="flex flex-col h-full" :style="mobileSafeArea">
      <main class="flex flex-col flex-1 min-h-0">
        <div class="p-4">
          <NButton dashed block @click="handleAdd">
            {{ $t('chat.newChatButton') }}
          </NButton>
        </div>
        <div class="flex-1 min-h-0 pb-4 overflow-hidden">
          <List />
        </div>
        <div class="flex items-center p-4 space-x-4">
          <div class="flex-1">
            <NButton block @click="show = true">
              {{ $t('store.siderButton') }}
            </NButton>
          </div>
          <NButton @click="handleClearAll">
            <SvgIcon icon="ri:close-circle-line" />
          </NButton>
        </div>
      </main>
      <Footer />
    </div>
  </NLayoutSider>
  <template v-if="isMobile">
    <div v-show="!collapsed" class="fixed inset-0 z-40 w-full h-full bg-black/40" @click="handleUpdateCollapsed" />
  </template>
  <PromptStore v-model:visible="show" />
</template>
