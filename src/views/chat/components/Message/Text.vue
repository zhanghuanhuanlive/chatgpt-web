<script lang="ts" setup>
import { computed, onMounted, onUnmounted, onUpdated, ref, watchEffect } from 'vue'
// import { NCollapse, NCollapseItem, NTimeline, NTimelineItem } from 'naive-ui'
import { NCollapse, NCollapseItem, NStep, NSteps } from 'naive-ui'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faSpinner } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import MarkdownIt from 'markdown-it'
import mdKatex from '@traptitech/markdown-it-katex'
import mila from 'markdown-it-link-attributes'
import hljs from 'highlight.js'
import { useBasicLayout } from '@/hooks/useBasicLayout'
import { t } from '@/locales'
import { copyToClip } from '@/utils/copy'
const props = defineProps<Props>()

// const emit = defineEmits<Emit>()
// interface Emit {
//   (ev: 'scrollToBottom'): void
// }

library.add(faSpinner)

interface Props {
  messageIndex: number
  inversion?: boolean // false为回答
  error?: boolean
  text?: string
  loading?: boolean // 要输出内容是否结束，true为未结束
  asRawText?: boolean
  isAgent?: boolean
}

const { isMobile } = useBasicLayout()

const textRef = ref<HTMLElement>()

const itemName = ref('item1') // 哪个NCollapseItem被展开，默认为item1展开，换成别的名字后，item1收缩
const collapseItem = ref<HTMLElement | null>(null)

const steps = ref<string[]>([])
// steps 0 : 我是XXX，正在理解问题
// steps 1 :
// steps 2 :
// steps 3 :
// const lastProcessedIndex = ref(0)
// const lastProcessedText = ref('') // 用来保存上次处理的文本副本
const resultText = ref('') // 存储处理后的文本
const loading = ref(props.loading)
const isAgent = ref(props.isAgent)
const messageIndex = ref(props.messageIndex)

const mdi = new MarkdownIt({
  html: false,
  linkify: true,
  highlight(code, language) {
    const validLang = !!(language && hljs.getLanguage(language))
    if (validLang) {
      const lang = language ?? ''
      return highlightBlock(hljs.highlight(code, { language: lang }).value, lang)
    }
    return highlightBlock(hljs.highlightAuto(code).value, '')
  },
})

mdi.use(mila, { attrs: { target: '_blank', rel: 'noopener' } })
mdi.use(mdKatex, { blockClass: 'katexmath-block rounded-md p-[10px]', errorColor: ' #cc0000' })

const wrapClass = computed(() => {
  return [
    'text-wrap',
    'min-w-[20px]',
    'rounded-md',
    // isMobile.value ? 'p-2' : 'px-3 py-2',
    isMobile.value ? 'p-2' : 'px-3 py-2',
    props.inversion ? 'bg-[#d2f9d1]' : 'bg-[#f4f6f8]',
    props.inversion ? 'dark:bg-[#a1dc95]' : 'dark:bg-[#1e1e20]',
    props.inversion ? 'message-request' : 'message-reply',
    { 'text-red-500': props.error },
  ]
})

// const text = computed(() => {
//   let tempText = props.text ?? '' // 使用 let 而不是 const
//   // value = value.replace(/\*\*\#\#\*\*(.*?)\*\*\#\#\*\*/g, '')
//   const pattern = /\*#+[^\n]*\n/g // 使用正则表达式匹配模式
//   const matches = Array.from(tempText.matchAll(pattern)) // 将结果转换为数组

//   if (matches.length > 0) {
//     matches.forEach((match) => {
//       const content = match[0] // 获取匹配到的整个字符串
//       const level = (content.match(/\*/g) || []).length - 1 // 计算*的数量减1以得到层级
//       parsedContent.value.push({ level, content: content.slice(level + 1, -1) })
//     })

//     // 更新缓冲区，删除处理过的数据
//     const lastMatch = matches[matches.length - 1]
//     tempText = tempText.substring(lastMatch.index + lastMatch[0].length)
//   }

//   console.log(parsedContent.value)

//   if (!props.asRawText)
//     return mdi.render(tempText)

//   return tempText
// })

function removeSteps(currentText) {
  if (currentText.startsWith('思考中'))
    currentText = currentText.substring(3) // 从索引3开始到字符串末尾

  steps.value.forEach((step) => {
    const index = currentText.indexOf(step)
    if (currentText.includes(step) && step.includes('\n')) {
      // 从 currentText 中移除找到的子字符串
      currentText = currentText.slice(0, index) + currentText.slice(index + step.length)
    }
  })
  return currentText
}

// 收起当前的Collapse
function changeActiveCollapse() {
  itemName.value = 'item2'
}

function isStepsFull() {
  const length = steps.value.length
  if (length === 4) {
    const lastItem = steps.value[steps.value.length - 1] // 最后一个元素
    if (lastItem.includes('\n')) { // 最后一个元素有\n
      return true
    }
  }
}

// 监视 props.text 的变化并处理
watchEffect(() => {
  // loading.value = true
  // console.log(loading.value)
  // console.log(messageIndex.value)
  let currentText = props.text ?? ''
  currentText = currentText.replace(/\*\*\#\#\*\*(.*?)\*\*\#\#\*\*/g, '') // 文件上传组件所需要
  // 从上次处理结束的地方开始新的内容处理
  // console.log(props.inversion) // inversion为true，表示问题
  // console.log(props.asRawText)
  // console.log(isAgent.value)
  // console.log(currentText)
  if (props.asRawText || messageIndex.value === 0) { // 问题
    // resultText.value = mdi.render(currentText)
    resultText.value = currentText
    return
  }
  else if (!isAgent.value) { // 回答，且不是智能体
    // resultText.value = currentText
    resultText.value = mdi.render(currentText)
    return
  }

  // 智能体
  // console.log(steps.value)
  currentText = removeSteps(currentText)
  // const stepsLength = steps.value.length
  // console.log(`steps: ${steps.value.length} | ${currentText}`)
  if (steps.value.length <= 4) {
  // 逐个处理 steps 中的每个子字符串
    // 剩下的部分用符号 '\n'分割成数组
    const segments = currentText.match(/.*?\n|.+/g) || []
    // console.log(segments)

    // Add each segment to the steps array
    segments.forEach((segment) => {
      // console.log(steps.value.length)
      if (segment) { // This checks if the segment is not empty
        if (steps.value.length === 0) {
          steps.value.push(segment)
          // console.log(`push ${segment}`)
        }
        else {
          if (steps.value.length <= 4) { //
            const lastItem = steps.value[steps.value.length - 1] // steps的最后一个元素
            if (lastItem.includes('\n')) { // 最后一个元素有\n
              if (steps.value.length !== 4) { // 1、2、3个的话，直接加入
                steps.value.push(segment)
                // console.log(`push ${segment}`)
              }
              else { // 如果是4个，就不处理了
                changeActiveCollapse()
              }
            }
            else {
              steps.value[steps.value.length - 1] = segment
              // console.log(`replace ${segment}`)
            } // 替换最后一个元素
          }
          else {
            changeActiveCollapse()
          } // 清空数组来收缩所有项
        }
      }
    }) // forEach
  }

  // console.log(steps.value)
  currentText = removeSteps(currentText)

  if (!isStepsFull()) {
    currentText = ''
  }
  else {
    loading.value = false // 理论上不需要这一行，父页面computed已计算但是没起效果
    resultText.value = mdi.render(currentText)
  }
})

function highlightBlock(str: string, lang?: string) {
  return `<pre class="code-block-wrapper"><div class="code-block-header"><span class="code-block-header__lang">${lang}</span><span class="code-block-header__copy">${t('chat.copyCode')}</span></div><code class="hljs code-block-body ${lang}">${str}</code></pre>`
}

function addCopyEvents() {
  if (textRef.value) {
    const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
    copyBtn.forEach((btn) => {
      btn.addEventListener('click', () => {
        const code = btn.parentElement?.nextElementSibling?.textContent
        if (code) {
          copyToClip(code).then(() => {
            btn.textContent = '复制成功'
            setTimeout(() => {
              btn.textContent = '复制代码'
            }, 1000)
          })
        }
      })
    })
  }
}

function removeCopyEvents() {
  if (textRef.value) {
    const copyBtn = textRef.value.querySelectorAll('.code-block-header__copy')
    copyBtn.forEach((btn) => {
      btn.removeEventListener('click', () => {})
    })
  }
}

onMounted(() => {
  // console.log('onMounted')
  addCopyEvents()
  // steps.value = []
  // resultText.value = ''
})

onUpdated(() => {
  addCopyEvents()
})

onUnmounted(() => {
  removeCopyEvents()
})
</script>

<template>
  <div class="">
    <div v-if="!inversion && isAgent && messageIndex !== 0" style="" class="">
      <NCollapse default-expanded-names="item1" style="margin-bottom: 15px; border-radius: 10px;" class="">
        <NCollapseItem ref="collapseItem" title="玄武AI智能体" :name="itemName" style="padding-left: 2px; " class="">
          <NSteps vertical :current="steps.length" size="small" :status="steps.length === 4 ? 'finish' : 'process'" style="padding-left: 2px;">
            <NStep
              title="理解问题"
              :description="steps.length === 1 ? steps[0] : ''"
            >
              <template v-if="steps.length === 0" #icon>
                <FontAwesomeIcon :icon="['fas', 'spinner']" spin />
              </template>
            </NStep>

            <NStep
              v-if="steps.length >= 1"
              :title="steps.length === 2 ? `选择应用：${steps[1]?.match(/【(.*?)】/)?.[1] ?? '未知应用'}` : '选择应用'"
              :description="steps[1]"
              :status="(steps.length >= 2 && steps[1].startsWith('很抱歉')) ? 'error' : undefined"
            />

            <NStep
              v-if="steps.length >= 2"
              title="数据查询"
              :description="steps[2]"
              :status="(steps.length >= 3 && steps[2].startsWith('很抱歉')) ? 'error' : undefined"
            />

            <NStep
              v-if="steps.length >= 3"
              title="数据分析"
              :description="steps[3]"
              :status="(steps.length >= 4 && steps[3].startsWith('很抱歉')) ? 'error' : undefined"
            />

            <!-- && resultText !== '' -->
            <NStep
              v-if="steps.length >= 3 && resultText !== ''"
              title="输出回答"
              status="finish"
            />
          </NSteps>

          <template v-if="steps.length >= 3" #header-extra>
            <!-- v-if="steps.length === 4" -->
            <div>
              【{{ steps[1]?.match(/【(.*?)】/)?.[1] ?? '' }}】
            </div>
          </template>
        </NCollapseItem>
        <!-- <NCollapseItem v-show="false" title="" name="item2" /> -->
      </NCollapse>
    </div>
    <div v-if="resultText !== ''" ref="textRef" :class="wrapClass" class="text-black leading-relaxed break-words">
      <div v-if="!inversion">
        <!-- loading为true时使用样式markdown-body-generate -->
        <div v-if="!asRawText" class="markdown-body" :class="{ 'markdown-body-generate': loading }" v-html="resultText" />
        <div v-else class="whitespace-pre-wrap" name="222" v-text="resultText" />
      </div>
      <div v-else class="whitespace-pre-wrap" name="111" v-text="resultText" />
    </div>
  </div>
</template>

<style lang="less">
@import url(./style.less);
.n-collapse-item__header-main, .n-collapse-item__header-extra {
  background-color: rgb(75, 158, 95);
  // background-color: rgba(197, 231, 213, 1);
  padding: 3px 3px;
}
.n-collapse-item__header-main {
  border-top-left-radius: 0.138rem;
  border-bottom-left-radius: 0.138rem;
}
.n-collapse-item__header-extra {
  border-top-right-radius: 0.138rem;
  border-bottom-right-radius: 0.138rem;

}
.n-collapse-item__header--active--n-title-text-color {
  // color: #000;
}
.n-collapse-item__content-inner {
  // background-color: rgba(197, 231, 213, 1);
}
</style>
