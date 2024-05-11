import * as dotenv from 'dotenv'
import express from 'express'
import fetch from 'node-fetch'
// import CryptoJS from 'crypto-js'
import * as CryptoJS from 'crypto-js'
import type { ChatContext, RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

// import CryptoJSNew from './utils/xunfei/HmacSHA1'

dotenv.config()
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
// const XUNFEI_API_ID = process.env.OPENAI_API_KEY
// const XUNFEI_API_KEY = process.env.OPENAI_API_KEY
const app = express()
const router = express.Router()

const config = {
  // 请求地址
  hostUrl: 'wss://iat-api.xfyun.cn/v2/iat',
  host: 'iat-api.xfyun.cn',
  // 在控制台-我的应用-语音听写（流式版）获取
  appId: process.env.XUNFEI_API_ID,
  // 在控制台-我的应用-语音听写（流式版）获取
  apiSecret: process.env.XUNFEI_API_SECRET,
  // 在控制台-我的应用-语音听写（流式版）获取
  apiKey: process.env.XUNFEI_API_KEY,
  uri: '/v2/iat',
  highWaterMark: 1280,
}

// declare let fetch: any

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')
  // console.log('/chat-process started')
  // console.log(businessType)
  try {
    const { prompt, options = {} as ChatContext, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true

    options.businessType = req.body.businessType// 这个值将传到/service/src/chatgpt/index.ts用
    // console.log(req.body)
    // console.log(`prompt: ${prompt}`)
    // console.log(options)
    // 接下来调用/services/chatgpt/index.ts的chatReplyProcess
    await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
      temperature,
      top_p,
    })
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/tts-process', auth, async (req, res) => {
  res.setHeader('Content-Type', 'audio/mpeg')
  try {
    const params = req.body
    params.model = 'tts'
    const response = await fetch(`${OPENAI_API_BASE_URL}/v1/audio/speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(params),
    })
    if (!response.ok) {
      res.status(500).send('Error fetching audio data')
      return
    }

    // console.log(res)
    response.body.pipe(res)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/getXunfeiWebSocketUrl', auth, async (req, res) => {
  const date = new Date().toUTCString()
  const signatureOrigin = `host: ${config.host}\ndate: ${date}\nGET ${config.uri} HTTP/1.1`
  const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, config.apiSecret)
  const signature = CryptoJS.enc.Base64.stringify(signatureSha)
  const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
  const authStr = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Utf8.parse(authorizationOrigin))
  const wssUrl = `${config.hostUrl}?authorization=${authStr}` + `&date=${date}&host=${config.host}`
  // console.log(wssUrl)
  res.json({ wssUrl, appId: config.appId })
})

router.post('/config', auth, async (req, res) => {
  try {
    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const AUTH_SECRET_KEY = process.env.AUTH_SECRET_KEY
    const hasAuth = isNotEmptyString(AUTH_SECRET_KEY)
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')

    if (process.env.AUTH_SECRET_KEY !== token)
      throw new Error('密钥无效 | Secret key is invalid')

    res.send({ status: 'Success', message: 'Verify successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
