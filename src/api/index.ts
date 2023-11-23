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
    systemMessage: string
    onDownloadProgress?: (progressEvent: AxiosProgressEvent) => void },
) {
  const settingStore = useSettingStore()
  const authStore = useAuthStore()

  let data: Record<string, any> = {
    prompt: params.prompt,
    options: params.options,
    businessType: params.businessType,
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
  return post<T>({
    url: '/chat-process',
    data,
    signal: params.signal,
    onDownloadProgress: params.onDownloadProgress,
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
