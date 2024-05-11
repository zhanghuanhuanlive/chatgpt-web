import type { AxiosProgressEvent, GenericAbortSignal } from 'axios'
import { post } from '@/utils/request'
import { useAuthStore, useSettingStore } from '@/store'

interface WebSocketUrlResponse {
  appId: string
  wssUrl: string // 假设返回的 JSON 包含一个 wssUrl 字段
}

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
    businessType: string
    // needTts: boolean
    // chatId: number
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
  // const model: string = localStorage.getItem('model') || 'chatglm3-6b'
  // const top_p = (model.startsWith('chatglm_') || model.startsWith('glm-4')) ? 0.9 : settingStore.top_p
  if (authStore.isChatGPTAPI) {
    data = {
      ...data,
      // systemMessage: settingStore.systemMessage,
      // systemMessage: 'hahaha',
      temperature: settingStore.temperature,
      top_p: settingStore.top_p,
      // top_p,
    }
  }
  // console.log(settingStore.systemMessage)// 在页面设置中的提示词
  data.systemMessage = (params.systemMessage !== null && params.systemMessage !== undefined && params.systemMessage !== '') ? params.systemMessage : settingStore.systemMessage
  // console.log(data)
  // if (params.)

  return post<T>({
    url: '/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
  })
}

export async function fetchWebSocketUrl(): Promise<WebSocketUrlResponse> {
  const response = await fetch('/api/getXunfeiWebSocketUrl', {
    method: 'POST', // 如果不需要传递数据，通常使用 GET 方法
    headers: { 'Content-Type': 'application/json' },
  })

  if (!response.ok)
    throw new Error('Failed to fetch WebSocket URL')

  const data: WebSocketUrlResponse = await response.json()
  // console.log(data)
  return data // 直接返回解析后的 JSON 对象
}

// 将文本消息转换为音频Blob
// params: input、voice
export async function fetchAndConvertToAudio(params) {
  const response = await fetch('/api/tts-process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })

  if (!response.ok)
    throw new Error('Failed to fetch audio')

  return await response.blob()
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
