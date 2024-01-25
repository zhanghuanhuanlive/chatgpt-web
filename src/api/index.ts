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

  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      // systemMessage: settingStore.systemMessage,
      // systemMessage: 'hahaha',
      temperature: settingStore.temperature,
      top_p: settingStore.top_p,
    }
  }
  data.systemMessage = (params.systemMessage !== null && params.systemMessage !== undefined && params.systemMessage !== '') ? params.systemMessage : settingStore.systemMessage
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

export async function fetchAndPlayAudio(audioElement: HTMLAudioElement, message: string): Promise<void> {
  if (!window.MediaSource) {
    console.error('MediaSource Extensions is not supported in your browser.')
    return
  }

  const mediaSource = new MediaSource()
  audioElement.src = URL.createObjectURL(mediaSource)
  mediaSource.addEventListener('sourceopen', async () => {
    try {
      const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg') // 根据您的音频格式调整
      const response = await fetch('/api/tts-process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }), // 调整为您的请求体
      })

      if (!response.body)
        throw new Error('Failed to get readable stream')

      const reader = response.body.getReader()
      // 尝试在这里调用 play，以便在数据开始加载时准备播放
      // 注意：可能需要用户交互才能成功播放
      audioElement.play().catch(error => console.error('Auto-play failed', error))

      function push() {
        reader.read().then(({ done, value }) => {
          if (done) {
            if (mediaSource.readyState === 'open')
              mediaSource.endOfStream()

            return
          }
          try {
            if (!sourceBuffer.updating && mediaSource.readyState === 'open')
              sourceBuffer.appendBuffer(value)
          }
          catch (error) {
            console.error('Error appending buffer', error)
            // 根据需要在这里添加错误处理逻辑
          }
          sourceBuffer.onupdateend = () => {
            sourceBuffer.onupdateend = null
            push()
          }
        }).catch((error) => {
          console.error('Error reading audio stream', error)
        })
      }

      push()
    }
    catch (error) {
      console.error('Error fetching audio stream:', error)
    }
  })
}

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
