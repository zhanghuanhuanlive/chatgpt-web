<script setup lang='ts'>
import type { CSSProperties } from 'vue'
import { computed, ref } from 'vue'
import { NButton, NDropdown, NLayoutSider, useDialog } from 'naive-ui'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faTimesCircle } from '@fortawesome/free-solid-svg-icons'
import List from './List.vue'
import Footer from './Footer.vue'
import { useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { PromptStore } from '@/components/common'
import { t } from '@/locales'

library.add(faTimesCircle)

const appStore = useAppStore()
const chatStore = useChatStore()

const dialog = useDialog()

const { isMobile } = useBasicLayout()
const show = ref(false)

const collapsed = computed(() => appStore.siderCollapsed)

// console.log(`isMobile: ${isMobile.value}`)
if (isMobile.value)
  appStore.setSiderCollapsed(true)// 手机端自动隐藏左侧菜单
appStore.setSiderCollapsed(collapsed.value)// 设置成缓存中的是否折叠菜单

// console.log(localStorage.getItem('menu'))
const options = computed(() => JSON.parse(localStorage.getItem('menu') || ''))

// console.log(options.value)
// [
//   // {
//   //   label: 'AI聊天',
//   //   key: '10000',
//   //   disabled: true,
//   // },
//   {
//     label: '选择模型对话',
//     key: '-1000',
//     children: [
//       {
//         label: '本地ChatGLM3',
//         key: '0',
//       },
//       {
//         label: '百度文心一言',
//         key: '10',
//       },
//       {
//         label: '科大讯飞星火认知V3.0',
//         key: '20',
//       },
//       {
//         label: '阿里通义千问',
//         key: '30',
//       },
//       {
//         label: 'GPT3.5',
//         key: '90',
//       },
//     ],
//     // disabled: true,
//   },

//   {
//     type: 'divider',
//     key: 'd1',
//   },
//   // {
//   //   label: '应用聊天',
//   //   key: '-1',
//   //   disabled: true,
//   // },
//   {
//     label: '选择应用对话@ChatGLM3',
//     key: '1000',
//     children: [
//       {
//         label: '数据分析',
//         key: '1001',
//       },
//       {
//         type: 'divider',
//         key: 'd1',
//       },
//       {
//         label: '选择知识库',
//         key: '10000',
//         disabled: true,
//       },
//       {
//         label: '办事事项知识库',
//         key: '100',
//       },
//       {
//         label: '招商政策知识库',
//         key: '108',
//       },
//       {
//         label: '法律法规',
//         key: 'others1',
//         children: [
//           {
//             label: '民法典',
//             key: '101',
//           },
//           {
//             label: '矛盾调解',
//             key: '102',
//             disabled: true,
//           },
//         ],
//       },
//     ],
//   },

//   {
//     label: '选择组件对话@ChatGLM3',
//     key: '10000',
//     children: [
//       {
//         label: '音频转写文字',
//         key: '10001',
//       },
//       {
//         type: 'divider',
//         key: 'd1',
//       },
//       {
//         label: '文档分析',
//         key: '10002',
//       },
//     ],
//   },

// ]

// const message = useMessage()
// const showDropdownRef = ref(false)
// showDropdown = showDropdownRef,

function handleSelectModal(key: string) {
  proceedToAddHistory(parseInt(key))
  // message.info(String(key))
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
// 注释以下代码，要不然只要不是Mobile就会默认展开侧边栏,如果放开注释，需要import { computed, ref, watch } from 'vue'
// watch(
//   isMobile,
//   (val) => {
//     console.log(`watch: ${val}`);
//     appStore.setSiderCollapsed(val)
//   },
//   {
//     immediate: true,
//     flush: 'post',
//   },
// )
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
          <NDropdown trigger="hover" size="huge" :options="options" :show-arrow="true" @select="handleSelectModal">
            <NButton type="primary" dashed block strong>
              +    {{ $t('chat.newChatButton') }}
            </NButton>
          </NDropdown>
          <!-- <NButton dashed block @click="openChooseModel">
            {{ $t('chat.newChatButton') }}
          </NButton> -->
        </div>
        <div class="flex-1 min-h-0 pb-4 overflow-hidden">
          <List />
        </div>
        <div class="flex items-center p-4 space-x-4">
          <!-- <div class="flex-1">
            <NButton block @click="show = true">
              {{ $t('store.siderButton') }}
            </NButton>
          </div> -->
          <NButton block @click="handleClearAll">
            <!-- <SvgIcon icon="ri:close-circle-line" /> -->
            <!-- <FontAwesomeIcon icon="fas fa-times-circle" /> -->
            清空会话
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
