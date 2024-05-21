<script setup lang='ts'>
import { ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { faArrowRotateLeft, faCopy, faEllipsisVertical, faFileExport, faFilePdf, faFileWord } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
// import { useIconRender } from '@/hooks/useIconRender'
// import { useBasicLayout } from '@/hooks/useBasicLayout'
// import html2canvas from 'html2canvas'
import htmlToPdfmake from 'html-to-pdfmake' // 不用了
import pdfMake from 'pdfmake/build/pdfmake' // 不用了
import DOMPurify from 'dompurify' // 不用了

import PizZip from 'pizzip' // 不用了
import Docxtemplater from 'docxtemplater' // 不用了
import { saveAs } from 'file-saver' // 不用了
import JSZipUtils from 'jszip-utils' // 不用了

import ImageModule from 'docxtemplater-image-module-free' // 不用了
import { vfs } from '../../../../assets/fonts/simhei/vfs_fonts' // 不用了
import TextComponent from './Text.vue'
import AvatarComponent from './Avatar.vue'
import { fetchWordFromMarkdown } from '@/api'
import { copyToClip } from '@/utils/copy'

const props = defineProps<Props>()

// const emit = defineEmits<Emit>()

library.add(faArrowRotateLeft, faCopy, faEllipsisVertical, faFileExport, faFilePdf, faFileWord)

interface Props {
  messageIndex: number
  dateTime?: string
  text?: string
  inversion?: boolean // false为回答
  error?: boolean
  loading?: boolean
  isAgent?: boolean
}

// console.log(props.loading)

// interface Emit {
//   (ev: 'regenerate'): void
//   (ev: 'delete'): void
// }

// const { isMobile } = useBasicLayout()

// const { iconRender } = useIconRender()

const message = useMessage()

const textRef = ref<HTMLElement>()

const asRawText = ref(props.inversion)

const isAgent = ref(props.isAgent)

const messageIndex = ref(props.messageIndex)

const messageRef = ref<HTMLElement>()

const showButtons = ref(false)

// const options = computed(() => {
//   const common = [
//     {
//       label: t('chat.copy'),
//       key: 'copyText',
//       icon: iconRender({ icon: 'ri:file-copy-2-line' }),
//     },
//     // {
//     //   label: t('common.delete'),
//     //   key: 'delete',
//     //   icon: iconRender({ icon: 'ri:delete-bin-line' }),
//     // },
//   ]

//   // if (!props.inversion) {
//   //   common.unshift({
//   //     label: asRawText.value ? t('chat.preview') : t('chat.showRawText'),
//   //     key: 'toggleRenderType',
//   //     icon: iconRender({ icon: asRawText.value ? 'ic:outline-code-off' : 'ic:outline-code' }),
//   //   })
//   // }

//   return common
// })

// function handleSelect(key: 'copyText' | 'delete' | 'toggleRenderType') {
//   switch (key) {
//     case 'copyText':
//       handleCopy()
//       return
//     case 'toggleRenderType':
//       asRawText.value = !asRawText.value
//       return
//     case 'delete':
//       emit('delete')
//   }
// }

// function handleRegenerate() {
//   messageRef.value?.scrollIntoView()
//   emit('regenerate')
// }

async function handleCopy() {
  try {
    let text = props.text
    text = text === undefined ? '' : text.replace(/\*\*\#\#\*\*(.*?)\*\*\#\#\*\*/g, '')
    await copyToClip(text || '')
    message.success('复制成功')
  }
  catch {
    message.error('复制失败')
  }
}

// const mdi = new MarkdownIt()
pdfMake.vfs = vfs

pdfMake.fonts = {
  simhei: {
    normal: 'simhei.ttf',
    bold: 'simhei.ttf',
    italics: 'simhei.ttf',
    bolditalics: 'simhei.ttf',
  },
}

async function getImageDataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  catch (error) {
    console.error('Failed to fetch image:', url, error)
    return url // 返回原始 URL 以防止失败
  }
}

function getPreProcessedHtmlContent() {
// 获取文本并处理换行符
  let textContent = props.text ? props.text : ''
  // let textContent = props.text ? props.text.replace(/\n{2,}/g, '\n') : '';
  // console.log(textContent)

  if (isAgent.value) { // 是智能体
    // 去掉前面第四个换行符前的所有内容
    const lines = textContent.split('\n')
    if (lines.length > 4)
      textContent = lines.slice(4).join('\n')
  }
  // 去掉你可能还想问
  // 去掉 "您可能还想问"、"或者你可能还想问"、"或者我猜你可能还想问" 开头及其后的所有内容
  const removePatterns = [
    '您可能还想问',
    '你可能还想问',
    '我猜你可能还想问',
    '我猜您可能还想问',
  ]
  const pattern = new RegExp(`(${removePatterns.join('|')}).*$`, 's')
  textContent = textContent.replace(pattern, '')

  // 替换文本中的换行符为 <br> 标签
  // textContent = textContent.replace(/\n/g, '  \n')
  console.log(textContent)
  return textContent
  // let htmlContent = mdi.render(textContent)
  // htmlContent = htmlContent || ''
  // console.log(htmlContent)
  // return htmlContent
}

const handleExportPdf = async () => {
  try {
    let htmlContent = getPreProcessedHtmlContent()
    // 替换 Markdown 中的图片 URL 为 Data URL
    const imgTags = htmlContent.match(/<img [^>]*src="[^"]*"[^>]*>/gm)
    if (imgTags) {
      for (let i = 0; i < imgTags.length; i++) {
        const imgTag = imgTags[i]
        const srcMatch = imgTag.match(/src="([^"]*)"/)
        if (srcMatch && srcMatch[1]) {
          const imgUrl: string = srcMatch[1]
          try {
            const dataUrl: string = await getImageDataUrl(imgUrl)
            htmlContent = htmlContent.replace(imgUrl, dataUrl)
          }
          catch (error) {
            console.error('Failed to load image:', imgUrl, error)
          }
        }
      }
    }

    // 将 HTML 转换为 pdfmake 的内容
    const pdfContent = htmlToPdfmake(htmlContent, {
      images: true, // 启用图片处理
    })

    // 设置图片的适应页面大小的宽度和高度
    const adjustImages = (content) => {
      if (Array.isArray(content)) {
        content.forEach(item => adjustImages(item))
      }
      else if (content && typeof content === 'object') {
        if (content.image)
          content.fit = [595.28 - 2 * 40, 841.89 - 2 * 60] // 适应页面宽度和高度，减去边距

        if (content.stack)
          adjustImages(content.stack)
      }
    }

    adjustImages(pdfContent)

    // 手动处理换行符并调整行间距
    const handleNewlinesAndSpacing = (content) => {
      if (Array.isArray(content)) {
        return content.map(item => handleNewlinesAndSpacing(item))
      }
      else if (content && typeof content === 'object') {
        if (content.text && typeof content.text === 'string') {
          return {
            ...content,
            // text: content.text.split('<br>').join('\n'), // 将 <br> 替换为 \n
            // preserveNewlines: true,
            // lineHeight: 1.5, // 设置 1.5 倍行间距
          }
        }
        if (content.stack) {
          return {
            ...content,
            stack: handleNewlinesAndSpacing(content.stack),
          }
        }
        return content
      }
      return content
    }

    const adjustedPdfContent = handleNewlinesAndSpacing(pdfContent)

    // 应用样式
    const applyStyles = (content) => {
      if (Array.isArray(content)) {
        return content.map(item => applyStyles(item))
      }
      else if (content && typeof content === 'object') {
        console.log(content.nodeName)
        switch (content.nodeName) {
          case 'H1':
            return { ...content, fontSize: 16, bold: true }
          case 'H2':
            return { ...content, fontSize: 16, bold: true }
          case 'H3':
            return { ...content, fontSize: 16, bold: true, lineHeight: 1.0, marginBottom: 5 }
          case 'P':
            return { ...content, fontSize: 14, lineHeight: 1.5, margin: 0 }
          case 'OL':
            return { ...content, fontSize: 14, lineHeight: 1.5 }
          default:
            return { ...content, fontSize: 14, lineHeight: 1.0, margin: 0 }
            // break
        }
      }
      return content
    }

    const styledPdfContent = applyStyles(adjustedPdfContent)

    console.log(styledPdfContent)

    const docDefinition = {
      content: styledPdfContent,
      pageSize: 'A4', // 设置 PDF 页面大小为 A4
      pageMargins: [40, 60, 40, 60], // 设置页面边距
      defaultStyle: {
        font: 'simhei',
      },
      // styles: {
      //   h1: { fontSize: 24, bold: true },
      //   h2: { fontSize: 22, bold: true },
      //   H3: { fontSize: 12, bold: true },
      //   p: { fontSize: 12, lineHeight: 1.5 },
      // },
    }

    // 生成 PDF 并下载
    message.success('开始导出，请稍后！')
    pdfMake.createPdf(docDefinition).download('output.pdf')
  }
  catch (error) {
    message.error('导出失败')
    console.error('导出失败', error)
  }
}

const htmlToWord = async (htmlContent: string): Promise<string> => {
  // Preserve line breaks
  let wordContent = htmlContent.replace(/\n/g, '<w:br/>')

  // Replace <h3> tags with Word heading style
  wordContent = wordContent.replace(/<h3[^>]*>(.*?)<\/h3>/g, '<w:heading>Heading 3: $1</w:heading>')

  // Replace <ol> tags with Word numbered list style
  wordContent = wordContent.replace(/<ol[^>]*>(.*?)<\/ol>/g, (match) => {
    const listItems = match.match(/<li[^>]*>(.*?)<\/li>/g)
    if (listItems) {
      const listContent = listItems.map((item) => {
        const listItemContent = item.replace(/<li[^>]*>(.*?)<\/li>/, '<w:li>$1</w:li>')
        return listItemContent
      }).join('')
      return `<w:ol>${listContent}</w:ol>`
    }
    return match
  })

  // Replace <ul> tags with Word bullet list style
  wordContent = wordContent.replace(/<ul[^>]*>(.*?)<\/ul>/g, (match) => {
    const listItems = match.match(/<li[^>]*>(.*?)<\/li>/g)
    if (listItems) {
      const listContent = listItems.map((item) => {
        const listItemContent = item.replace(/<li[^>]*>(.*?)<\/li>/, '<w:li>$1</w:li>')
        return listItemContent
      }).join('')
      return `<w:ul>${listContent}</w:ul>`
    }
    return match
  })

  // Replace <p> tags with Word paragraph style
  wordContent = wordContent.replace(/<p[^>]*>(.*?)<\/p>/g, (match, pContent) => {
    // Check if the content contains image
    const hasImage = /<img[^>]*src="([^"]+)"[^>]*>/.test(pContent)
    if (!hasImage)
      return `<w:p><w:pPr><w:spacing w:line="360" w:lineRule="auto"/><w:rPr><w:b/><w:sz w:val="28"/></w:rPr></w:pPr><w:r><w:t>${pContent}</w:t></w:r></w:p>`

    return match
  })

  // Replace <img> tags with Word image
  // wordContent = wordContent.replace(/<img[^>]*src="([^"]+)"[^>]*>/g, '<w:p><w:r><w:drawing><wp:inline><wp:extent cx="5000" cy="4000"/><wp:docPr id="1" name="Picture 1"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Picture 1"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId1" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="5000" cy="4000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>')
  wordContent = await replaceImgTagsWithWordImages(wordContent)

  // Remove other HTML tags
  wordContent = wordContent.replace(/<[^>]+>/g, '')

  return wordContent
}

async function getImageBase64DataUrl(url: string): Promise<string> {
  try {
    const response = await fetch(url)
    const blob = await response.blob()
    const reader = new FileReader()
    return new Promise<string>((resolve, reject) => {
      reader.onloadend = () => {
        const base64Data = reader.result as string
        const contentType = blob.type
        const prefix = `data:${contentType};base64,`
        const dataUrl = prefix + base64Data.split(',')[1]
        resolve(dataUrl)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }
  catch (error) {
    console.error('Failed to fetch image:', url, error)
    return '' // 返回空字符串以防止失败
  }
}

async function replaceImgTagsWithWordImages(wordContent: string): Promise<string> {
  const imgRegex = /<img[^>]*src="([^"]+)"[^>]*>/g
  let match = imgRegex.exec(wordContent)
  while (match !== null) {
    const imageUrl = match[1]
    const imageDataUrl = await getImageBase64DataUrl(imageUrl)
    // Replace <img> tag with Word image
    wordContent = wordContent.replace(match[0], imageDataUrl)
    match = imgRegex.exec(wordContent) // Move the exec() call here
  }

  return wordContent
}

const handleExportWord = async () => {
  // Convert Markdown to HTML
  const markdown_content = getPreProcessedHtmlContent()

  // Sanitize the HTML to prevent XSS attacks
  const sanitizedHtml = DOMPurify.sanitize(markdown_content)

  if (isAgent.value) {
    try {
      // 生成 WORD 并下载
      message.success('开始导出，请稍后！')
      await fetchWordFromMarkdown(markdown_content)
    }
    catch (error) {
      console.error('Error downloading document:', error)
    }
    // const docx = htmlDocx.asBlob(htmlContent)
    // const blobUrl = URL.createObjectURL(docx)
    // window.open(blobUrl)
    return
  }

  const wordContent = await htmlToWord(sanitizedHtml)

  console.log(sanitizedHtml)
  console.log(wordContent)

  try {
    // Log to debug
    console.log('Fetching template.docx...')

    // Construct the URL dynamically based on the current location
    const baseUrl = `${window.location.protocol}//${window.location.host}`
    const response = await fetch(`${baseUrl}/template.docx`)

    if (!response.ok)
      throw new Error(`Failed to fetch template: ${response.statusText}`)

    const arrayBuffer = await response.arrayBuffer()
    const zip = new PizZip(arrayBuffer)

    // Configure the ImageModule
    const imageOptions = {
      centered: true,
      getImage(tagValue) {
        return new Promise((resolve, reject) => {
          JSZipUtils.getBinaryContent(tagValue, (err, data) => {
            if (err)
              return reject(err)

            resolve(data)
          })
        })
      },
      getSize() {
        return [150, 150]
      },
    }

    // Initialize Docxtemplater with ImageModule and specify custom delimiters
    const doc = new Docxtemplater(zip, {
      modules: [new ImageModule(imageOptions)],
      delimiters: {
        start: '<<',
        end: '>>',
      },
    })

    // Set the content
    doc.setData({ content: wordContent })

    try {
      doc.render()
    }
    catch (error) {
      console.error('Error rendering document:', error)
      throw error
    }

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    // Save the Blob as a .docx file
    saveAs(out, 'document.docx')
  }
  catch (error) {
    console.error('Error converting to Word:', error)
    alert(`Error converting to Word: ${error.message}`)
  }
}
</script>

<template>
  <div
    ref="messageRef"
    class="flex w-full mb-6 overflow-hidden"
    :class="[{ 'flex-row-reverse': inversion }]"
  >
    <div
      class="flex items-center justify-center flex-shrink-0 h-8 overflow-hidden rounded-full basis-8"
      :class="[inversion ? 'ml-2' : 'mr-2']"
    >
      <AvatarComponent :image="inversion" />
    </div>
    <div
      class="overflow-hidden text-sm " :class="[inversion ? 'items-end' : 'items-start']"
      @mouseenter="showButtons = true"
      @mouseleave="showButtons = false"
    >
      <div class="flex items-center">
        <div class="text-xs text-[#b4bbc4]" :class="[inversion ? 'text-right' : 'text-left']" style="height: 23px;line-height: 23px;">
          <text class="mr-2">
            {{ dateTime }}
          </text>
          <NButton v-show="showButtons && !inversion" quaternary size="tiny" @click="handleCopy">
            <FontAwesomeIcon icon="fas fa-copy" />
          </NButton>

          <NButton v-show="false" quaternary size="tiny" style="display: none;" @click="handleExportPdf">
            <FontAwesomeIcon icon="fas fa-file-pdf" />
          </NButton>

          <NButton v-show="showButtons && !inversion && isAgent" quaternary size="tiny" @click="handleExportWord">
            <FontAwesomeIcon icon="fas fa-file-word" />
          </NButton>
          <!-- <NButton v-show="showButtons" quaternary size="tiny" @click="emit('delete')">
            <FontAwesomeIcon icon="fas fa-trash-alt" />
          </NButton> -->
        </div>
      </div>

      <div
        class="flex items-end gap-1 mt-2"
        :class="[inversion ? 'flex-row-reverse' : 'flex-row']"
      >
        <TextComponent
          ref="textRef"
          :message-index="messageIndex"
          :inversion="inversion"
          :error="error"
          :text="text"
          :loading="loading"
          :as-raw-text="asRawText"
          :is-agent="isAgent"
        />
        <!-- <div class="flex flex-col">
          <button
            v-if="!inversion"
            class="mb-2 transition text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-300"
            @click="handleRegenerate"
          >
            <FontAwesomeIcon icon="fas fa-arrow-rotate-left" />
          </button>
          <NDropdown
            v-if="isMobile"
            :trigger="isMobile ? 'click' : 'hover'"
            :placement="!inversion ? 'right' : 'left'"
            :options="options"
            @select="handleSelect"
          >
            <button class="transition text-neutral-300 hover:text-neutral-800 dark:hover:text-neutral-200">
              <FontAwesomeIcon icon="fas fa-ellipsis-vertical" />
            </button>
          </NDropdown>
        </div> -->
      </div>
    </div>
  </div>
</template>
