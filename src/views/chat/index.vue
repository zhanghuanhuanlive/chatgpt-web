<script setup lang='ts'>
import type { Ref } from 'vue'
import { computed, onMounted, onUnmounted, reactive, ref } from 'vue'
// import { Overlay } from 'vant'
import { useRoute } from 'vue-router'
import Recorder from 'js-audio-recorder'
import { storeToRefs } from 'pinia'
import { NAlert, NAutoComplete, NButton, NGi, NGrid, NInput, NSpin, useDialog, useMessage } from 'naive-ui'
import html2canvas from 'html2canvas'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faArrowUpLong, faDownload, faFileUpload, faHistory, faMicrophoneLines, faMicrophoneLinesSlash, faMusic, faPaperPlane, faPauseCircle, faPlayCircle, faTrashAlt, faVolumeUp } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { Message } from './components'
import { useScroll } from './hooks/useScroll'
import { useChat } from './hooks/useChat'
import { useUsingContext } from './hooks/useUsingContext'
import HeaderComponent from './components/Header/index.vue'
import { HoverButton, SvgIcon } from '@/components/common'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { useChatStore, usePromptStore, useSettingStore } from '@/store'
import { fetchAndConvertToAudio, fetchChatAPIProcess, fetchChatConfig } from '@/api'
import { t } from '@/locales'

library.add(faArrowUpLong, faTrashAlt, faFileUpload, faMusic, faDownload, faHistory, faMicrophoneLines, faMicrophoneLinesSlash, faPauseCircle, faPlayCircle, faVolumeUp, faPaperPlane)

let controller = new AbortController()

const openLongReply = import.meta.env.VITE_GLOB_OPEN_LONG_REPLY === 'true'

const route = useRoute()
const dialog = useDialog()
const ms = useMessage()

const chatStore = useChatStore()
const settingStore = useSettingStore()

// const playAudio = ref(settingStore.playAudio ?? false)
const playAudio = computed(() => settingStore.playAudio)

const { isMobile } = useBasicLayout()
const { addChat, updateChat, updateChatSome, getChatByUuidAndIndex } = useChat()
const { scrollRef, scrollToBottom, scrollToBottomIfAtBottom } = useScroll()
const { usingContext, toggleUsingContext } = useUsingContext()

const { uuid } = route.params as { uuid: string }

const dataSources = computed(() => chatStore.getChatByUuid(+uuid))
// console.log(dataSources.value)
const conversationList = computed(() => dataSources.value.filter(item => (!item.inversion && !!item.conversationOptions)))
// console.log(conversationList.value)
const prompt = ref<string>('')
const loading = ref<boolean>(false)
const inputRef = ref<Ref | null>(null)

/** 特殊的businessType */
const ENGLISH_CORNER = '9001' // 英语角
const STT = '10001' // 语音转写
const FILE_SUMMARY = '10002' // 文件总结

// 添加PromptStore
const promptStore = usePromptStore()

// 使用storeToRefs，保证store修改后，联想部分能够重新渲染
const { promptList: promptTemplate } = storeToRefs<any>(promptStore)

const showAudioInputComponent = ref(false) // 是否显示语音输入组件
const isAudioInput = ref(false) // 是否已启用了语音输入
// interface AudioEnterMethods {
//   destroyRecorder: () => void
//   startRecorder: () => void
//   hide: () => void
// }
// const audioEnterRef = ref<AudioEnterMethods | null>(null)
// const audioEnterRef = ref(null)// 引用的录音子组件
// const audioEnterRef = ref<typeof AudioEnter | null>(null)

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
  // affixes?: string
  openai_api_model?: string
}
interface SayHello {
  text: string
  audio?: string
}
interface Model {
  key: string
  label?: string
  model: string
  sayHello?: SayHello
  systemMessage?: string // 每个模型对应的系统提示词
  faq?: string
  faqs?: string[]
}
const config = ref<ConfigState>()
// let keyLabelMap: Map<string, string>
let businessType = '0' // 对应配置文件中的key，9001是口语
let currentBusinessTypeName = ''// 这里定义的名字会在页面初始化时显示
// let systemMessage = '' // 每个模型对应的系统提示词
// const faqs: string[] = []
let currentModel: Model | undefined // 当前使用的模型以及配置的参数
async function fetchConfig() {
  try {
    loading.value = true
    const { data } = await fetchChatConfig<ConfigState>()
    config.value = data
    const menu = config.value?.menu || '[]'
    // let model = config.value?.menu || 'chatglm3-6b'
    // const tmp = config.value?.affixes// 固定的快捷菜单

    const models: Array<Model> = findItemsWithModel(JSON.parse(menu))
    // console.log(models)
    // keyLabelMap = createKeyLabelMap(JSON.parse(menu))
    // console.log(menu)
    const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
    if (undefined !== currentHistory)
      businessType = currentHistory.businessType
    console.log(currentHistory)
    console.log(businessType)
    if (models.length === 1) {
      currentModel = models[0]
      businessType = currentModel.key
    }
    else { currentModel = models.find(item => item.key === String(businessType)) }
    console.log(businessType)
    console.log(currentModel)
    if (currentModel) {
      currentBusinessTypeName = currentModel.label || 'ChatGLM3'
      // model = item.model
      // if (currentModel.systemMessage)
      //   systemMessage = currentModel.systemMessage
      if (currentModel.faq) { // 固定的快捷菜单，也可能时常见问题
        currentModel.faqs = currentModel.faq.split('||||')
      }
      if (dataSources.value.length === 0 && currentModel.sayHello) { // 如果是新的对话，并且配置了sayHello
        console.log(currentModel.sayHello)
        const sayHelloText = currentModel.sayHello.text
        if (sayHelloText) { // 插入sayHello到历史记录
          addChat(
            +uuid,
            {
              dateTime: new Date().toLocaleString(),
              text: currentModel.sayHello.text,
              inversion: false,
              error: false,
              conversationOptions: null,
              requestOptions: { prompt: '', options: null }, // 使用空字符串和null作为默认值
            },
          )
          if (playAudio.value) {
            enqueueAudio(sayHelloText, 0)
            updateQueueLength(1)
          }
        }
      }
    }
    // localStorage.setItem('model', model)
    localStorage.setItem('menu', menu)
    localStorage.setItem('models', JSON.stringify(Array.from(models)))
  }
  finally {
    loading.value = false
  }
}

// 递归函数，用于遍历嵌套的数据结构
function findItemsWithModel(data) {
  if (!Array.isArray(data)) // 处理只有一个模型的情况
    return [data]
  const result: Array<Model> = []
  for (const item of data) {
    console.log(item)
    if (item.model) {
      result.push({
        label: item.label,
        key: item.key,
        model: item.model,
        systemMessage: item.systemMessage,
        sayHello: item.sayHello,
        faq: item.faq,
      })
    }
    if (item.children && item.children.length > 0) {
      const childResults = findItemsWithModel(item.children)
      result.push(...childResults)
    }
  }
  return result
}

/**  Audio Input */

const beginRecoding = ref(false)
const drawColuList = ref<number[]>([])

interface State {
  isShow: boolean
  blackBoxSpeak: boolean
  startY: number
  timeOutEvent: number
  waveCanvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D | null
  recorder: any
  drawRecordId: number | null
  limitDuration: number
  silenceStartTime: number | null
  silenceDurationThresholdAfterTalk: number
  silenceDurationThreshold: number
  talkDurationThreshold: number
  talkingStartTime: number | null
  talkingDuration: number | null
  talkingDetected: boolean
  needSubmit: boolean
  needCheckSilence: boolean
  hasPermission: boolean
}

const state: State = reactive({
  isShow: false,
  // beginRecoding: false,
  blackBoxSpeak: false,
  startY: 0,
  timeOutEvent: 0,
  waveCanvas: null,
  ctx: null,
  recorder: null,
  drawRecordId: null,
  // nowDuration: null,
  limitDuration: 60,
  // drawColuList: [],
  silenceStartTime: null,
  silenceDurationThresholdAfterTalk: 2000,
  silenceDurationThreshold: 5000,
  talkDurationThreshold: 500,
  talkingStartTime: null,
  talkingDuration: null,
  talkingDetected: false,
  needSubmit: false,
  needCheckSilence: false,
  hasPermission: false,
})

function handleKeyDown(event) {
  if (event.key === 'Escape' || event.keyCode === 27) {
    console.log('ESC 键被按下了')
    // showAudioInputComponent.value = false
    // hideAudioInputComponent()
    stopAudioInput()
  }
}

// 获取麦克风权限
function getPermission() {
  return Recorder.getPermission().then(() => {
    state.isShow = true
    state.hasPermission = true
    console.log('录音权限已授权')
    // abc('录音权限已授权')
  }, (error) => {
    console.error(`${error.name} : ${error.message}`)
  })
}

function startRecorder() {
  // console.log('startRecorder')
  if (!state.hasPermission)
    getPermission()// 获取录音权限
  // abc('startRecorder')
  if (beginRecoding.value)
    stopRecorder()
  state.isShow = true
  document.addEventListener('keydown', handleKeyDown)// 监听按键
  // if (!state.recorder) {
  // console.log('new Recorder')
  // abc('new Recorder')
  // 创建录音实例
  state.recorder = new Recorder({
    sampleBits: 16, // 采样位数，支持 8 或 16，默认是16
    sampleRate: 48000, // 采样率，支持 11025、16000、22050、24000、44100、48000，根据浏览器默认值
    numChannels: 1, // 声道，支持 1 或 2， 默认是1
    // compiling: false,(0.x版本中生效,1.x增加中)  // 是否边录边转换，默认是false
  })
  // 监听录音变化等
  // 监听录音变化
  // const vm = state
  if (state.recorder) {
    // state.recorder.onprogress = (params) => {
    // if (Math.floor(params.duration) === state.limitDuration)
    //   state.touchend()

    // let d = Math.floor(params.duration)
    // d = Number(d) < 10 ? `0${d}` : d
    // d = `0:${d}`
    // state.nowDuration = d // directly setting the data property

    // console.log('--------------START---------------')
    // console.log('录音时长(秒)', params.duration)
    // console.log('录音大小(字节)', params.fileSize);
    // if (params.vol > 15)
    //   console.log('录音音量百分比(%)', params.vol)
    // console.log('当前录音的总数据([DataView, DataView...])', params.data)
    // console.log('--------------END---------------')
    // }
    // state.startCanvas()
    // }

    // state.toggleRecording() // 页面初始化完成后，自动开始录音
    // if (!beginRecoding.value)
    //   state.startRecorder()
    (state.recorder as any).start().then(() => {
      beginRecoding.value = true
      // state.drawRecordWave()// 开始绘制
      state.needCheckSilence = true
      drawRecordColu() // 开始绘制
    }, (error) => {
      console.log(`${error.name} : ${error.message}`)
    })
  }
}

function toggleRecording() { // PC
  // console.log(`toggleRecording： ${beginRecoding.value}`)
  if (!beginRecoding.value) {
    startRecorder()
  }
  else if (state.needSubmit && state.recorder) {
    // state.stopRecorder() // 停止录音
    const duration = state.recorder.duration
    // console.log(`state.needSubmit: ${state.needSubmit} ${duration}`)
    // abc(`state.needSubmit: ${state.needSubmit} ${duration}`)
    if (duration > 2) {
      // state.isShow = false
      // state.$emit('closeAudio', state.recorder.getWAVBlob())
      closeAudio((state.recorder as any).getWAVBlob())
    }
    else {
      // state.stopRecorder()
      // state.$emit('closeAudio', null)
      startRecorder()// 录音时间太短,重新开始录音
      // state.isShow = true
    }
  }
  else { // 不需要提交，是监测到静音阈值了
    // state.stopRecorder()
    startRecorder()// 没有人说话,重新开始录音
    // state.isShow = true
    // state.$emit('closeAudio', null)
  }
  beginRecoding.value = !beginRecoding.value
}

function stopRecorder() {
  if (state.recorder)
    state.recorder.stop()

  state.drawRecordId && cancelAnimationFrame(state.drawRecordId)
  state.drawRecordId = null
}

function destroyRecorder() {
  // abc('destroyRecorder')
  if (state.recorder) {
    console.log('destroyRecorder')
    state.recorder.destroy().then(() => {
      state.recorder = null
      state.drawRecordId && cancelAnimationFrame(state.drawRecordId)
      state.drawRecordId = null
    })
  }
}

// 录音绘制柱状图
function drawRecordColu() {
  // console.log('drawRecordColu')
  // 用requestAnimationFrame稳定60fps绘制(官方写法，录音过程中，会一直自我调用，因此能得到持续的数据，然后根据数据绘制音波图)
  state.drawRecordId = requestAnimationFrame(drawRecordColu)
  if (state.recorder) {
    // 实时获取音频大小数据
    const dataArray = state.recorder.getRecordAnalyseData()
    const transit: number[][] = []
    splitArr([...dataArray], transit, 32)

    const rstArr: number[] = []
    for (let i = 0; i < transit.length; i++)
      rstArr.push(Math.max(...transit[i]))

    drawColuList.value = []
    for (let i = 0; i < rstArr.length; i++) {
      if (i >= 9)
        break
      // var v = rstArr[i] / 128.0;
      // var h = v * state.waveCanvas.height / 3;
      // drawColuList.value.push(h)
      // 根据数值大小，设置音波柱状的高度
      let waveH = 10
      const newDb = rstArr[i]
      if (i < 4)
        waveH = newDb - ((5 - i) * 15)
      else if (i === 4)
        waveH = newDb - 3 * 15
      else if (i >= 5)
        waveH = newDb - ((i - 3) * 15)
      drawColuList.value.push(waveH)
    }
    // console.log(drawColuList.value)
    // this.$forceUpdate()

    // 静音检测逻辑
    checkSilence(rstArr)
  }
}

// 静音检测逻辑方法
function checkSilence(rstArr) {
  const currentTime = Date.now()
  const hasLoudSound = rstArr.some(db => db >= 150)

  if (hasLoudSound) {
    state.talkingDetected = true
    state.silenceStartTime = null // 重置静音开始时间
    if (!state.talkingStartTime)
      state.talkingStartTime = currentTime
  }
  else if (!state.silenceStartTime) {
    // if (state.talkingStartTime) {
    //   state.talkingDuration = currentTime - state.talkingStartTime// 记录说话间隔时长
    //   state.talkingStartTime = null
    // }
    state.silenceStartTime = currentTime // 首次检测到静音，记录开始时间
  }

  // 检测静音条件
  if (state.silenceStartTime && state.needCheckSilence) {
    const silenceDuration = currentTime - state.silenceStartTime// 静音时长，ms
    if (state.talkingStartTime && beginRecoding.value && (state.talkingDetected && silenceDuration > state.silenceDurationThresholdAfterTalk)) { // 有人说话，且静音超过1500ms
      state.needCheckSilence = false
      // 结束录音
      if (state.drawRecordId !== null)
        cancelAnimationFrame(state.drawRecordId)
      // 停止drawRecordColu的调用
      // console.log(`silenceDuration > 1.5: ${silenceDuration}`)
      state.talkingDuration = currentTime - state.talkingStartTime - state.silenceDurationThresholdAfterTalk // 说话时长
      // console.log(`talkingDuration: ${state.talkingDuration}`)
      // if (state.talkingDuration > state.talkDurationThreshold) { // 说话时长大于1500ms
      state.needSubmit = true
      // }
      toggleRecording()// 结束录音，且提交
      // 清理逻辑
      cleanupAfterRecording()
    }
    else if (beginRecoding.value && !state.talkingDetected && silenceDuration > state.silenceDurationThreshold) { // 没人说话，且静音超过5000ms
      state.needCheckSilence = false
      // console.log(`beginRecoding.value: ${beginRecoding.value}`)
      // console.log(`silenceDuration > 5: ${silenceDuration}`)
      toggleRecording()// 结束录音，不提交
      cleanupAfterRecording()
    }
  }
}

// 清理逻辑的实现
function cleanupAfterRecording() {
  state.talkingDetected = false
  state.silenceStartTime = null
  state.talkingStartTime = null
  state.talkingDuration = null
  drawColuList.value = [] // 假设这是存储音波高度的数组，清空它
  state.needSubmit = false
}

// 拆分数组
function splitArr(arr, rst, idx) {
  if (!arr || arr.length === 0)
    return

  rst.push(arr.splice(0, idx || 32))
  splitArr(arr, rst, 32)
}

// 销毁实例
// function beforeDestroy() {
//   console.log('beforeDestroy')
//   destroyRecorder()
// }

function handleVisibilityChange() {
  // console.log('handleVisibilityChange')
  if (document.hidden) {
    hideAudioInputComponent()
    isAudioInput.value = false
    destroyRecorder()
  }
  else {
    // 页面再次可见时的逻辑
  }
}

/**  Audio Input */

// 子组件AudioEnter调用此方法，结束录音，并上传音频文件或者继续录音用户的说话
function closeAudio(audioBlob: Blob) {
  // console.log('closeAudioInput')
  hideAudioInputComponent()
  if (audioBlob === null) {
    if (isAudioInput.value) { // 如果开启了语音输入
      setTimeout(() => {
        // startAudioInput()
        startRecord()
      }, 500)
    } // 延迟1秒
    // return
  }
  else { handleAudioInput(audioBlob) }
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
  // console.log('start handleAudioInput')
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
    whisperApiBaseUrl = `${reverseProxy}/transcribe/transcribe`
  }
  // console.log(whisperApiBaseUrl)
  if (businessType === ENGLISH_CORNER)// 9001是英语角
    whisperApiBaseUrl = `${whisperApiBaseUrl}_en/`// 此处必须有斜线结尾
  else
    whisperApiBaseUrl = `${whisperApiBaseUrl}/`
  try {
    const response = await fetch(whisperApiBaseUrl, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    })

    if (!response.ok)
      throw new Error(`服务器响应错误：${response.status}`)

    const result = await response.json()// 如果是json：response.json()
    const text = result.text
    // console.log(result)

    if (businessType !== ENGLISH_CORNER && (text.includes('停止对话') || text.includes('停止会话') || text.includes('结束会话') || text.includes('结束对话') || text.includes('再见') || text.includes('谢谢'))) {
      // hideAudioInputComponent()
      stopAudioInput()
    }
    else if (text.includes('打赏支持明镜与点点栏目') || text.includes('Thanks for watching!') || text.includes('使用简体中文') || text.includes('用简单的手机可以使用')) { // 如果语音转写的结果是这种莫名其妙的字，则继续监听语音
      // startAudioInput()
      startRecord()
    }
    else {
      prompt.value = result.text // 更新 prompt 的值
      handleSubmit()// 自动提交转写后的内容
    }
    // loadingBar.finish() // 完成后隐藏加载条
  }
  catch (error) {
    isAudioInput.value = false // 设置为未开启语音输入
    console.error('转写失败:', error)
  }
  finally {
    isSpinning.value = false // 加载结束，隐藏全局加载状态
  }
}
// 隐藏语音对话组件
function hideAudioInputComponent() {
  // console.log('hideAudioInputComponent')
  showAudioInputComponent.value = false
  // isAudioInput.value = false
  // nextTick(() => {
  //   if (audioEnterRef.value)
  //     audioEnterRef.value.hide()
  // })
  // nextTick(() => {
  //   console.log(showAudioInputComponent.value)
  // })

  // if (audioEnterRef.value) {
  //   nextTick(() => {
  //     if (audioEnterRef.value)
  //       audioEnterRef.value.destroyRecorder()
  //     showAudioInputComponent.value = false
  //   })
  // }
}
// 开始语音对话
// function startAudioInput() {
//   // console.log('startAudioInput')
//   // if (!showAudioInputComponent.value)
//   showAudioInputComponent.value = true
//   isAudioInput.value = true
// }

// 子组件开始录音
function startRecord() {
  showAudioInputComponent.value = true
  isAudioInput.value = true
  startRecorder()
  // nextTick(() => {
  //   if (audioEnterRef.value)
  //     audioEnterRef.value.startRecorder()
  // })
}

// 停止语音对话，销毁录音组件
function stopAudioInput() {
  console.log('stopAudioInput')
  // console.log(audioEnterRef.value)
  // if (audioEnterRef.value) {
  //   nextTick(() => {
  //     // console.log(audioEnterRef.value)
  //     if (audioEnterRef.value)
  //       audioEnterRef.value.destroyRecorder()
  //   })
  // }
  hideAudioInputComponent()
  isAudioInput.value = false
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
  if (businessType === STT)
    fileInput.accept = '.mp3,.wav'
  else if (businessType === FILE_SUMMARY)
    fileInput.accept = '.doc,.docx,.pdf,.xls,.xlsx'
  // fileInput.accept = 'audio/*'
  fileInput.onchange = (event) => {
    if (event.target instanceof HTMLInputElement)
      handleUploadAudio(event.target.files)
  }
  fileInput.click()
}

// 上传音频或文件后执行转写或总结
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
      onConversation(uploadedFileName)// 把文件名作为filePath传给后台
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

// Modify enqueueAudio to accept an index
let audioBlobQueue: Blob[] = []// 要播放音频的队列
let textQueue: string[] = []// 音频对应的文字的队列
let currentIndex = 0 // 跟踪当前处理的音频索引
const queueLength = ref(100)// 要播放的队列长度，因为要播放的队列长度是未知的，先设置为100
async function enqueueAudio(message, index) {
  // console.log(`${index} ${message} ${isPlaying.value}`)
  const urlRegex = /https?:\/\/[a-zA-Z0-9-._~:/?#[\]@!$&'()*+,;=]+/g // 语音播报不播报网址
  const params = {
    input: message.replace(/\*{6}/g, '').replace(urlRegex, ''), // 去掉您可能还想问的问题中的******
    voice: businessType === ENGLISH_CORNER ? 'en-US-AriaNeural' : 'zh-CN-XiaoxiaoNeural',
  }
  const audioBlob = await fetchAndConvertToAudio(params)
  audioBlobQueue[index] = audioBlob
  textQueue[index] = message
  // console.log(`${index} ${queueFinished.value} ${isPlaying.value}`)

  // If state is the first item and nothing is playing, start playback
  if (index === 0) {
    currentIndex = 0
    // queueLength.value = 100
    // console.log(222)
    if (audioElement.value !== null) { // 先停止播放之前有可能正在播放的
      audioElement.value.pause()
      setTimeout(() => {
        playNextAudio()
      }, 100)
    }
  }
}

function updateQueueLength(newLength) {
  queueLength.value = newLength // 更新queueLength
}

async function playNextAudio() {
  if (currentIndex < queueLength.value) {
    isPlaying.value = true
    const index = currentIndex++
    while (audioBlobQueue[index] === undefined) {
    // console.log(`wait: ${index} of ${queueLength.value}`)
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const audioBlob = audioBlobQueue[index]
    const nowText = textQueue[index]
    const audioUrl = URL.createObjectURL(audioBlob)
    if (audioElement.value !== null) {
      audioElement.value.src = audioUrl

      audioElement.value.play().then(() => {
        if (audioElement.value !== null) {
          audioElement.value.onended = () => {
            // isPlaying.value = false
            // console.log(`next id is: ${currentIndex} of ${queueLength.value}`)
            if (nowText.endsWith('See you!') || nowText.endsWith('[See you!]'))
              stopAudioInput()

            else
              playNextAudio() // 尝试播放下一个音频片段
          }
        }
      }).catch((error) => {
        console.error('Auto-play failed', error)
        // isPlaying.value = false
        playNextAudio()
      })
    }
  }
  else {
    // 如果没有更多音频并且队列已完成，重置状态
    isPlaying.value = false
    // startAudioEnterRecorder()// 子组件重新开始监听
    if (isAudioInput.value) { // 如果开启了语音输入，子组件开始录音
      // startAudioInput()
      startRecord()
    }
  }
}

const punctuationRegex = businessType === ENGLISH_CORNER ? /[!！,，。;；?？\n]/ : /[!！，。;；?？\n]/ // 英文的句号有可能用在小数里,英文的逗号有可能用在科学计数里
const punctuationRegexOnly = /^[!！,，。;；?？\n]+$/ // 英文的句号有可能用在小数里,英文的逗号有可能用在科学计数里
// 截取到最后一个标点符号
function extractLastPunctuation(str) {
  // console.log(`${str}`)
  const matches = [...str.matchAll(/[!！，.。;；?？\n]/g)]
  if (matches.length > 0) {
    // 获取最后一个匹配项
    const lastMatch = matches[matches.length - 1]
    // 返回最后一个标点符号及其之前的内容
    const abc = str.substring(0, lastMatch.index + lastMatch[0].length)
    return abc
  }
  else {
    // 如果没有找到匹配项，返回原字符串
    return str
  }
}
// filePath就是上传的文件(音频、文件)在服务器的绝对路径，如果从输入框提交，filePath为空
async function onConversation(filePath: string) {
  let message = prompt.value
  // const postMessage = `${message}**##**${filePath}**##**`
  const postMessage = filePath === '' ? message : `${message}**##**${filePath}**##**`
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
    +uuid, // +表示将其后的变量转换成一个数字
    {
      dateTime: new Date().toLocaleString(),
      text: businessType === STT ? '转写中' : businessType === FILE_SUMMARY ? '总结中' : businessType === ENGLISH_CORNER ? 'Thinking' : '思考中',
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
      // console.log(message)
      // console.log(options)
      // const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      // let businessType = 0
      // if (undefined !== currentHistory)
      //   businessType = currentHistory.businessType
      // console.log('--------------0')
      // let needTts = false
      let previousText = ''
      let queueIndex = 0
      // currentIndex = 0
      // queueFinished.value = false
      queueLength.value = 100
      audioBlobQueue = []
      textQueue = []
      await fetchChatAPIProcess<Chat.ConversationResponse>({
        prompt: postMessage,
        options,
        signal: controller.signal,
        businessType, // 自己加的参数，配置文件中每个模型对应的key
        // needTts,
        // chatId: +uuid,
        systemMessage: (currentModel && currentModel.systemMessage) ? currentModel.systemMessage : '', // 自己加的参数，配置文件中每个模型对应的系统提示词
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

            let input = data.text.substring(previousText.length)
            // console.log(data)
            // console.log(input)
            const isStop = data.detail.choices[0].finish_reason === 'stop'
            if ((playAudio.value && input && input !== '' && punctuationRegex.test(input) && !punctuationRegexOnly.test(input)) || isStop) { // 是否包含需要断句的标点符号
              let isEnqueueAudio = false
              if (!punctuationRegexOnly.test(input)) { // 如果不全是标点符号
                if (isStop) { // 最后一行了 TODO 如果最后一句只有标点符号，需要再优化
                  isEnqueueAudio = true
                  updateQueueLength(queueIndex + 1)
                }
                else if (punctuationRegex.test(input)) { // 如果存在标点符号
                  input = extractLastPunctuation(input)// 取到最后一个断句的标点符号
                  isEnqueueAudio = true
                }
                if (isEnqueueAudio) {
                  previousText = previousText + input
                  // console.log(`${queueIndex} ${previousText} ${isPlaying.value}`)
                  enqueueAudio(input.replace(/#/g, ''), queueIndex++)
                }
              }
              else { // glm-4以及有的模型,stop的时候input为空,需要设置播放列表的长度
                if (isStop) { // 最后一行了
                  updateQueueLength(queueIndex)
                }
              }
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
      // markQueueAsFinished()
      updateChatSome(+uuid, dataSources.value.length - 1, { loading: false })
      if (!playAudio.value && isAudioInput.value) { // 开启语音对话的情况下播放完音频会自动开始录音
        setTimeout(() => {
          startRecord()
          // startAudioInput()
        }, 1000)
      }
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

    console.log(errorMessage)
    hideAudioInputComponent()
  }
  finally {
    loading.value = false
    addClickOnRelatedQuestion() // 给你可能想问的问题增加点击事件
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
      console.log(message)
      // const currentHistory = chatStore.history.find(entry => entry.uuid === chatStore.active)
      // let businessType = 0
      // if (undefined !== currentHistory)
      //   businessType = currentHistory.businessType
      let previousText = ''
      let queueIndex = 0
      // currentIndex = 0
      // queueFinished.value = false
      queueLength.value = 100
      audioBlobQueue = []
      textQueue = []
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
            // console.log(data)

            // 实时语音播报
            let input = data.text.substring(previousText.length)
            const isStop = data.detail.choices[0].finish_reason === 'stop'
            if ((playAudio.value && input && input !== '' && punctuationRegex.test(input) && !punctuationRegexOnly.test(input)) || isStop) { // 是否包含需要断句的标点符号
              let isEnqueueAudio = false
              if (!punctuationRegexOnly.test(input)) { // 如果不全是标点符号
                if (isStop) { // 最后一行了 TODO 如果最后一句只有标点符号，需要再优化
                  isEnqueueAudio = true
                  updateQueueLength(queueIndex + 1)
                }
                else if (punctuationRegex.test(input)) { // 如果存在标点符号
                  input = extractLastPunctuation(input)// 取到最后一个断句的标点符号
                  isEnqueueAudio = true
                }
                if (isEnqueueAudio) {
                  previousText = previousText + input
                  // console.log(`${queueIndex} ${previousText} ${isPlaying.value}`)
                  enqueueAudio(input.replace(/#/g, ''), queueIndex++)
                }
              }
              else { // glm-4以及有的模型,stop的时候input为空,需要设置播放列表的长度
                if (isStop) { // 最后一行了
                  updateQueueLength(queueIndex)
                }
              }
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
            // if (playAudio && input && input !== '') {
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
      // markQueueAsFinished()
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
    stopAudioInput() // TODO 如果开启了语音对话，是不是也应该播放点什么
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
    // 停止播放
    if (audioElement.value)
      audioElement.value.pause()
  }
}

// 给所有您可能还想问的链接增加事件
function addClickOnRelatedQuestion() {
  document.querySelectorAll('.markdown-body a[href="#"]').forEach((link) => { // 有时候LLM不会将title设置为******，此时选择href=#
    // 移除之前可能添加的监听器，以防它已经被添加
    link.removeEventListener('click', handleClickRelatedQuestionEvent)
    // 添加新的事件监听器
    link.addEventListener('click', handleClickRelatedQuestionEvent)
  })
}

// 点击您可能还想问的问题链接的事件
function handleClickRelatedQuestionEvent(event) {
  event.preventDefault()
  // 调用 handleAffixClick 函数，传递链接的文本内容
  if (event.target && event.target instanceof HTMLElement)
    handleRelatedQuestionClick(event.target.textContent || event.target.innerText)
}

// 把您可能想问的问题填入输入框，并提交
function handleRelatedQuestionClick(item) {
  // console.log(`onclick ${item}`)
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
    classes = ['sticky', 'left-0', 'bottom-0', 'right-0', 'p-0', 'pb-3', 'pr-1', 'overflow-hidden']
  return classes
})

function handleScroll() {
  addClickOnRelatedQuestion()
}

onMounted(() => {
  scrollToBottom()
  if (inputRef.value && !isMobile.value)
    inputRef.value?.focus()
  fetchConfig()
  document.addEventListener('visibilitychange', handleVisibilityChange)// 增加页面可见和不可见的事件，不可见的场景：浏览器被切换到后台，不在当前显示桌面
  // document.addEventListener('DOMContentLoaded', (event) => {
  addClickOnRelatedQuestion() // 给你可能想问的问题增加点击事件
  window.addEventListener('scroll', handleScroll)
  // })
})

onUnmounted(() => {
  if (loading.value)
    controller.abort()
  document.removeEventListener('visibilitychange', handleVisibilityChange)
  destroyRecorder()
})

function togglePlay() {
  if (!audioElement.value)
    return
  if (audioElement.value.paused) {
    if (audioElement.value.src)
      audioElement.value.play()
  }
  else { // 如果正在播放
    audioElement.value.pause() // 停止播放
    // 如果开启了语音输入
    if (isAudioInput.value) { // 如果开启了语音输入
      startRecord()
    } // 延迟1秒
  }
}

// 子组件重新开始监听
// function startAudioEnterRecorder() {
//   showAudioInputComponent.value = true
//   nextTick(() => {
//     setTimeout(() => {
//       // 确保组件已经挂载
//       if (audioEnterRef.value)
//         (audioEnterRef.value as any).toggleRecording()
//         // audioEnterRef.value.toggleRecording()
//       else
//         console.log('组件尚未挂载或audioEnterRef不存在')
//     }, 1000) // 延迟1秒
//   })
// }

// const handleEnded = () => {
//   isPlaying.value = false
// }
</script>

<template>
  <Suspense>
    <div class="flex flex-col w-full h-full">
      <template v-if="isSpinning">
        <NSpin :show="isSpinning" class="global-spin">
          <template #description>
            <text v-if="businessType === ENGLISH_CORNER">
              Wait a moment.
            </text>
            <text v-else>
              请稍后
            </text>
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
            <div v-if="!isMobile" class="flex items-center justify-center mt-4 text-center text-neutral-300">
              <!-- <SvgIcon icon="fluent:brain-circuit-24-filled" class="mr-2 text-3xl" /> -->
              <span>{{ currentBusinessTypeName }}</span>
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
          <template v-if="!isMobile && currentModel && currentModel.faqs && currentModel.faqs.length > 0">
            <div class="flex items-center justify-between space-x-2" style="margin-bottom: 8px;">
              <NGrid x-gap="12" :cols="4">
                <NGi
                  v-for="(item, index) of currentModel.faqs" :key="index" class="affix"
                  :class="{ 'hovered-grid': activeIndex === index }"
                  @click="handleRelatedQuestionClick(item)"
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
          <div class="flex items-center justify-between">
            <HoverButton v-if="!isMobile && (businessType === STT || businessType === FILE_SUMMARY)" :title="businessType === STT ? '音频转写文字' : businessType === FILE_SUMMARY ? '文档总结' : ''" @click="triggerFileInput">
              <span class="text-xl text-[#4f555e] dark:text-white">
                <!-- <SvgIcon :icon="businessType === STT ? 'fe:file-audio' : businessType === FILE_SUMMARY ? 'ic:twotone-upload-file' : ''" /> -->
                <FontAwesomeIcon :icon="businessType === STT ? 'fas fa-file-upload' : businessType === FILE_SUMMARY ? 'fas fa-file-upload' : ''" />
              </span>
            </HoverButton>
            <HoverButton v-if="playAudio && isPlaying" @click="togglePlay">
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
            <HoverButton v-if="businessType !== STT && businessType !== FILE_SUMMARY" title="不携带历史记录" @click="toggleUsingContext">
              <span class="text-xl" :class="{ 'text-[#4b9e5f]': usingContext, 'text-[#a8071a]': !usingContext }">
                <!-- <SvgIcon icon="ri:chat-history-line" /> -->
                <FontAwesomeIcon icon="fas fa-history" />
              </span>
            </HoverButton>
            <HoverButton v-if="businessType !== STT && businessType !== FILE_SUMMARY" :title="isAudioInput ? '当前已启用语音输入' : '当前禁用语音输入'">
              <span v-if="isAudioInput" class="text-xl text-[#4b9e5f]" @click="stopAudioInput">
                <FontAwesomeIcon icon="fas fa-microphone-lines" />
              </span>
              <span v-else class="text-xl text-[#a8071a]" @click="startRecord">
                <FontAwesomeIcon icon="fas fa-microphone-lines-slash" />
              </span>
            </HoverButton>
            <!-- <AudioEnter v-show="showAudioInputComponent" ref="audioEnterRef" @close-audio="closeAudio" @stop-audio-input="stopAudioInput" /> -->
            <NAutoComplete v-model:value="prompt" :options="searchOptions" :render-label="renderOption">
              <template #default="{ handleInput, handleBlur, handleFocus }">
                <NInput
                  ref="inputRef"
                  v-model:value="prompt"
                  type="textarea"
                  :placeholder="placeholder"
                  :autosize="{ minRows: 1, maxRows: isMobile ? 4 : 8 }"
                  :disabled="businessType === STT"
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

  <div v-show="showAudioInputComponent" class="audio-enter">
    <div :show="showAudioInputComponent">
      <div class="audio-pie" @click.stop>
        <!-- 录音时显示音波图和时长 -->
        <div v-if="beginRecoding">
          <div v-if="drawColuList.length > 0" class="audio-pie_audio--osc">
            <div v-for="(item, idx) in drawColuList" :key="idx" class="audio-pie_audio--osc_item" :style="{ height: `${item}px` }" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
  .audio-enter {
    z-index: 999999999;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    z-index: 999999999;
    background-color: rgba(0, 0, 0, 0.5);
    .audio-pie {
      z-index: 999;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;
      .audio-pie_audio--osc {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 157px;
        height: 44px;
        margin: 0 auto;
        .audio-pie_audio--osc_item {
          width: 10px;
          background-color: rgba(109, 212, 0, 1);
          border-radius: 5px;
          &:not(:first-child) {
            margin-left: 5px;
          }
        }
      }
    }
  }
  </style>

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
