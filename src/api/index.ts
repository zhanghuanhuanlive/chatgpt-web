import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { post } from '@/utils/request'
import { useAuthStore, useSettingStore } from '@/store'

export function fetchChatAPI<T = any>(
  prompt: string,
  options?: { conversationId?: string; parentMessageId?: string },
  signal?: GenericAbortSignal,
) {
  console.log(prompt)
  // console.log('-----------------------')
  return post<T>({
    url: '/chat',
    data: { prompt, options },
    signal,
  })
}

export function fetchChatConfig<T = any>() {
  return post<T>({
    url: '/config',
  })
}

export function fetchChatAPIProcess<T = any>(
  params: {
    prompt: string
    options?: { conversationId?: string; parentMessageId?: string }
    signal?: GenericAbortSignal
    businessType: number
    // needTts: boolean
    systemMessage: string
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  // console.log(`needTts: ${params.needTts}`)

  let data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
    businessType: params.businessType,
    // needTts: params.needTts,
  }

  // console.log(params.options)
  const model: string = localStorage.getItem('model') || 'chatglm3-6b'
  const top_p = (model.startsWith('chatglm_') || model.startsWith('glm-4')) ? 0.9 : settingStore.top_p
  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      // systemMessage: settingStore.systemMessage,
      // systemMessage: 'hahaha',
      temperature: settingStore.temperature,
      top_p,
    }
  }
  // console.log(settingStore.systemMessage)// 在页面设置中的提示词
  data.systemMessage = (params.systemMessage !== null && params.systemMessage !== undefined && params.systemMessage !== '') ? params.systemMessage : settingStore.systemMessage
  console.log(data)
  // if (params.)

  // console.log('start request 111')
  // console.log(url)
  // console.log(`post to /chat-process${data}`)
  // if (!params.needTts) {
  return post<T>({
    url: '/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
  // }
  // else {
  //   return post<T>({
  //     url: '/tts-process',
  //     data,
  //     signal: params.signal,
  //   })
  // }
}

// 将文本消息转换为音频Blob
export async function fetchAndConvertToAudio(message) {
  // fetch('/api/tts-process', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ message }),
  // })
  //   .then((response) => {
  //     if (!response.ok)
  //       throw new Error('Failed to fetch audio')
  //     const b = response.blob()
  //     console.log(message)
  //     console.log(b)
  //     return b
  //     // return response.blob() // 将响应体转换为Blob
  //   })
  const response = await fetch('/api/tts-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
  })

  if (!response.ok)
    throw new Error('Failed to fetch audio')

  return await response.blob()
}

// 假设这是一个全局变量或组件内状态，用于追踪 MediaSource 和 SourceBuffer 的引用
// let mediaSourceGlobal
// let sourceBufferGlobal
// let isAudioPlaying = false // 追踪音频是否正在播放

// 将 message 转换为音频流并处理播放逻辑
// export async function fetchAndPlayAudio(audioElement: HTMLAudioElement, message: string): Promise<void> {
//   if (!window.MediaSource || !audioElement) {
//     console.error('MediaSource Extensions is not supported in your browser or audioElement is null.')
//     return
//   }

//   if (!mediaSourceGlobal || audioElement.paused || !isAudioPlaying) {
//     isAudioPlaying = true
//     // 创建一个新的 MediaSource 对象，如果是首次播放或之前的音频已暂停/停止
//     mediaSourceGlobal = new MediaSource()
//     audioElement.src = URL.createObjectURL(mediaSourceGlobal)
//     mediaSourceGlobal.addEventListener('sourceopen', () => appendDataToSourceBuffer(message, true))
//     audioElement.play().catch(error => console.error('Auto-play failed', error))
//   }
//   else {
//     // 如果音频正在播放，只追加数据
//     appendDataToSourceBuffer(message, false)
//   }
// }

// // 向 SourceBuffer 追加数据的方法
// async function appendDataToSourceBuffer(message, isNewSourceBuffer) {
//   if (isNewSourceBuffer)
//     sourceBufferGlobal = mediaSourceGlobal.addSourceBuffer('audio/mpeg')

//   const response = await fetch('/api/tts-process', {
//     method: 'POST',
//     headers: { 'Content-Type': 'application/json' },
//     body: JSON.stringify({ message }),
//   })

//   if (!response.body)
//     throw new Error('Failed to get readable stream')

//   const reader = response.body.getReader()

//   function push() {
//     reader.read().then(({ done, value }) => {
//       if (done) {
//         if (mediaSourceGlobal.readyState === 'open')
//           mediaSourceGlobal.endOfStream()

//         isAudioPlaying = false // 更新播放状态
//         return
//       }
//       try {
//         if (!sourceBufferGlobal.updating && mediaSourceGlobal.readyState === 'open')
//           sourceBufferGlobal.appendBuffer(value)
//       }
//       catch (error) {
//         console.error('Error appending buffer', error)
//         // 根据需要在这里添加错误处理逻辑
//       }
//       sourceBufferGlobal.onupdateend = () => {
//         sourceBufferGlobal.onupdateend = null
//         push()
//       }
//     }).catch((error) => {
//       console.error('Error reading audio stream', error)
//     })
//   }

//   // 如果是新的 SourceBuffer，设置更新结束的监听器来处理数据流
//   if (isNewSourceBuffer) {
//     sourceBufferGlobal.addEventListener('updateend', () => {
//       if (!sourceBufferGlobal.updating && mediaSourceGlobal.readyState === 'open')
//         push()
//     })
//   }
//   else {
//     push() // 直接推送数据，如果已经有监听器在处理
//   }
// }

// export async function fetchAndPlayAudio(audioElement: HTMLAudioElement, message: string): Promise<void> {
//   if (!window.MediaSource) {
//     console.error('MediaSource Extensions is not supported in your browser.')
//     return
//   }

//   const mediaSource = new MediaSource()
//   audioElement.src = URL.createObjectURL(mediaSource)
//   mediaSource.addEventListener('sourceopen', async () => {
//     try {
//       const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg') // 根据您的音频格式调整
//       const response = await fetch('/api/tts-process', {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify({ message }), // 调整为您的请求体
//       })

//       if (!response.body)
//         throw new Error('Failed to get readable stream')

//       const reader = response.body.getReader()
//       // 尝试在这里调用 play，以便在数据开始加载时准备播放
//       // 注意：可能需要用户交互才能成功播放
//       audioElement.play().catch(error => console.error('Auto-play failed', error))

//       function push() {
//         reader.read().then(({ done, value }) => {
//           if (done) {
//             if (mediaSource.readyState === 'open')
//               mediaSource.endOfStream()

//             return
//           }
//           try {
//             if (!sourceBuffer.updating && mediaSource.readyState === 'open')
//               sourceBuffer.appendBuffer(value)
//           }
//           catch (error) {
//             console.error('Error appending buffer', error)
//             // 根据需要在这里添加错误处理逻辑
//           }
//           sourceBuffer.onupdateend = () => {
//             sourceBuffer.onupdateend = null
//             push()
//           }
//         }).catch((error) => {
//           console.error('Error reading audio stream', error)
//         })
//       }

//       push()
//     }
//     catch (error) {
//       console.error('Error fetching audio stream:', error)
//     }
//   })
// }

export function fetchSession<T>() {
  return post<T>({
    url: '/session',
  })
}

export function fetchVerify<T>(token: string) {
  return post<T>({
    url: '/verify',
    data: { token },
  })
}
