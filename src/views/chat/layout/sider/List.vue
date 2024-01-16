<script setup lang='ts'>
import { computed } from 'vue'
import { NInput, NPopconfirm, NScrollbar } from 'naive-ui'
import { faCheck, faComments, faEdit, faHistory, faImage, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { library } from '@fortawesome/fontawesome-svg-core'
import { useAppStore, useChatStore } from '@/store'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { debounce } from '@/utils/functions/debounce'

library.add(faCheck, faComments, faEdit, faHistory, faImage, faTrashAlt)

const { isMobile } = useBasicLayout()

const appStore = useAppStore()
const chatStore = useChatStore()

const dataSources = computed(() => {
  // console.log(chatStore)
  // console.log(chatStore.history)
  const keyLabelMap = new Map(JSON.parse(localStorage.getItem('keyLabelMap') || ''))
  // console.log(keyLabelMap)
  chatStore.history.forEach((history) => {
    const businessType: number = history.businessType || 0
    if (businessType)
      history.businessName = keyLabelMap.get(String(businessType))
    // if (businessType === 10)
    //   history.businessName = '百度文心一言'
    // else if (businessType === 20)
    //   history.businessName = '科大讯飞星火认知V3.0'
    // else if (businessType === 30)
    //   history.businessName = '阿里通义千问'
    // else if (businessType === 90)
    //   history.businessName = 'GPT3.5'
    // else if (businessType === 100)
    //   history.businessName = '政策事项知识库'
    // else if (businessType === 108)
    //   history.businessName = '招商政策知识库'
    // else if (businessType === 101)
    //   history.businessName = '民法典'
    // else if (businessType === 1001)
    //   history.businessName = '数据分析'
    // else if (businessType === 10001)
    //   history.businessName = '语音转写'
    // else if (businessType === 10002)
    //   history.businessName = '文档分析'
    // else
    //   history.businessName = 'ChatGLM3'
  })
  return chatStore.history
})

async function handleSelect({ uuid }: Chat.History) {
  // console.log(uuid)
  if (isActive(uuid))
    return

  if (chatStore.active)
    chatStore.updateHistory(chatStore.active, { isEdit: false })
  await chatStore.setActive(uuid)

  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

function handleEdit({ uuid }: Chat.History, isEdit: boolean, event?: MouseEvent) {
  event?.stopPropagation()
  chatStore.updateHistory(uuid, { isEdit })
}

function handleDelete(index: number, event?: MouseEvent | TouchEvent) {
  event?.stopPropagation()
  chatStore.deleteHistory(index)
  if (isMobile.value)
    appStore.setSiderCollapsed(true)
}

const handleDeleteDebounce = debounce(handleDelete, 600)

function handleEnter({ uuid }: Chat.History, isEdit: boolean, event: KeyboardEvent) {
  event?.stopPropagation()
  if (event.key === 'Enter')
    chatStore.updateHistory(uuid, { isEdit })
}

function isActive(uuid: number) {
  return chatStore.active === uuid
}
</script>

<template>
  <NScrollbar class="px-4">
    <div class="flex flex-col gap-2 text-sm">
      <template v-if="!dataSources.length">
        <div class="flex flex-col items-center mt-4 text-center text-neutral-300">
          <FontAwesomeIcon icon="fas fa-image" class="mb-2 text-3xl" />
          <span>{{ $t('common.noData') }}</span>
        </div>
      </template>
      <template v-else>
        <div v-for="(item, index) of dataSources" :key="index">
          <a
            class="relative flex items-center gap-3 px-3 py-1 break-all border rounded-md cursor-pointer hover:bg-neutral-100 group dark:border-neutral-800 dark:hover:bg-[#24272e]"
            :class="isActive(item.uuid) && ['border-[#4b9e5f]', 'bg-neutral-100', 'text-[#4b9e5f]', 'dark:bg-[#24272e]', 'dark:border-[#4b9e5f]', 'pr-14']"
            @click="handleSelect(item)"
          >
            <span>
              <FontAwesomeIcon icon="fas fa-comments" />
            </span>
            <div class="relative flex-1 overflow-hidden break-all text-ellipsis whitespace-nowrap">
              <NInput
                v-if="item.isEdit"
                v-model:value="item.title" size="tiny"
                @keypress="handleEnter(item, false, $event)"
              />
              <!-- <span v-else>{{ item.title }}{{ item.businessName }}</span> -->
              <template v-else>
                <div>{{ item.title }}</div>
                <div :style="{ color: '#bbb', fontSize: '70%' }">{{ item.businessName }}</div>
              </template>
            </div>
            <div v-if="isActive(item.uuid)" class="absolute z-10 flex visible right-1">
              <template v-if="item.isEdit">
                <button class="p-1" @click="handleEdit(item, false, $event)">
                  <FontAwesomeIcon icon="fas fa-check" />
                </button>
              </template>
              <template v-else>
                <button class="p-1">
                  <FontAwesomeIcon icon="fas fa-edit" @click="handleEdit(item, true, $event)" />
                </button>
                <NPopconfirm placement="bottom" @positive-click="handleDeleteDebounce(index, $event)">
                  <template #trigger>
                    <button class="p-1">
                      <FontAwesomeIcon icon="fas fa-trash-alt" />
                    </button>
                  </template>
                  {{ $t('chat.deleteHistoryConfirm') }}
                </NPopconfirm>
              </template>
            </div>
          </a>
        </div>
      </template>
    </div>
  </NScrollbar>
</template>
