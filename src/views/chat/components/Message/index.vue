<script setup lang='ts'>
import { ref } from 'vue'
import { NButton, useMessage } from 'naive-ui'
import { faArrowRotateLeft, faCopy, faEllipsisVertical, faFileExport, faTrashAlt } from '@fortawesome/free-solid-svg-icons'
import { library } from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
// import { useIconRender } from '@/hooks/useIconRender'
// import { useBasicLayout } from '@/hooks/useBasicLayout'
import MarkdownIt from 'markdown-it'
// import html2canvas from 'html2canvas'
import htmlToPdfmake from 'html-to-pdfmake'
import pdfMake from 'pdfmake/build/pdfmake'
import { vfs } from '../../../../assets/fonts/simhei/vfs_fonts'
import AvatarComponent from './Avatar.vue'
import TextComponent from './Text.vue'
import { copyToClip } from '@/utils/copy'

const props = defineProps<Props>()

// const emit = defineEmits<Emit>()

library.add(faArrowRotateLeft, faCopy, faEllipsisVertical, faFileExport, faTrashAlt)

interface Props {
  messageIndex: number
  dateTime?: string
  text?: string
  inversion?: boolean // false为回答
  error?: boolean
  loading?: boolean
  isAgent?: boolean
}

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

const mdi = new MarkdownIt()
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

// '我您你可能还想问',

const handleExportPdf = async () => {
  try {
    // 获取文本并处理换行符
    let textContent = props.text ? props.text : ''
    // let textContent = props.text ? props.text.replace(/\n{2,}/g, '\n') : '';
    console.log(textContent)

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
      '或者你可能还想问',
      '或者我猜你可能还想问',
      '我猜你可能还想问',
    ]
    const pattern = new RegExp(`(${removePatterns.join('|')}).*$`, 's')
    textContent = textContent.replace(pattern, '')

    // 替换文本中的换行符为 <br> 标签
    // textContent = textContent.replace(/\n/g, '  \n')
    console.log(textContent)
    let htmlContent = mdi.render(textContent)
    console.log(htmlContent)

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

          <NButton v-show="showButtons && !inversion" quaternary size="tiny" @click="handleExportPdf">
            <FontAwesomeIcon icon="fas fa-file-export" />
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
