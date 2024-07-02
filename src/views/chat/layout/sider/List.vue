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

// interface ConfigState {
//   timeoutMs?: number
//   reverseProxy?: string
//   apiModel?: string
//   socksProxy?: string
//   httpsProxy?: string
//   usage?: string
//   menu?: string
//   affixes?: string
// }
// const config = ref<ConfigState>()

const dataSources = computed(() => {
  // console.log(chatStore)
  // console.log(chatStore.history)
  // const map = localStorage.getItem('keyLabelMap')
  // if (!map) {
  //   const { data } = await fetchChatConfig<ConfigState>()
  // }
  // console.log(chatStore.history)
  // const models = new Map(JSON.parse(localStorage.getItem('models') || '{}'))

  // console.log(keyLabelMap)
  const models = computed(() => JSON.parse(localStorage.getItem('models') || ''))
  // console.log(chatStore.history)
  // console.log(models.value)
  chatStore.history.forEach((history) => {
    let businessType = history.businessType as string | undefined // 第一次打开时businessType为undefined
    // console.log(businessType)
    let model
    if (models.value.length === 1) {
      model = models.value[0]
      businessType = model.key
    }
    else {
      if (undefined === businessType && models.value.length >= 1)
        model = models.value[0]
      else
        model = models.value.find(item => item.key === businessType)
      console.log(model)
    }
    // const bType = typeof businessType === 'string' ? businessType : '0'
    // const bTypeStr = String(bType)
    // const item = models.value.find(item => item.key === businessType)
    // if (keyLabelMap)
    // currentBusinessType = item.label || 'ChatGLM3'
    // console.log(bTypeStr)
    // console.log(item)
    history.businessName = model ? model.label : 'ChatGLM3' as string | undefined
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
                <!-- <div>{{ item.title }}</div> -->
                <!-- <div :style="{ color: '#bbb', fontSize: '70%' }">{{ item.businessName }}</div> -->
                <div>{{ item.businessName }}</div>
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
