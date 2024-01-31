import type { FetchFn } from 'chatgpt'

export interface RequestProps {
  prompt: string
  options?: ChatContext
  systemMessage: string
  temperature?: number
  top_p?: number
  // 这里是因为/service/arc/index.ts需要才加的
  businessType: number
}

export interface ChatContext {
  conversationId?: string
  parentMessageId?: string
  businessType: number
  // needTts: boolean
}

export interface ChatGPTUnofficialProxyAPIOptions {
  accessToken: string
  apiReverseProxyUrl?: string
  model?: string
  debug?: boolean
  headers?: Record<string, string>
  fetch?: FetchFn
}

export interface ModelConfig {
  apiModel?: ApiModel
  reverseProxy?: string
  timeoutMs?: number
  socksProxy?: string
  httpsProxy?: string
  usage?: string
  menu?: string
  affixes?: string
  openai_api_model?: string
}

export type ApiModel = 'ChatGPTAPI' | 'ChatGPTUnofficialProxyAPI' | undefined
