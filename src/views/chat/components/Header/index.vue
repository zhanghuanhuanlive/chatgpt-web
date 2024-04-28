<script lang="ts" setup>
import { computed, nextTick } from 'vue'
import { NAlert, NEllipsis, NGi, NGrid } from 'naive-ui'
import { faArrowUpLong, faDownload, faFileUpload, faHistory, faMicrophoneLines, faMicrophoneLinesSlash, faMusic, faPaperPlane, faPauseCircle, faPlayCircle, faTrashAlt, faVolumeUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { HoverButton, SvgIcon } from '@/components/common'
import { useAppStore, useChatStore } from '@/store'

defineProps<Props>()
const emit = defineEmits<Emit>()
library.add(faArrowUpLong, faTrashAlt, faFileUpload, faMusic, faDownload, faHistory, faMicrophoneLines, faMicrophoneLinesSlash, faPauseCircle, faPlayCircle, faVolumeUp, faPaperPlane)
interface Props {
  usingContext: boolean
  faqs: String
  activeIndex: number
}

interface Emit {
  (ev: 'export'): void
  (ev: 'handleClear'): void
  (ev: 'handleRelatedQuestionClick', item: string): void
  (ev: 'setActiveIndex', index: number): void
}

const appStore = useAppStore()
const chatStore = useChatStore()

const collapsed = computed(() => appStore.siderCollapsed)
const currentChatHistory = computed(() => chatStore.getChatHistoryByCurrentActive)

function handleUpdateCollapsed() {
  appStore.setSiderCollapsed(!collapsed.value)
}

function onScrollToTop() {
  const scrollRef = document.querySelector('#scrollRef')
  if (scrollRef)
    nextTick(() => scrollRef.scrollTop = 0)
}

// function handleExport() {
//   emit('export')
// }

function handleClear() {
  emit('handleClear')
}
function handleRelatedQuestionClick(item: string) {
  emit('handleRelatedQuestionClick', item)
}
function setActiveIndex(index: number) {
  emit('setActiveIndex', index)
}
</script>

<template>
  <header
    class="sticky top-0 left-0 right-0 z-30 border-b dark:border-neutral-800 bg-white/80 dark:bg-black/20 backdrop-blur"
  >
    <div class="relative flex items-center justify-between min-w-0 overflow-hidden h-14">
      <div class="flex items-center">
        <button
          class="flex items-center justify-center w-11 h-11"
          @click="handleUpdateCollapsed"
        >
          <SvgIcon v-if="collapsed" class="text-2xl" icon="ri:align-justify" />
          <SvgIcon v-else class="text-2xl" icon="ri:align-right" />
        </button>
      </div>
      <h1
        class="flex-1 px-4 pr-6 overflow-hidden cursor-pointer select-none text-ellipsis whitespace-nowrap text-center"
        @dblclick="onScrollToTop"
      >
        {{ currentChatHistory?.businessName ?? '' }}
      </h1>
      <div class="flex items-center space-x-2">
        <!-- <HoverButton @click="handleExport">
          <span class="text-xl text-[#4f555e] dark:text-white">
            <SvgIcon icon="ri:download-2-line" />
          </span>
        </HoverButton> -->
        <HoverButton @click="handleClear">
          <span class="text-xl text-[#4f555e] dark:text-white">
            <SvgIcon icon="ri:delete-bin-line" />
          </span>
        </HoverButton>
      </div>
    </div>
    <div class="flex items-center justify-between space-x-2" style="margin-bottom: 8px;">
      <!-- <NGrid v-if="faqs !== ''" x-gap="12" :cols="2">
        <NGi
          v-for="(item, index) of faqs.split('||||')" :key="index" class="affix"
          :class="{ 'hovered-grid': activeIndex === index }"
          @click="handleRelatedQuestionClick(item)"
          @mouseover="setActiveIndex(index)"
          @mouseout="setActiveIndex(-1)"
        >
          <NTag title="" :show-icon="false">
            {{ item }}
            <FontAwesomeIcon v-if="activeIndex === index" icon="fas fa-arrow-up-long" style="float: right !important; padding-top: 5px;" />
          </NTag>
        </NGi>
      </NGrid> -->
      <NGrid v-if="faqs !== ''" x-gap="1" :cols="2">
        <NGi
          v-for="(item, index) of faqs.split('||||')" :key="index" class="affix"
          :class="{ 'hovered-grid': activeIndex === index }"
          @click="handleRelatedQuestionClick(item)"
          @mouseover="setActiveIndex(index)"
          @mouseout="setActiveIndex(-1)"
        >
          <NAlert title="" class="myAlert" :show-icon="false" :bordered="true">
            <NEllipsis :line-clamp="1">
              {{ item }}
            </NEllipsis>
            <FontAwesomeIcon v-if="activeIndex === index" icon="fas fa-arrow-up-long" style="float: right !important; padding-top: 5px;" />
          </NAlert>
        </NGi>
      </NGrid>
    </div>
  </header>
</template>

<style>
.hovered-grid {
  background-color: #333;
}

.myAlert .n-alert-body {
  --n-padding: 5px 10px; /* 重写 --n-padding 变量的值 */
}
</style>
