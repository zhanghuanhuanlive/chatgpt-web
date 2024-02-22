import * as dotenv from 'dotenv'
import express from 'express'
import fetch from 'node-fetch'
import type { ChatContext, RequestProps } from './types'
import type { ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel } from './chatgpt'
import { auth } from './middleware/auth'
import { limiter } from './middleware/limiter'
import { isNotEmptyString } from './utils/is'

dotenv.config()
const OPENAI_API_BASE_URL = process.env.OPENAI_API_BASE_URL
const OPENAI_API_KEY = process.env.OPENAI_API_KEY
const app = express()
const router = express.Router()

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
  // console.log(`req.body${req.body}`)
  // console.log(req.body)
  // const businessType = req.body.businessType
  // console.log(businessType)
  try {
    const { prompt, options = {} as ChatContext, systemMessage, temperature, top_p } = req.body as RequestProps
    let firstChunk = true

    options.businessType = req.body.businessType// 这个值将传到/service/src/chatgpt/index.ts用
    // const needTts: boolean = req.body.needTts === false// 是否需要tts
    // options.needTts = req.body.needTts// 这个值将传到/service/src/chatgpt/index.ts用

    // console.log('req.body')
    // console.log(req.body)
    // console.log(`needTts: ${req.body.needTts}`)
    // console.log(`prompt: ${prompt}`)

    // console.log(options)
    // console.log('111111111111111111')
    // 接下来调用/services/chatgpt/index.ts的chatReplyProcess
    // if (!req.body.needTts) {
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
    // }
    // else { // 需要tts
    //   // console.log(`prompt: ${prompt}， OPENAI_API_BASE_URL： ${OPENAI_API_BASE_URL}`)
    //   // const messageBody = `{"model": "tts", "input": "${prompt}"}`
    //   // console.log(messageBody)
    //   const response = await fetch(`${OPENAI_API_BASE_URL}/v1/audio/speech`, {
    //     method: 'POST',
    //     headers: {
    //       'Content-Type': 'application/json',
    //       'Authorization': `Bearer ${OPENAI_API_KEY}`,
    //     },
    //     body: `{"model": "tts", "input": "${prompt}"}`,
    //   })
    //   console.log('response')
    //   // console.log(response)
    //   // console.log(response.status)
    //   // console.log(response.headers)
    //   const contentType = response.headers.get('content-type')
    //   // console.log(contentType)
    //   if (response.status === 200) {
    //     // 检查内容类型是否为 JSON
    //     if (contentType && contentType.includes('audio/mpeg'))
    //       return response.blob()
    //   }
    //   return response.text()
    // }
  }
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/tts-process', auth, async (req, res) => {
  // const { prompt } = req.body
  // let firstChunk = true
  // console.log('tts-process')
  // console.log(req.body)
  res.setHeader('Content-Type', 'audio/mpeg')
  try {
    // fetch(`${OPENAI_API_BASE_URL}/v1/audio/speech`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //     'Authorization': `Bearer ${OPENAI_API_KEY}`,
    //   },
    //   body: JSON.stringify({ model: 'tts', input: req.body.message }),
    // })
    //   .then((response) => {
    //     if (!response.ok)
    //       throw new Error('Error fetching audio data')

    //     // return response.blob() // 将响应体转换为Blob
    //     response.body.pipe(res)
    //   })
    const params = req.body.params
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
    response.body.pipe(res)
  }
  catch (error) {
    res.send(error)
  }
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
