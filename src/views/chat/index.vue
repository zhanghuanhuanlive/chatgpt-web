<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NAutoComplete, NButton, NInput, NSpin, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faDownload, faFileUpload, faHistory, faMicrophoneLines, faMusic, faPaperPlane, faTrashAlt, faVolumeUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import AudioEnter from './AudioEnter.vue'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore } from '@/store'
import { fetchChatAPIProcess, fetchChatConfig } from '@/api'
import { t } from '@/locales'

library.add(faTrashAlt, faFileUpload, faMusic, faDownload, faHistory, faMicrophoneLines, faVolumeUp, faPaperPlane)

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))

const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

const showAudioInputBtn = ref(false)

const isSpinning = ref(false)

interface ConfigState {
  timeoutMs?: number
  reverseProxy?: string
  apiModel?: string
  socksProxy?: string
  httpsProxy?: string
  usage?: string
}
const config = ref<ConfigState>()
// const whisperApiBaseUrl = ref<config>
async function fetchConfig() {
  try {
    loading.value = true
    const { data } = await fetchChatConfig<ConfigState>()
    // if (undefined !== data)
    config.value = data
    // console.log(config.value.reverseProxy)
  }
  finally {
    loading.value = false
  }
}

// const xyz = fetchChatConfig()

// await fetchChatAPIProcess

// console.log(xyz.api)
// console.log(import.meta.env)

// const WHISPER_API_BASE_URL = process.env.WHISPER_API_BASE_URL as string

// const loadingBar = useLoadingBar()

let businessType = 0

const currentBusinessType = computed(() => {
  const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
  // let businessType = 0
  let currentBusinessTypeName = 'ChatGLM3'
  if (undefined !== currentHistory)
    businessType = currentHistory.businessType
  if (businessType === 10)
    currentBusinessTypeName = '百度文心一言'
  else if (businessType === 20)
    currentBusinessTypeName = '科大讯飞星火认知V3.0'
  else if (businessType === 30)
    currentBusinessTypeName = '阿里通义千问'
  else if (businessType === 90)
    currentBusinessTypeName = 'GPT3.5'
  else if (businessType === 100)
    currentBusinessTypeName = '政策事项知识库'
  else if (businessType === 108)
    currentBusinessTypeName = '招商政策知识库'
  else if (businessType === 101)
    currentBusinessTypeName = '民法典'
  else if (businessType === 1001)
    currentBusinessTypeName = '数据分析'
  else if (businessType === 10001)
    currentBusinessTypeName = '语音转写文字'
  else if (businessType === 10002)
    currentBusinessTypeName = '文档分析'
  return currentBusinessTypeName
})

function closeAudio(audioBlob: Blob) {
  console.log('closeAudioInput')
  showAudioInputBtn.value = false
  if (audioBlob === null)
    return
  handleAudioInput(audioBlob)
}

// 语音输入触发语音转写
async function handleAudioInput(audioBlob: Blob) {
  isSpinning.value = true // 开始加载，显示全局加载状态
  console.log('start handleAudioInput')
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  try {
    // http://172.16.1.118:7001/transcribe/
    // http://fastgpt.learnoh.cn/transcribe
    const whisperApiBaseUrl = `${config.value!.reverseProxy}:7001/transcribe` || 'https://fastgpt.learnoh.cn/transcribe/transcribe'
    const response = await fetch(whisperApiBaseUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok)
      throw new Error(`服务器响应错误：${response.status}`)

    const result = await response.json()// 如果是json：response.json()
    console.log(result)
    prompt.value = result.text // 更新 prompt 的值
    // loadingBar.finish() // 完成后隐藏加载条
  }
  catch (error) {
    console.error('转录失败:', error)
  }
  finally {
    isSpinning.value = false // 加载结束，隐藏全局加载状态
  }
}

function showAudioInput() {
  showAudioInputBtn.value = true
  // console.log(showAudioInputBtn)
}

// 未知原因刷新页面，loading 状态不会重置，手动重置
dataSources.value.forEach((item, index) => {
  if (item.loading)
    updateChatSome(+uuid, index, { loading: false })
})

// 上传按钮触发语音转写
function triggerFileInput() {
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  if (businessType === 10001)
    fileInput.accept = '.mp3,.wav'
  else if (businessType === 10002)
    fileInput.accept = '.doc,.docx,.pdf,.xls,.xlsx'
  // fileInput.accept = 'audio/*'
  fileInput.onchange = (event) => {
    if (event.target instanceof HTMLInputElement)
      handleUploadAudio(event.target.files)
  }
  fileInput.click()
}

async function handleUploadAudio(files: FileList | null) {
  if (!files || files.length === 0) {
    ms.error('未选择文件')
    return
  }
  const file = files[0]

  // Get the name of the file
  const fileName = file.name
  // console.log('File name:', fileName)

  // Extracting the file extension
  const fileExtension = fileName.split('.').pop() || 'doc'
  // console.log('File extension:', fileExtension)

  const formData = new FormData()
  formData.append('file', file)

  const documentExtensions = ['doc', 'docx', 'pdf', 'xls', 'xlsx', 'ppt', 'pptx']
  const audioExtensions = ['wav', 'mp3']

  // let userText = ''
  // let const assistentText = ''
  // Determine the file type
  // Handle unsupported file type

  // 添加初始聊天消息以显示文件正在上传
  // const chatIndex = dataSources.value.length;
  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: `上传文件：${fileName}`,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: '', options: null }, // 使用空字符串和null作为默认值
    },
  )
  scrollToBottom()
  // loading.value = true
  prompt.value = ''
  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: '上传中',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: '', options: null },
    },
  )
  scrollToBottom()

  try {
    // 移除 console.log，或者替换为其他日志记录方式
    // http://172.16.1.118:7001/transcribe/
    // http://fastgpt.learnoh.cn/transcribe
    const whisperApiBaseUrl = `${config.value!.reverseProxy}:9876/customerService/upload/v1/files` || 'https://fastgpt.learnoh.cn/customerService'
    // console.log(whisperApiBaseUrl)
    const response = await fetch(whisperApiBaseUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok)
      throw new Error(`服务器响应错误：${response.status}`)

    // 使用 .json() 方法解析 JSON 响应
    const result = await response.json()

    //
    const transcription = result.text
    // console.log(transcription)
    const uploadedFileName = result.fileName
    // 移除 console.log，或者替换为其他日志记录方式

    // 更新聊天消息以显示转写文本
    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: transcription,
        inversion: false,
        error: false,
        loading: false,
        conversationOptions: null,
        requestOptions: {
          // prompt: `这是语音转写的结果，需要你帮我检查是否有问题，并返回完善后的内容给我：${transcription}`,
          prompt: '',
          options: null,
        },
      },
    )
    scrollToBottomIfAtBottom()
    if (documentExtensions.includes(fileExtension)) { // config.value!.reverseProxy
      prompt.value = '总结文档'
    }
    else if (audioExtensions.includes(fileExtension)) {
      prompt.value = '转写音频文件成文字'
    }
    else { console.log('Unsupported file type') }
    // loading.value = false
    // 直接向后台发送转写或总结的请求
    // console.log(uploadedFileName)
    if (undefined !== uploadedFileName && uploadedFileName !== '')
      onConversation(uploadedFileName)// 把文件名作为systemMessage传给后台
    else
      onConversation('')
  }
  catch (error) {
    ms.error(error instanceof Error ? error.message : '上传文件失败')
    // 移除 console.log，或者替换为其他日志记录方式

    // 更新聊天消息以显示错误信息
    updateChatSome(
      +uuid,
      dataSources.value.length - 1,
      {
        text: `错误：${error instanceof Error ? error.message : '上传文件失败'}`,
        error: true,
        loading: false,
      },
    )
    // 移除 console.log，或者替换为其他日志记录方式
  }
  finally {
    loading.value = false
    // 移除 console.log，或者替换为其他日志记录方式
  }
}

function handleSubmit() {
  onConversation('')
}

// systemMessage就是上传的文件(音频、文件)在服务器的绝对路径
async function onConversation(systemMessage: string) {
  let message = prompt.value
  // const postMessage = `${message}**##**${systemMessage}**##**`
  const postMessage = systemMessage === '' ? message : `${message}**##**${systemMessage}**##**`
  // console.log(message)

  if (loading.value)
    return

  if (!message || message.trim() === '')
    return

  controller = new AbortController()

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: postMessage,
      inversion: true,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: null },
    },
  )
  scrollToBottom()
  // console.log('----------------------')

  loading.value = true
  prompt.value = ''

  let options: Chat.ConversationRequest = {}
  const lastContext = conversationList.value[conversationList.value.length - 1]?.conversationOptions

  if (lastContext && usingContext.value)
    options = { ...lastContext }

  addChat(
    +uuid,
    {
      dateTime: new Date().toLocaleString(),
      text: businessType === 10001 ? '转写中' : businessType === 10002 ? '总结中' : '思考中',
      loading: true,
      inversion: false,
      error: false,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )
  scrollToBottom()

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      console.log(message)
      // console.log(options)
      const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      let businessType = 0
      if (undefined !== currentHistory)
        businessType = currentHistory.businessType
      // console.log('--------------0')
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: postMessage,
        options,
        signal: controller.signal,
        businessType,
        systemMessage,
        onDownloadProgress: ({ event }) => {
          // console.log('--------------')
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            // console.log(data.text)
            updateChat(
              +uuid,
              dataSources.value.length - 1,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }

            scrollToBottomIfAtBottom()
          }
          catch (error) {
            //
          }
        },
      })
      updateChatSome(+uuid, dataSources.value.length - 1, { loading: false })
    }

    await fetchChatAPIOnce()
  }
  catch (error: any) {
    const errorMessage = error?.message ?? t('common.wrong')

    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          loading: false,
        },
      )
      scrollToBottomIfAtBottom()
      return
    }

    const currentChat = getChatByUuidAndIndex(+uuid, dataSources.value.length - 1)

    if (currentChat?.text && currentChat.text !== '') {
      updateChatSome(
        +uuid,
        dataSources.value.length - 1,
        {
          text: `${currentChat.text}\n[${errorMessage}]`,
          error: false,
          loading: false,
        },
      )
      return
    }

    updateChat(
      +uuid,
      dataSources.value.length - 1,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
    scrollToBottomIfAtBottom()
  }
  finally {
    loading.value = false
  }
}

async function onRegenerate(index: number) {
  if (loading.value)
    return

  controller = new AbortController()

  const { requestOptions } = dataSources.value[index]

  let message = requestOptions?.prompt ?? ''

  let options: Chat.ConversationRequest = {}

  if (requestOptions.options)
    options = { ...requestOptions.options }

  loading.value = true

  updateChat(
    +uuid,
    index,
    {
      dateTime: new Date().toLocaleString(),
      text: '',
      inversion: false,
      error: false,
      loading: true,
      conversationOptions: null,
      requestOptions: { prompt: message, options: { ...options } },
    },
  )

  try {
    let lastText = ''
    const fetchChatAPIOnce = async () => {
      const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      let businessType = 0
      if (undefined !== currentHistory)
        businessType = currentHistory.businessType
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
        businessType,
        systemMessage: '',
        onDownloadProgress: ({ event }) => {
          const xhr = event.target
          const { responseText } = xhr
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)
          let chunk = responseText
          if (lastIndex !== -1)
            chunk = responseText.substring(lastIndex)
          try {
            const data = JSON.parse(chunk)
            updateChat(
              +uuid,
              index,
              {
                dateTime: new Date().toLocaleString(),
                text: lastText + (data.text ?? ''),
                inversion: false,
                error: false,
                loading: true,
                conversationOptions: { conversationId: data.conversationId, parentMessageId: data.id },
                requestOptions: { prompt: message, options: { ...options } },
              },
            )

            if (openLongReply && data.detail.choices[0].finish_reason === 'length') {
              options.parentMessageId = data.id
              lastText = data.text
              message = ''
              return fetchChatAPIOnce()
            }
          }
          catch (error) {
            //
          }
        },
      })
      updateChatSome(+uuid, index, { loading: false })
    }
    await fetchChatAPIOnce()
  }
  catch (error: any) {
    if (error.message === 'canceled') {
      updateChatSome(
        +uuid,
        index,
        {
          loading: false,
        },
      )
      return
    }

    const errorMessage = error?.message ?? t('common.wrong')

    updateChat(
      +uuid,
      index,
      {
        dateTime: new Date().toLocaleString(),
        text: errorMessage,
        inversion: false,
        error: true,
        loading: false,
        conversationOptions: null,
        requestOptions: { prompt: message, options: { ...options } },
      },
    )
  }
  finally {
    loading.value = false
  }
}

function handleExport() {
  if (loading.value)
    return

  const d = dialog.warning({
    title: t('chat.exportImage'),
    content: t('chat.exportImageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: async () => {
      try {
        d.loading = true
        const ele = document.getElementById('image-wrapper')
        const canvas = await html2canvas(ele as HTMLDivElement, {
          useCORS: true,
        })
        const imgUrl = canvas.toDataURL('image/png')
        const tempLink = document.createElement('a')
        tempLink.style.display = 'none'
        tempLink.href = imgUrl
        tempLink.setAttribute('download', 'chat-shot.png')
        if (typeof tempLink.download === 'undefined')
          tempLink.setAttribute('target', '_blank')

        document.body.appendChild(tempLink)
        tempLink.click()
        document.body.removeChild(tempLink)
        window.URL.revokeObjectURL(imgUrl)
        d.loading = false
        ms.success(t('chat.exportSuccess'))
        Promise.resolve()
      }
      catch (error: any) {
        ms.error(t('chat.exportFailed'))
      }
      finally {
        d.loading = false
      }
    },
  })
}

function handleDelete(index: number) {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.deleteMessage'),
    content: t('chat.deleteMessageConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.deleteChatByUuid(+uuid, index)
    },
  })
}

function handleClear() {
  if (loading.value)
    return

  dialog.warning({
    title: t('chat.clearChat'),
    content: t('chat.clearChatConfirm'),
    positiveText: t('common.yes'),
    negativeText: t('common.no'),
    onPositiveClick: () => {
      chatStore.clearChatByUuid(+uuid)
    },
  })
}

function handleEnter(event: KeyboardEvent) {
  if (!isMobile.value) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
  else {
    if (event.key === 'Enter' && event.ctrlKey) {
      event.preventDefault()
      handleSubmit()
    }
  }
}

function handleStop() {
  if (loading.value) {
    controller.abort()
    loading.value = false
  }
}

// 可优化部分
// 搜索选项计算，这里使用value作为索引项，所以当出现重复value时渲染异常(多项同时出现选中效果)
// 理想状态下其实应该是key作为索引项,但官方的renderOption会出现问题，所以就需要value反renderLabel实现
const searchOptions = computed(() => {
  if (prompt.value.startsWith('/')) {
    return promptTemplate.value.filter((item: { key: string }) => item.key.toLowerCase().includes(prompt.value.substring(1).toLowerCase())).map((obj: { value: any }) => {
      return {
        label: obj.value,
        value: obj.value,
      }
    })
  }
  else {
    return []
  }
})

// value反渲染key
const renderOption = (option: { label: string }) => {
  for (const i of promptTemplate.value) {
    if (i.value === option.label)
      return [i.key]
  }
  return []
}

const placeholder = computed(() => {
  if (isMobile.value)
    return t('chat.placeholderMobile')
  return t('chat.placeholder')
})

const buttonDisabled = computed(() => {
  return loading.value || !prompt.value || prompt.value.trim() === ''
})

const footerClass = computed(() => {
  let classes = ['p-4']
  if (isMobile.value)
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-2', 'pr-3', 'overflow-hidden']
  return classes
})

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
  fetchConfig()
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
})
</script>

<template>
  <Suspense>
    <div class="flex flex-col w-full h-full">
      <template v-if="isSpinning">
        <NSpin :show="isSpinning" class="global-spin">
          <template #description>
            语音转换中，请稍后
          </template>
        </NSpin>
      </template>
      <HeaderComponent
        v-if="isMobile"
        :using-context="usingContext"
        @export="handleExport"
        @handle-clear="handleClear"
      />
      <main class="flex-1 overflow-hidden">
        <div id="scrollRef" ref="scrollRef" class="h-full overflow-hidden overflow-y-auto">
          <div
            id="image-wrapper"
            class="w-full max-w-screen-xl m-auto dark:bg-[#101014]"
            :class="[isMobile ? 'p-2' : 'p-4']"
          >
            <!-- <template v-if="!dataSources.length">
            <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <SvgIcon icon="ri:bubble-chart-fill" class="mr-2 text-3xl" />
              <span>Aha~</span>
              <span>{{ currentBusinessType }}</span>
            </div>
          </template>
          <template v-else> -->
            <!-- <template> -->
            <div class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <SvgIcon icon="fluent:brain-circuit-24-filled" class="mr-2 text-3xl" />
              <span>{{ currentBusinessType }}</span>
            </div>
            <div>
              <Message
                v-for="(item, index) of dataSources"
                :key="index"
                :date-time="item.dateTime"
                :text="item.text"
                :inversion="item.inversion"
                :error="item.error"
                :loading="item.loading"
                @regenerate="onRegenerate(index)"
                @delete="handleDelete(index)"
              />
              <div class="sticky bottom-0 left-0 flex justify-center">
                <NButton v-if="loading" type="warning" @click="handleStop">
                  <template #icon>
                    <SvgIcon icon="ri:stop-circle-line" />
                  </template>
                  {{ t('common.stopResponding') }}
                </NButton>
              </div>
            </div>
          <!-- </template> -->
          </div>
        </div>
      </main>
      <footer :class="footerClass">
        <div class="w-full max-w-screen-xl m-auto">
          <div class="flex items-center justify-between space-x-2">
            <HoverButton v-if="!isMobile && (businessType === 10001 || businessType === 10002)" :title="businessType === 10001 ? '音频转写文字' : businessType === 10002 ? '文档总结' : ''" @click="triggerFileInput">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon :icon="businessType === 10001 ? 'fe:file-audio' : businessType === 10002 ? 'ic:twotone-upload-file' : ''" /> -->
                <FontAwesomeIcon :icon="businessType === 10001 ? 'fas fa-music' : businessType === 10002 ? 'fas fa-file-upload' : ''" />
              </span>
            </HoverButton>
            <HoverButton v-if="!isMobile" title="清空当前会话" @click="handleClear">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon icon="ri:delete-bin-line" /> -->
                <FontAwesomeIcon icon="fas fa-trash-alt" />
              </span>
            </HoverButton>
            <HoverButton v-if="!isMobile" title="保存会话到图片" @click="handleExport">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon icon="ri:download-2-line" /> -->
                <FontAwesomeIcon icon="fas fa-download" />
              </span>
            </HoverButton>
            <HoverButton v-if="businessType !== 10001 && businessType !== 10002" title="不携带历史记录" @click="toggleUsingContext">
              <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
                <!-- <SvgIcon icon="ri:chat-history-line" /> -->
                <FontAwesomeIcon icon="fas fa-history" />
              </span>
            </HoverButton>
            <HoverButton v-if="businessType !== 10001 && businessType !== 10002" title="语音输入" @click="showAudioInput">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon icon="lets-icons:sound-max-duotone" /> -->
                <FontAwesomeIcon icon="fas fa-microphone-lines" />
              </span>
            </HoverButton>
            <AudioEnter :is-show="showAudioInputBtn" @close-audio="closeAudio" />
            <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
              <template #default="{ handleInput, handleBlur, handleFocus }">
                <NInput
                  ref="inputRef"
                  v-model:value="prompt"
                  type="textarea"
                  :placeholder="placeholder"
                  :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                  :disabled="businessType === 10001"
                  @input="handleInput"
                  @focus="handleFocus"
                  @blur="handleBlur"
                  @keypress="handleEnter"
                />
              </template>
            </NAutoComplete>
            <NButton type="primary" :disabled="buttonDisabled" @click="handleSubmit">
              <template #icon>
                <span class="dark:text-black">
                  <!-- <SvgIcon icon="ri:send-plane-fill" /> -->
                  <FontAwesomeIcon icon="fas fa-paper-plane" />
                </span>
              </template>
            </NButton>
          </div>
        </div>
      </footer>
    </div>
  </Suspense>
</template>

<style scoped>
.global-spin {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8); /* 半透明背景 */
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000; /* 确保在最顶层 */
}
</style>
