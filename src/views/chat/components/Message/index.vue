<script setup lang='ts'>
import { computed, ref } from 'vue'
import { NButton, NDropdown, useMessage } from 'naive-ui'
import { faArrowRotateLeft, faCopy, faEllipsisVertical, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import AvatarComponent from './Avatar.vue'
import TextComponent from './Text.vue'
import { useIconRender } from '@/hooks/useIconRender'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { copyToClip } from '@/utils/copy'
import { t } from '@/locales'

const props = defineProps<Props>()

const emit = defineEmits<Emit>()

library.add(faArrowRotateLeft, faCopy, faEllipsisVertical, faTrashAlt)

interface Props {
  dateTime?: string
  text?: string
  inversion?: boolean
  error?: boolean
  loading?: boolean
}

interface Emit {
  (ev: 'regenerate'): void
  (ev: 'delete'): void
}

const { isMobile } = useBasicLayout()

const { iconRender } = useIconRender()

const message = useMessage()

const textRef = ref<HTMLElement>()

const asRawText = ref(props.inversion)

const messageRef = ref<HTMLElement>()

const showButtons = ref(false)

const options = computed(() => {
  const common = [
    {
      label: t('chat.copy'),
      key: 'copyText',
      icon: iconRender({ icon: 'ri:file-copy-2-line' }),
    },
    // {
    //   label: t('common.delete'),
    //   key: 'delete',
    //   icon: iconRender({ icon: 'ri:delete-bin-line' }),
    // },
  ]

  // if (!props.inversion) {
  //   common.unshift({
  //     label: asRawText.value ? t('chat.preview') : t('chat.showRawText'),
  //     key: 'toggleRenderType',
  //     icon: iconRender({ icon: asRawText.value ? 'ic:outline-code-off' : 'ic:outline-code' }),
  //   })
  // }

  return common
})

function handleSelect(key: 'copyText' | 'delete' | 'toggleRenderType') {
  switch (key) {
    case 'copyText':
      handleCopy()
      return
    case 'toggleRenderType':
      asRawText.value = !asRawText.value
      return
    case 'delete':
      emit('delete')
  }
}

// function handleRegenerate() {
//   messageRef.value?.scrollIntoView()
//   emit('regenerate')
// }

async function handleCopy() {
  try {
    let text = props.text
    text = text === undefined ? '' : text.replace(/\*\*\#\#\*\*(.*?)\*\*\#\#\*\*/g, '')
    await copyToClip(text || '')
    message.success('复制成功')
  }
  catch {
    message.error('复制失败')
  }
}
</script>

<template>
  <div
    ref="messageRef"
    class="flex w-full mb-6 overflow-hidden"
    :class="[{ 'flex-row-reverse': inversion }]"
  >
    <div
      class="flex items-center justify-center flex-shrink-0 h-8 overflow-hidden rounded-full basis-8"
      :class="[inversion ? 'ml-2' : 'mr-2']"
    >
      <AvatarComponent :image="inversion" />
    </div>
    <div
      class="overflow-hidden text-sm " :class="[inversion ? 'items-end' : 'items-start']"
      @mouseenter="showButtons = true"
      @mouseleave="showButtons = false"
    >
      <div class="flex items-center">
        <div class="text-xs text-[#b4bbc4]" :class="[inversion ? 'text-right' : 'text-left']" style="height: 23px;line-height: 23px;">
          <text class="mr-2">
            {{ dateTime }}
          </text>
          <NButton v-show="showButtons && !inversion" quaternary size="tiny" @click="handleCopy">
            <FontAwesomeIcon icon="fas fa-copy" />
          </NButton>
          <!-- <NButton v-show="showButtons" quaternary size="tiny" @click="emit('delete')">
            <FontAwesomeIcon icon="fas fa-trash-alt" />
          </NButton> -->
        </div>
      </div>

      <div
        class="flex items-end gap-1 mt-2"
        :class="[inversion ? 'flex-row-reverse' : 'flex-row']"
      >
        <TextComponent
          ref="textRef"
          :inversion="inversion"
          :error="error"
          :text="text"
          :loading="loading"
          :as-raw-text="asRawText"
        />
        <div class="flex flex-col">
          <!-- <button
            v-if="!inversion"
            class="mb-2 transition text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-300"
            @click="handleRegenerate"
          >
            <FontAwesomeIcon icon="fas fa-arrow-rotate-left" />
          </button> -->
          <NDropdown
            v-if="isMobile"
            :trigger="isMobile ? 'click' : 'hover'"
            :placement="!inversion ? 'right' : 'left'"
            :options="options"
            @select="handleSelect"
          >
            <button class="transition text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-200">
              <FontAwesomeIcon icon="fas fa-ellipsis-vertical" />
            </button>
          </NDropdown>
        </div>
      </div>
    </div>
  </div>
</template>
