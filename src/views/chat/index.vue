<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { NAlert, NAutoComplete, NButton, NGi, NGrid, NInput, NSpin, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faArrowUpLong, faDownload, faFileUpload, faHistory, faMicrophoneLines, faMusic, faPaperPlane, faPauseCircle, faPlayCircle, faTrashAlt, faVolumeUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import AudioEnter from './AudioEnter.vue'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore, useSettingStore } from '@/store'
import { fetchAndConvertToAudio, fetchChatAPIProcess, fetchChatConfig } from '@/api'
import { t } from '@/locales'

library.add(faArrowUpLong, faTrashAlt, faFileUpload, faMusic, faDownload, faHistory, faMicrophoneLines, faPauseCircle, faPlayCircle, faVolumeUp, faPaperPlane)

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()
const settingStore = useSettingStore()

const playAudio = ref(settingStore.playAudio ?? false)

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

// const showArrowIcon = ref(false)
const activeIndex = ref(null)

const isPlaying = ref(false)
const audioElement = ref<HTMLAudioElement | null>(null)

interface ConfigState {
  timeoutMs?: number
  reverseProxy?: string
  apiModel?: string
  socksProxy?: string
  httpsProxy?: string
  usage?: string
  menu?: string
  affixes?: string
}
const config = ref<ConfigState>()
// let keyLabelMap: Map<string, string>
let businessType = 0
let currentBusinessType = 'ChatGLM3'
let affixes
async function fetchConfig() {
  try {
    loading.value = true
    const { data } = await fetchChatConfig<ConfigState>()
    config.value = data
    const menu = config.value?.menu || '[]'
    const tmp = config.value?.affixes// 固定的快捷菜单
    if (tmp)
      affixes = tmp.split(',')
    // const jsonData = JSON.parse(menu)
    // 构造新的对象数组，仅包含具有 model 值的项
    // const filteredData = jsonData.filter(item => item.model)

    const models: Array<{ key: string; label: string; model: string }> = findItemsWithModel(JSON.parse(menu))
    // console.log(models)
    // keyLabelMap = createKeyLabelMap(JSON.parse(menu))
    // console.log(menu)
    const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
    if (undefined !== currentHistory)
      businessType = currentHistory.businessType
    const item = models.find(item => item.key === String(businessType))
    if (item)
      currentBusinessType = item.label || 'ChatGLM3'
    localStorage.setItem('menu', menu)
    localStorage.setItem('models', JSON.stringify(Array.from(models)))
  }
  finally {
    loading.value = false
  }
}

// 递归函数，用于遍历嵌套的数据结构
function findItemsWithModel(data) {
  const result: Array<{ key: string; label: string; model: string }> = []
  for (const item of data) {
    if (item.model) {
      result.push({
        label: item.label,
        key: item.key,
        model: item.model,
      })
    }
    if (item.children && item.children.length > 0) {
      const childResults = findItemsWithModel(item.children)
      result.push(...childResults)
    }
  }
  return result
}

function closeAudio(audioBlob: Blob) {
  console.log('closeAudioInput')
  showAudioInputBtn.value = false
  if (audioBlob === null)
    return
  handleAudioInput(audioBlob)
}

function isIpAddress(value) {
  // 简单的正则表达式来检查是否为 IP 地址
  // 这个正则仅适用于 IPv4 地址
  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/
  return ipRegex.test(value)
}

// 语音输入触发语音转写
async function handleAudioInput(audioBlob: Blob) {
  isSpinning.value = true // 开始加载，显示全局加载状态
  console.log('start handleAudioInput')
  const formData = new FormData()
  formData.append('file', audioBlob, 'audio.wav')
  const reverseProxy = config.value!.reverseProxy
  let whisperApiBaseUrl

  if (isIpAddress(reverseProxy)) {
  // 如果是 IP 地址，则添加端口号
    whisperApiBaseUrl = `${reverseProxy}:7001/transcribe`
  }
  else {
  // 如果是域名，则不添加端口号
    whisperApiBaseUrl = `${reverseProxy}/transcribe/transcribe/`
  }
  try {
    // http://172.16.1.118:7001/transcribe/
    // http://fastgpt.learnoh.cn/transcribe
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
    handleSubmit()// 自动提交转写后的内容
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

  const reverseProxy = config.value!.reverseProxy
  let whisperApiBaseUrl

  if (isIpAddress(reverseProxy)) {
  // 如果是 IP 地址，则添加端口号
    whisperApiBaseUrl = `${reverseProxy}:9876/customerService/upload/v1/files`
  }
  else {
  // 如果是域名，则不添加端口号
    whisperApiBaseUrl = `${reverseProxy}/customerService/customerService/upload/v1/files`
  }

  try {
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

// class AudioPlayQueue {
//   constructor() {
//     // this.audioElement = audioElement
//     this.queue = []
//     // this.isPlaying = false
//     // this.queueSize = 0 // Track the expected size of the queue
//   }

// Modify enqueueAudio to accept an index
let queue: Blob[] = []// 要播放音频的队列
let queueFinished = false // 新增标志，表示所有音频是否已加入队列
let currentIndex = 0 // 新增变量，跟踪当前处理的音频索引
async function enqueueAudio(message, index) {
  // console.log(`${index} ${message} ${isPlaying.value}`)
  const audioBlob = await fetchAndConvertToAudio(message)
  queue[index] = audioBlob
  // console.log(audioBlob)

  // If this is the first item and nothing is playing, start playback
  if (index === 0 && !isPlaying.value)
    playNextAudio()
}

async function playNextAudio() {
  isPlaying.value = true

  // 等待直到有音频可播放
  // eslint-disable-next-line no-unmodified-loop-condition
  while (currentIndex >= queue.length && !queueFinished)
    await new Promise(resolve => setTimeout(resolve, 100))

  // 检查是否还有更多音频要播放
  if (currentIndex < queue.length) {
    const audioBlob = queue[currentIndex++]
    const audioUrl = URL.createObjectURL(audioBlob)
    // console.log(audioUrl)
    if (audioElement.value !== null) {
      audioElement.value.src = audioUrl

      audioElement.value.play().then(() => {
        if (audioElement.value !== null) {
          audioElement.value.onended = () => {
            isPlaying.value = false
            playNextAudio() // 尝试播放下一个音频片段
          }
        }
      }).catch((error) => {
        console.error('Auto-play failed', error)
        isPlaying.value = false
        playNextAudio()
      })
    }
  }
  else {
    // 如果没有更多音频并且队列已完成，重置状态
    isPlaying.value = false
    queueFinished = false // 重置队列完成标志，以备下次使用
  }
}

// 在音频序列结束时调用这个函数
function markQueueAsFinished() {
  queueFinished = true
}

const punctuationRegex = /[!！,，.。;；?？\n]/
// 截取到最后一个标点符号
function extractLastPunctuation(str) {
  const match = str.match(punctuationRegex)
  if (match)
    return str.substring(0, match.index + match[0].length)
  else
    return str
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
    // const audioQueue = new AudioPlayQueue()
    const fetchChatAPIOnce = async () => {
      console.log(message)
      // console.log(options)
      const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      let businessType = 0
      if (undefined !== currentHistory)
        businessType = currentHistory.businessType
      // console.log('--------------0')
      // let needTts = false
      let previousText = ''
      let index = 0
      currentIndex = 0
      queueFinished = false
      queue = []
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: postMessage,
        options,
        signal: controller.signal,
        businessType,
        // needTts,
        systemMessage,
        onDownloadProgress: ({ event }) => {
          // console.log('--------------')
          // console.log(event)
          const xhr = event.target
          const { responseText } = xhr// 通过解构赋值，从 xhr 对象中提取 responseText 属性，responseText 通常包含了从服务器接收到的响应文本。
          // Always process the final line
          const lastIndex = responseText.lastIndexOf('\n', responseText.length - 2)// 查找响应文本中的最后一个换行符 \n 的位置。lastIndexOf 方法用于在字符串中从后往前搜索指定字符的位置。responseText.length - 2 是为了排除最后一个字符，因为它可能是不完整的行。
          let chunk = responseText// 创建了一个变量 chunk 并将其初始化为整个响应文本。在后续的代码中，将从响应文本中提取一部分数据并存储在 chunk 中。
          if (lastIndex !== -1)// 检查是否找到了换行符 \n，如果找到了，说明响应文本中有多行数据。
            chunk = responseText.substring(lastIndex)// 如果找到了换行符，这一行将 chunk 更新为从最后一个换行符开始到文本末尾的部分，以此来提取最后一行数据。
          try {
            const data = JSON.parse(chunk)
            // console.log(responseText)
            // console.log(data.text)
            // console.log(data)

            // 实时语音播报
            let input = data.text.substring(previousText.length)
            // console.log(punctuationRegex.test(input))
            if (playAudio.value && input && input !== '' && punctuationRegex.test(input)) { // 是否包含需要断句的标点符号
              input = extractLastPunctuation(input)// 取到最后一个断句的标点符号
              previousText = previousText + input
              // console.log(`${index} ${previousText} ${isPlaying.value}`)
              enqueueAudio(input.replace(/#/g, ''), index++)
              // fetchAndPlayAudio(audioElement.value, input.replace(/#/g, ''))
            }

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
      markQueueAsFinished()
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
    // const needTts = false
    const fetchChatAPIOnce = async () => {
      const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      let businessType = 0
      if (undefined !== currentHistory)
        businessType = currentHistory.businessType
      let previousText = ''
      let index = 0
      currentIndex = 0
      queueFinished = false
      queue = []
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: message,
        options,
        signal: controller.signal,
        businessType,
        // needTts,
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
            // console.log(uuid)
            // console.log(data)

            // 实时语音播报
            let input = data.text.substring(previousText.length)
            // console.log(punctuationRegex.test(input))
            if (playAudio.value && input && input !== '' && punctuationRegex.test(input)) { // 是否包含需要断句的标点符号
              input = extractLastPunctuation(input)// 取到最后一个断句的标点符号
              previousText = previousText + input
              // console.log(`${index} ${previousText} ${isPlaying.value}`)
              enqueueAudio(input.replace(/#/g, ''), index++)
              // fetchAndPlayAudio(audioElement.value, input.replace(/#/g, ''))
            }
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

            // const input = data.text// tts的input
            // if (playAudio.value && input && input !== '') {
            //   if (audioElement.value !== null)
            //     fetchAndPlayAudio(audioElement.value, input.replace(/#/g, ''))
            // }

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

function handleAffixClick(item) {
  prompt.value = item
  handleSubmit()
}

function setActiveIndex(index) {
  activeIndex.value = index
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

function togglePlay() {
  if (!audioElement.value)
    return
  if (audioElement.value.paused) {
    if (audioElement.value.src)
      audioElement.value.play()
  }
  else {
    audioElement.value.pause()
  }
}
</script>

<template>
  <Suspense>
    <div class="flex flex-col w-full h-full">
      <template v-if="isSpinning">
        <NSpin :show="isSpinning" class="global-spin">
          <template #description>
            语音转写中，请稍后
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
          <template v-if="playAudio">
            <div class="flex items-center justify-between space-x-2" style="margin-bottom: 8px;">
              <audio
                ref="audioElement"
                @play="isPlaying = true"
                @pause="isPlaying = false"
                @ended="isPlaying = false"
              />
            </div>
          </template>
          <!-- 数据分析的四个快捷按钮 -->
          <template v-if="!isMobile && businessType === 1001">
            <div class="flex items-center justify-between space-x-2" style="margin-bottom: 8px;">
              <NGrid x-gap="12" :cols="4">
                <NGi
                  v-for="(item, index) of affixes" :key="index" class="affix"
                  :class="{ 'hovered-grid': activeIndex === index }"
                  @click="handleAffixClick(item)"
                  @mouseover="setActiveIndex(index)"
                  @mouseout="setActiveIndex(null)"
                >
                  <NAlert title="" :show-icon="false">
                    {{ item }}
                    <FontAwesomeIcon v-if="activeIndex === index" icon="fas fa-arrow-up-long" style="float: right !important; padding-top: 5px;" />
                  </NAlert>
                </NGi>
              </NGrid>
            </div>
          </template>
          <div class="flex items-center justify-between space-x-2">
            <HoverButton v-if="!isMobile && (businessType === 10001 || businessType === 10002)" :title="businessType === 10001 ? '音频转写文字' : businessType === 10002 ? '文档总结' : ''" @click="triggerFileInput">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon :icon="businessType === 10001 ? 'fe:file-audio' : businessType === 10002 ? 'ic:twotone-upload-file' : ''" /> -->
                <FontAwesomeIcon :icon="businessType === 10001 ? 'fas fa-file-upload' : businessType === 10002 ? 'fas fa-file-upload' : ''" />
              </span>
            </HoverButton>
            <HoverButton v-if="playAudio" @click="togglePlay">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <FontAwesomeIcon :icon="isPlaying ? 'fas fa-pause-circle' : 'fas fa-play-circle'" />
              </span>
            </HoverButton>
            <HoverButton v-if="!isMobile" title="清空当前会话" @click="handleClear">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon icon="ri:delete-bin-line" /> -->
                <FontAwesomeIcon icon="fas fa-trash-alt" />
              </span>
            </HoverButton>
            <!-- <HoverButton v-if="!isMobile" title="保存会话到图片" @click="handleExport">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <FontAwesomeIcon icon="fas fa-download" />
              </span>
            </HoverButton> -->
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
.affix {
  cursor: pointer;
  /* border-radius: 8px; */
}
.hovered-grid {
  background-color: #333;
}
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
