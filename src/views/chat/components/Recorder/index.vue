<script setup lang='ts'>
import { onMounted, onUnmounted, ref } from 'vue'
import Recorder from 'recorder-core'
import { fetchWebSocketUrl } from '@/api'
import 'recorder-core/src/engine/mp3'
import 'recorder-core/src/engine/wav'
import 'recorder-core/src/engine/pcm'
import 'recorder-core/src/engine/mp3-engine'
import 'recorder-core/src/extensions/frequency.histogram.view'
// import 'recorder-core/src/extensions/waveview'
import 'recorder-core/src/extensions/lib.fft'

// const duration = 0
// const durationTxt = '0'
// const powerLevel = 0// 音量
const props = defineProps<Props>()
const emit = defineEmits<Emit>()
let type = 'wav'
let fullTranscription = ''
const bitRate = 16
const sampleRate = 16000
const isShowWave = ref<boolean>(true)
const mockAudioBuffer = [0, 2816, 5549, 8117, 10427, 12348, 13852, 14919, 15534, 15694, 15399, 14666,
  13514, 11979, 10102, 7943, 5576, 3053, 452, -2153, -4728, -7221, -9589, -11794,
  -13790, -15439, -16705, -17561, -17989, -17980, -17529, -16642, -15333, -13626, -11555,
  -9187, -6570, -3785, -877, 2046, 4929, 7741, 10427, 12837, 14919, 16524, 17614,
  18157, 18137, 17550, 16405]

let ws: WebSocket
let appId = ''
interface Props {
  whisperModel: String
  // activeIndex: number
}
interface Emit {
  (ev: 'uploadAudio', blob: Blob): void
  (ev: 'stopAudioInput'): void
  (ev: 'handleRelatedQuestionClick', fullTranscription: string): void
}

// 讯飞相关参数
// 公共参数
interface CommonParams {
  app_id: string
}

// 业务参数
interface BusinessParams {
  language: string
  domain: string
  accent: string
  vad_eos?: number
  dwa?: string
  pd?: string
  ptt?: number
  rlang?: string
  vinfo?: number
  nunum?: number
  speex_size?: number
  nbest?: number
  wbest?: number
}

// 数据流参数
interface DataParams {
  status: number
  format?: string
  encoding?: string
  audio?: string
}

// 完整请求参数
interface XunfeiRequestParams {
  common?: CommonParams
  business?: BusinessParams
  data: DataParams
}

// 监测静音相关
const powerLevelThreshold = 15 // 超过这个设定的阈值代表有人在说话
let silenceStartTime: number // 静音开始的时间
const silenceDurationThresholdAfterTalk = 3000 // 单位ms，静音时长的阈值，有人说过话以后，超过这个时长，就会停止录音
const silenceDurationThreshold = 10000 // 静音时长的阈值，没人说话的情况下超过这个值，就会停止录音
// let talkDurationThreshold = 500 // 说话时长的阈值，超过这个值，才会提交进行撰写
let talkingStartTime: number // 监测到说话开始的时间
// let talkingDuration = null // 说话的时长
let talkingDetected = false // 是否检测到有人说话
// let needSubmit = false // 是否需要提交录音数据
// const needCheckSlicence = false // 是否需要监测静音

const frequencyHistogramViewSetting = {
  elem: '.ctrlProcessWave', // 自动显示到dom，并以此dom大小为显示大小
  // 或者配置显示大小，手动把frequencyObj.elem显示到别的地方
  width: 0, // 显示宽度
  height: 0, // 显示高度
  // H5环境以上配置二选一

  // compatibleCanvas: CanvasObject, // 提供一个兼容H5的canvas对象，需支持getContext("2d")，支持设置width、height，支持drawImage(canvas,...)
  // width: 0, // canvas显示宽度
  // height: 0, // canvas显示高度
  // 非H5环境使用以上配置，比如微信小程序、uni-app

  scale: 2, // 缩放系数，应为正整数，使用2(3? no!)倍宽高进行绘制，避免移动端绘制模糊

  fps: 20, // 绘制帧率，不可过高

  lineCount: 30, // 直方图柱子数量，数量的多少对性能影响不大，密集运算集中在FFT算法中
  widthRatio: 0.6, // 柱子线条宽度占比，为所有柱子占用整个视图宽度的比例，剩下的空白区域均匀插入柱子中间；默认值也基本相当于一根柱子占0.6，一根空白占0.4；设为1不留空白，当视图不足容下所有柱子时也不留空白
  spaceWidth: 0, // 柱子间空白固定基础宽度，柱子宽度自适应，当不为0时widthRatio无效，当视图不足容下所有柱子时将不会留空白，允许为负数，让柱子发生重叠
  minHeight: 0, // 柱子保留基础高度，position不为±1时应该保留点高度
  position: 0, // 绘制位置，取值-1到1，-1为最底下，0为中间，1为最顶上，小数为百分比
  mirrorEnable: true, // 是否启用镜像，如果启用，视图宽度会分成左右两块，右边这块进行绘制，左边这块进行镜像（以中间这根柱子的中心进行镜像）

  stripeEnable: false, // 是否启用柱子顶上的峰值小横条，position不是-1时应当关闭，否则会很丑
  stripeHeight: 3, // 峰值小横条基础高度
  stripeMargin: 6, // 峰值小横条和柱子保持的基础距离

  fallDuration: 1000, // 柱子从最顶上下降到最底部最长时间ms
  stripeFallDuration: 3500, // 峰值小横条从最顶上下降到底部最长时间ms

  // 柱子颜色配置：[位置，css颜色，...] 位置: 取值0.0-1.0之间
  linear: [0, 'rgba(0,187,17,1)', 0.5, 'rgba(255,215,0,1)', 1, 'rgba(255,102,0,1)'],
  // 峰值小横条渐变颜色配置，取值格式和linear一致，留空为柱子的渐变颜色
  stripeLinear: null,

  shadowBlur: 0, // 柱子阴影基础大小，设为0不显示阴影，如果柱子数量太多时请勿开启，非常影响性能
  shadowColor: '#bbb', // 柱子阴影颜色
  stripeShadowBlur: -1, // 峰值小横条阴影基础大小，设为0不显示阴影，-1为柱子的大小，如果柱子数量太多时请勿开启，非常影响性能
  stripeShadowColor: '', // 峰值小横条阴影颜色，留空为柱子的阴影颜色

  fullFreq: false, // 是否要绘制所有频率；默认false主要绘制5khz以下的频率，高频部分占比很少，此时不同的采样率对频谱显示几乎没有影响；设为true后不同采样率下显示的频谱是不一样的，因为 最大频率=采样率/2 会有差异
  // 当发生绘制时会回调此方法，参数为当前绘制的频率数据和采样率，可实现多个直方图同时绘制，只消耗一个input输入和计算时间
  onDraw(frequencyData, sampleRate) {
    // console.log(frequencyData)
  },
}

// const logs = ref([])

let wave: { input: (arg0: any, arg1: any, arg2: any) => void }

// const testSampleRate = 16000
// const bitRate = 16

const SendFrameSize = 3200/** ** 每次发送指定二进制数据长度的数据帧，单位字节，16位pcm取值必须为2的整数倍，8位随意。
16位16khz的pcm 1秒有：16000hz*16位/8比特=32000字节的数据，默认配置3200字节每秒发送大约10次，
讯飞：建议音频流每40ms发送1280字节，发送过快可能导致引擎出错； 2.音频发送间隔超时时间为15秒，超时服务端报错并主动断开连接。
******/

let realTimeSendTryChunks: any[] | null
let realTimeSendTryNumber: number
let transferUploadNumberMax: number
let realTimeSendTryChunk: { index: any } | null

// 重置环境，每次开始录音时必须先调用此方法，清理环境
const RealTimeSendTryReset = function () {
  realTimeSendTryChunks = null
}

async function initWebSocket() {
  try {
    const data = await fetchWebSocketUrl()// 获得讯飞的WebSocket Url
    // console.log(data)
    const wssUrl = data.wssUrl
    appId = data.appId
    // console.log(appId)
    ws = new WebSocket(wssUrl)

    ws.onopen = function () {
      console.log('WebSocket连接已打开')
    // WebSocket连接成功后的逻辑，例如可以通知用户或开始发送数据
    }

    ws.onmessage = function (event) {
      console.log('接收到消息：', event.data)
      // 根据服务器返回的消息进行处理，比如更新UI等
      const response = JSON.parse(event.data)
      if (response.code === 0 && response.data && response.data.result) {
        const results = response.data.result.ws
        const textPieces = results.map(ws => ws.cw.map(cw => cw.w).join(''))
        const newText = textPieces.join('')

        // 根据返回的状态更新完整文本
        if (response.data.status === 0) {
          // 新会话，重置文本
          fullTranscription = newText
        }
        else {
          // 累加到已有文本
          fullTranscription += newText
        }
        if (fullTranscription === '谢谢' || fullTranscription === '再见') {
          fullTranscription = ''
          emit('stopAudioInput')
          return
        }

        emit('handleRelatedQuestionClick', fullTranscription)
        fullTranscription = ''

        // 如果是最后一块结果，可能需要做些额外的事情
        // if (response.data.status === 2)
        //   console.log('Final transcription:', fullTranscription)
        // 可以在这里执行其他操作，例如关闭WebSocket连接或通知用户等
      }
      else {
        console.error('Error receiving transcription:', response.message)
      }
    }

    ws.onerror = function (event) {
      console.error('WebSocket出错:', event)
    // 出错处理逻辑，可以尝试重新连接或通知用户
    }

    ws.onclose = function (event) {
      console.log('WebSocket连接已关闭:', event)
    // 连接关闭后的处理逻辑，例如清理资源或重连
    }
  }
  catch (error) {
    console.error('Error initializing WebSocket:', error)
    // 在这里添加错误处理逻辑，例如显示错误消息，重试连接等
  }
}

function arrayBufferToBase64(buffer) {
  let binary = ''
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength
  for (let i = 0; i < len; i++)
    binary += String.fromCharCode(bytes[i])

  return window.btoa(binary)
}

// =====数据传输函数==========
const TransferUpload = async function (number, blobOrNull, duration, blobRec, isClose) {
  transferUploadNumberMax = Math.max(transferUploadNumberMax, number)
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    console.log('WebSocket未连接或连接已关闭')
    console.log(blobOrNull)
    await initWebSocket()
  }
  if (blobOrNull) {
    const params: XunfeiRequestParams = {
      common: {
        app_id: appId, // 替换为您的 app_id
      },
      business: {
        language: 'zh_cn',
        domain: 'iat', // gov-seat-assistant
        accent: 'mandarin',
        vad_eos: silenceDurationThresholdAfterTalk,
        // dwa: 'wpgs',// 动态修正
      },
      data: {
        status: 0, // 假设这是第一帧音频
        format: 'audio/L16;rate=16000',
        encoding: 'raw',
        audio: arrayBufferToBase64(blobOrNull), // 替换为您的 base64 编码的音频数据
      },
    }

    // 发送Blob二进制数据
    ws.send(JSON.stringify(params))

    // 日志输出，用于调试
    const logMsg = `No.${number < 100 ? (`000${number}`).substr(-3) : number}`
    console.log(`${logMsg} 发送成功`)
  }

  if (isClose) {
    // emit('stopAudioInput')
    const params: XunfeiRequestParams = {
      data: {
        status: 2, // 结束
      },
    }
    const endMessage = JSON.stringify(params)
    ws.send(endMessage)
    console.log('结束消息已发送')

    ws.close() // 如果是结束信号，关闭WebSocket连接
    console.log('WebSocket连接关闭请求已发送')
  }
}

const RealTimeSendTry = function (buffers, bufferSampleRate, isClose) {
  if (realTimeSendTryChunks == null) {
    realTimeSendTryNumber = 0
    transferUploadNumberMax = 0
    realTimeSendTryChunk = null
    realTimeSendTryChunks = []
  }
  // 配置有效性检查
  if (bitRate === 16 && SendFrameSize % 2 === 1) {
    console.log('16位pcm SendFrameSize 必须为2的整数倍', 1)
    return
  }

  let pcm: number[] | Int16Array
  pcm = [] // 允许赋值为 number 数组
  let pcmSampleRate = 0
  if (buffers.length > 0) {
    // 借用SampleData函数进行数据的连续处理，采样率转换是顺带的，得到新的pcm数据
    const chunk = Recorder.SampleData(buffers, bufferSampleRate, sampleRate, realTimeSendTryChunk)

    // 清理已处理完的缓冲数据，释放内存以支持长时间录音，最后完成录音时不能调用stop，因为数据已经被清掉了
    for (let i = realTimeSendTryChunk ? realTimeSendTryChunk.index : 0; i < chunk.index; i++) buffers[i] = null
    realTimeSendTryChunk = chunk// 此时的chunk.data就是原始的音频16位pcm数据（小端LE），直接保存即为16位pcm文件、加个wav头即为wav文件、丢给mp3编码器转一下码即为mp3文件
    pcm = chunk.data
    pcmSampleRate = chunk.sampleRate
    if (pcmSampleRate !== sampleRate)// 除非是onProcess给的bufferSampleRate低于testSampleRate throw new
      Error(`不应该出现pcm采样率${pcmSampleRate}和需要的采样率${sampleRate}不一致`)
  } // 将pcm数据丢进缓冲，凑够一帧发送，缓冲内的数据可能有多帧，循环切分发送
  if (pcm.length > 0)
    realTimeSendTryChunks.push({ pcm, pcmSampleRate })

  // 从缓冲中切出一帧数据
  const chunkSize = SendFrameSize / (bitRate / 8)// 8位时需要的采样数和帧大小一致，16位时采样数为帧大小的一半
  pcm = new Int16Array(chunkSize)// 也允许赋值为 Int16Array
  pcmSampleRate = 0
  let pcmOK = false
  let pcmLen = 0
  let shouldBreak = false // 控制是否需要退出外层循环的变量

  for (let i1 = 0; i1 < realTimeSendTryChunks.length; i1++) {
    const chunk = realTimeSendTryChunks[i1]
    pcmSampleRate = chunk.pcmSampleRate

    for (let i2 = chunk.offset || 0; i2 < chunk.pcm.length; i2++) {
      pcm[pcmLen] = chunk.pcm[i2]
      pcmLen++

      // 满一帧了，清除已消费掉的缓冲
      if (pcmLen === chunkSize) {
        pcmOK = true
        chunk.offset = i2 + 1
        realTimeSendTryChunks.splice(0, i1 + 1) // 直接删除至当前i1位置的元素

        shouldBreak = true // 设置退出标志
        break
      }
    }

    if (shouldBreak)
      break // 如果设置了退出标志，则退出外层循环
  }

  // 缓冲的数据不够一帧时，不发送 或者 是结束了
  if (!pcmOK) {
    if (isClose) {
      const number = ++realTimeSendTryNumber
      TransferUpload(number, null, 0, null, isClose)
    }
    return
  }
  // pcm = [2650, 4099, 517, 8463, -5317, 0, 0, 0, 0, 0]

  // 16位pcm格式可以不经过mock转码，直接发送new Blob([pcm.buffer],{type:'audio/pcm'}) 但8位的就必须转码，通用起见，均转码处理，pcm转码速度极快
  const pcmArrayBuffer = pcm.buffer
  const duration = (pcm.length / sampleRate) * 1000 // 计算持续时间，单位为毫秒
  TransferUpload(0, pcmArrayBuffer, duration, null, false)
}

// =====pcm文件合并核心函数==========
Recorder.PCMMerge = function (fileBytesList, bitRate, sampleRate, True, False) {
  // 计算所有文件总长度
  let size = 0
  for (let i = 0; i < fileBytesList.length; i++)
    size += fileBytesList[i].byteLength

  // 全部直接拼接到一起
  const fileBytes = new Uint8Array(size)
  let pos = 0
  for (let i = 0; i < fileBytesList.length; i++) {
    const bytes = fileBytesList[i]
    fileBytes.set(bytes, pos)
    pos += bytes.byteLength
  }

  // 计算合并后的总时长
  const duration = Math.round(size * 8 / bitRate / sampleRate * 1000)

  True(fileBytes, duration, { bitRate, sampleRate })
}

// 调用录音
let rec
const recStart = async () => {
  if (props.whisperModel === 'whisper' || props.whisperModel === '') {
    type = 'wav'
  }
  else if (props.whisperModel === 'xunfei') {
    type = 'pcm'
    if (!ws || ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket未连接或连接已关闭')
      await initWebSocket()
    }
  }
  // console.log(type)
  isShowWave.value = true
  // if (rec)
  //   rec.close()
  console.log(`rec: ${rec}`)
  if (!rec) {
    console.log('new Recorder')
    rec = new Recorder({
    // type: 'unknown',
      type,
      bitRate,
      sampleRate,
      onProcess(buffers, powerLevel, duration, sampleRate) {
      // 推入实时处理，因为是unknown格式，buffers和rec.buffers是完全相同的，只需清理buffers就能释放内存。
        checkSilence(powerLevel)
        if (wave)
          wave.input(buffers[buffers.length - 1], powerLevel, sampleRate)
        if (props.whisperModel === 'xunfei')
          RealTimeSendTry(buffers, sampleRate, false)
      },
    })

    Recorder.CLog = function () {}// 不打印Recorder的日志

    // const t = setTimeout(() => {
    //   console.log('无法录音：权限请求被忽略（超时假装手动点击了确认对话框）', 1)
    // }, 8000)
  }

  rec.open(() => { // 打开麦克风授权获得相关资源
    console.log('open')
    rec.start()// 开始录音
    console.log('rec 已start')
    // clearTimeout(t)
  }, (msg, isUserNotAllow) => {
    // clearTimeout(t)
    console.log(`${isUserNotAllow ? 'UserNotAllow，' : ''}无法录音:${msg}`, 1)
  })

  // const interval = setInterval(() => {
  //   console.log('try to start')
  //   if (rec && Recorder.IsOpen) {
  //     clearInterval(interval)
  //     rec.start()// 开始录音
  //     console.log('rec 已start')
  //   }
  // }, 100) // 每100毫秒检查一次

  const interval1 = setInterval(() => { // 没监测到人说话前,先展示音浪
    wave.input(mockAudioBuffer, 5, sampleRate)
    if (talkingDetected)
      clearInterval(interval1)
  }, 100)

  // if (Recorder.WaveView)
  //   wave = Recorder.WaveView(viewSetting) // 创建wave对象，写这里面浏览器妥妥的

  if (props.whisperModel === 'xunfei')
    RealTimeSendTryReset()// 重置环境，开始录音时必须调用一次
  if (Recorder.FrequencyHistogramView)
    wave = Recorder.FrequencyHistogramView(frequencyHistogramViewSetting)// 创建wave对象，写这里面浏览器妥妥的
}

const recClose = () => {
  // isShowWave.value = false
  if (rec) {
    console.log('need close')
    rec.close()// 释放录音资源，当然可以不释放，后面可以连续调用start；但不释放时系统或浏览器会一直提示在录音，最佳操作是录完就close掉
    rec = null
  }
  // Recorder.Destroy()
}

const recStop = (needSubmit: boolean, needClose: boolean) => {
  // isShowWave.value = false
  // 重置静音监测相关参数
  console.log('need Stop')

  if (rec) {
    rec.stop((blob, duration) => {
    // 简单利用URL生成本地文件地址，注意不用了时需要revokeObjectURL，否则霸占内存
    // 此地址只能本地使用，比如赋值给audio.src进行播放，赋值给a.href然后a.click()进行下载（a需提供download="xxx.mp3"属性）
      if ((props.whisperModel === 'whisper' || props.whisperModel === '') && needSubmit) { // 不是讯飞,默认为空的情况下,上传wav
        emit('uploadAudio', blob)
      // 以下代码可以用来测试播放录好的文件
      // const localUrl = (window.URL || webkitURL).createObjectURL(blob)
      // console.log(blob, localUrl, `时长:${duration}ms`)
      // const audio = document.createElement('audio')
      // document.body.prepend(audio)
      // audio.controls = true
      // audio.src = localUrl
      // audio.play()
      }
      // else { emit('stopAudioInput') }

      if (needClose)
        recClose()
    }, (msg) => {
      console.log(`录音失败:${msg}`)
      if (needClose)
        recClose()
    // rec.close()// 可以通过stop方法的第3个参数来自动调用close
    // rec = null
    })

    if (props.whisperModel === 'xunfei')
      RealTimeSendTry([], 0, true)// 最后一次发送
  }
}

// 静音检测逻辑方法
function checkSilence(powerLevel) {
  // console.log(talkingDetected)
  const currentTime = Date.now()
  // const hasLoudSound = rstArr.some(db => db >= 150)

  if (powerLevel > powerLevelThreshold) { // 有人在说话：音量超过阈值
    // console.log(powerLevel)
    talkingDetected = true
    silenceStartTime = 0 // 重置静音开始时间
    if (talkingStartTime === 0)
      talkingStartTime = currentTime
  }
  else if (silenceStartTime === 0) {
    silenceStartTime = currentTime // 首次检测到静音，记录开始时间
  }

  // 检测静音条件
  if (silenceStartTime > 0) {
    const silenceDuration = currentTime - silenceStartTime// 静音时长，ms
    if ((talkingDetected && silenceDuration > silenceDurationThresholdAfterTalk)) { // 有人说话，且静音超过1500ms
      // needCheckSlicence = false
      // 结束录音
      // if (talkingDuration > talkDurationThreshold) { // 说话时长大于1500ms
      // needSubmit = true
      // }
      console.log('有人说话，且静音超过1500ms')
      recStop(true, false)// 结束录音，且提交，且不释放资源
      talkingDetected = false
      silenceStartTime = 0
      talkingStartTime = 0
      // 清理逻辑
      // cleanupAfterRecording()
    }
    else if (!talkingDetected && silenceDuration > silenceDurationThreshold) { // 静音超过阈值，一直都没人说话，关掉录音
      // needCheckSlicence = false
      // console.log(`beginRecoding: ${beginRecoding}`)
      // console.log(`silenceDuration > 5: ${silenceDuration}`)
      console.log('一直都没人说话')
      recStop(false, true)// 结束录音，且不提交，且释放资源
      talkingDetected = false
      silenceStartTime = 0
      talkingStartTime = 0
    }
  }
}

defineExpose({
  recStart,
  recStop,
  recClose,
})

async function handleVisibilityChange() {
  // console.log('handleVisibilityChange')
  if (document.hidden) {
    // console.log('hidden')
  }
  else {
    if (props.whisperModel === 'whisper' || props.whisperModel === '')
      type = 'wav'

    else if (props.whisperModel === 'xunfei')
      type = 'pcm'
      // if (!ws || ws.readyState !== WebSocket.OPEN)
      //   console.log('WebSocket未连接或连接已关闭')
      // initWebSocket()
  }
}

onMounted(async () => {
  document.addEventListener('visibilitychange', handleVisibilityChange)// 增加页面可见和不可见的事件，不可见的场景：浏览器被切换到后台，不在当前显示桌面

  console.log(`onMounted, hasPermission: ${props.whisperModel}`) // 注意这里对 this 的用法在 Composition API 中是不正确的
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', handleVisibilityChange)
})
</script>

<template>
  <div class="container" @click="recClose">
    <!-- <slot name="top" /> -->

    <!-- <div class="mainBox">
      <div class="pd">
        类型：{{ type }}
        <span style="margin:0 20px">
          比特率: <input v-model="bitRate" type="text" style="width:60px"> kbps
        </span>
        采样率: <input v-model="sampleRate" type="text" style="width:60px"> hz
      </div>

      <div class="btns">
        <div>
          <button @click="recStart">
            打开录音,请求权限
          </button>
          <button @click="recClose">
            关闭录音,释放资源
          </button>
        </div>

        <button @click="recStart">
          录制
        </button>
        <button style="margin-right:80px" @click="recStop(false, false)">
          停止
        </button>
      </div>
    </div> -->

    <div v-show="isShowWave" class="container">
      <div style="" class="ctrlProcessWave" />
      <!-- <div style="height:40px;width:300px;display:inline-block;background:#999;position:relative;vertical-align:bottom">
        <div class="ctrlProcessX" style="height:40px;background:#0B1;position:absolute;" :style="{ width: `${powerLevel}%` }" />
        <div class="ctrlProcessT" style="padding-left:50px; line-height:40px; position: relative;">
          {{ `${durationTxt}/${powerLevel}` }}
        </div>
      </div> -->
    </div>
  </div>
</template>

<style>
.container {
  /* z-index: 999999999;
  width: 100%;
  height: 100%;
  background-color: #fff; */
}
.ctrlProcessWave{
  position: absolute;top: 50%;left: 50%; transform: translate(-50%, -50%);
  height:100px;
  width:300px;
}
body{
  /* background-color: #fff; */
  /* word-wrap: break-word; */
  /* background:#f5f5f5 center top no-repeat; */
  /* background-size: auto 680px; */
}
pre{
  /* white-space:pre-wrap; */
}
a{
  /* text-decoration: none;
  color:#06c; */
}
a:hover{
  /* color:#f00; */
}

.main{

  /* max-width:700px;
  margin:0 auto;
  padding-bottom:80px */
}

.mainBox{
  margin-top:12px;
  padding: 12px;
  border-radius: 6px;
  /* background: #fff; */
  /* --border: 1px solid #0b1; */
  /* box-shadow: 2px 2px 3px #aaa; */
}

.btns button{
  display: inline-block;
  cursor: pointer;
  border: none;
  border-radius: 3px;
  background: #0b1;
  color:#fff;
  padding: 0 15px;
  margin:3px 20px 3px 0;
  line-height: 36px;
  height: 36px;
  overflow: hidden;
  vertical-align: middle;
}
.btns button:active{
  background: #0a1;
}
.pd{
  padding:0 0 6px 0;
}
.lb{
  display:inline-block;
  vertical-align: middle;
  background:#00940e;
  color:#fff;
  font-size:14px;
  padding:2px 8px;
  border-radius: 99px;
}
</style>
