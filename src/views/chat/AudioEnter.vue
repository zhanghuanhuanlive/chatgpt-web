<script>
import Recorder from 'js-audio-recorder'
// const lamejs = require('lamejs')
import lamejs from 'lamejs'
import { Overlay } from 'vant'
import { useBasicLayout } from '@/hooks/useBasicLayout'

// const { isTouchDevice } = useBasicLayout()

/**
   * @param isShow 是否显示音频录入组件
   * @param close-audio 关闭音频录入组件或录音完毕的事件
   */
export default {
  components: {
    [Overlay.name]: Overlay,
  },
  // props: {
  //   isShow: {
  //     type: Boolean,
  //     default: false,
  //   },

  // },
  emits: ['closeAudio', 'stopAudioInput'],
  data() {
    return {
      isShow: false, // 是否显示柱状音浪
      beginRecoding: false, // 开始录音
      blackBoxSpeak: false, // 是否上滑取消
      startY: 0, // 手指滑动开始Y轴坐标
      timeOutEvent: 0, // 定时器
      waveCanvas: null,
      ctx: null,
      recorder: null, // 音频录入的实例
      drawRecordId: null, // 音频绘画波动图时的音频id
      nowDuration: null, // 当前时长
      limitDuration: 60, // 限制时长，单位-秒
      drawColuList: [], // 录音时的柱状波动图，数据集合
      //   isRecording: false, // 用于跟踪录音状态，PC浏览器使用
      //   isTouchDevice: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
      isMobile: useBasicLayout().isMobile,
      // silenceTimer: null, // 静音检测
      // needCheckSilence: false, // 是否需要监测静音
      // checkingSilence: false, // 正在监测是否静音
      // 增加静音监测相关的属性
      silenceStartTime: null, // 静音开始的时间
      silenceDurationThresholdAfterTalk: 2000, // 单位ms，静音时长的阈值，有人说过话以后，超过这个时长，就会停止录音
      silenceDurationThreshold: 5000, // 静音时长的阈值，没人说话的情况下超过这个值，就会停止录音
      talkDurationThreshold: 500, // 说话时长的阈值，超过这个值，才会提交进行撰写
      talkingStartTime: null, // 监测到说话开始的时间
      talkingDuration: null, // 说话的时长
      talkingDetected: false, // 是否检测到有人说话
      needSubmit: false, // 是否需要提交录音数据
      needCheckSlicence: false, // 是否需要监测静音
      hasPermission: false, // 是否取得了录音权限
    }
  },
  // watch: {
  //   isShow: {
  //     handler(nv, ov) {
  //       if (nv)
  //         this.getPermission()
  //     },
  //     deep: true,
  //   },
  // },
  // 父组件通过v-if控制显示与隐藏时，true会调用mounted，false会调用beforeUnmount、unMounted
  mounted() {
    if (!this.hasPermission)
      this.getPermission()// 获取录音权限
    if (!this.recorder) {
      // 创建录音实例
      this.recorder = new Recorder({
        sampleBits: 16, // 采样位数，支持 8 或 16，默认是16
        sampleRate: 48000, // 采样率，支持 11025、16000、22050、24000、44100、48000，根据浏览器默认值
        numChannels: 1, // 声道，支持 1 或 2， 默认是1
        // compiling: false,(0.x版本中生效,1.x增加中)  // 是否边录边转换，默认是false
      })
      // 监听录音变化等
      // 监听录音变化
      // const vm = this
      this.recorder.onprogress = (params) => {
        if (Math.floor(params.duration) === this.limitDuration)
          this.touchend()

        let d = Math.floor(params.duration)
        d = Number(d) < 10 ? `0${d}` : d
        d = `0:${d}`
        this.nowDuration = d // directly setting the data property

        // console.log('--------------START---------------')
        // console.log('录音时长(秒)', params.duration)
        // console.log('录音大小(字节)', params.fileSize);
        // if (params.vol > 15)
        //   console.log('录音音量百分比(%)', params.vol)
        // console.log('当前录音的总数据([DataView, DataView...])', params.data)
        // console.log('--------------END---------------')
      }
      // this.startCanvas()
      document.addEventListener('keydown', this.handleKeyDown)// 监听按键
      // this.toggleRecording() // 页面初始化完成后，自动开始录音
      console.log('onMounted')
      if (!this.beginRecoding)
        this.startRecorder()
    }
  },
  beforeUnmount() {
    // 在组件销毁前移除事件监听
    document.removeEventListener('keydown', this.handleKeyDown)
    if (this.recorder) {
    // 销毁 recorder 实例的逻辑
      this.recorder.destroy() // 假设 Recorder 有一个 destroy 方法
      this.recorder = null
    }
  },
  methods: {
    initRecorder() {
      if (this.hasPermission) {
      // this.getPermission().then(() => {

      // })
      }
    },
    handleKeyDown(event) {
      if (event.key === 'Escape' || event.keyCode === 27) {
        // 当按下 ESC 键时触发的操作
        console.log('ESC 键被按下了')
        this.close()
      }
    },
    // 获取麦克风权限
    getPermission() {
      return Recorder.getPermission().then(() => {
        this.isShow = true
        this.hasPermission = true
        console.log('录音权限已授权')
      }, (error) => {
        console.error(`${error.name} : ${error.message}`)
      })
    },
    // 波浪图canvas 配置
    startCanvas() {
      // 录音波浪
      this.waveCanvas = document.getElementById('canvas')
      this.waveCanvas.width = 145
      this.waveCanvas.height = 44
      this.ctx = this.waveCanvas.getContext('2d')
    },
    // 手指开始触发
    touchstart(e) {
      this.blackBoxSpeak = true
      this.startY = e.touches[0].clientY

      this.timeOutEvent = 0
      // 长按1000毫秒后执行
      this.timeOutEvent = setTimeout(() => {
        this.startRecorder()
        this.beginRecoding = true
      }, 500)
      return false
    },
    // 手指离开屏幕触发
    touchend() {
      // 清空定时器
      clearTimeout(this.timeOutEvent)
      if (this.timeOutEvent !== 0) {
        this.beginRecoding = false
        this.stopRecorder() // 停止录音
        // 长按结束调用保存录音或者返回录音数据
        if (this.blackBoxSpeak) { // 未上滑取消
        //   console.log('通知父窗体')
          this.$emit('closeAudio', this.recorder.getWAVBlob())
        }
        else {
          this.$emit('closeAudio', null)
          this.stopRecoder()
        }// 上滑也关闭窗口
        // console.log('松开>>>', this.getRecorder())
        this.nowDuration = null
        this.drawColuList = []
      }
    },
    // 滑动触发
    touchmove(e) {
      const endY = e.touches[0].clientY
      const threshold = 30 // 设置一个阈值，比如30px
      if (this.startY - endY > threshold) {
        // 如果当前位置比起始位置上方超过30像素，则视为上滑
        this.blackBoxSpeak = false
      }
    },
    // 长按超过x毫秒-- 开始录音
    startRecorder() {
      console.log('startRecorder')
      this.stopRecorder()
      this.recorder.start().then(() => {
        this.beginRecoding = true
        // this.drawRecordWave()// 开始绘制
        this.needCheckSlicence = true
        this.drawRecordColu() // 开始绘制
      }, (error) => {
        console.log(`${error.name} : ${error.message}`)
      })
    },
    toggleRecording() { // PC
      // console.log(`toggleRecording： ${this.beginRecoding}`)
      if (!this.beginRecoding) {
        this.startRecorder()
      }
      else if (this.needSubmit) {
        this.stopRecorder() // 停止录音
        this.isShow = false
        const duration = this.recorder.duration
        // console.log(`this.needSubmit: ${this.needSubmit} ${duration}`)
        if (duration > 2) {
          this.$emit('closeAudio', this.recorder.getWAVBlob())
        }
        else {
          // this.stopRecorder()
          // this.$emit('closeAudio', null)
          this.startRecorder()// 录音时间太短,重新开始录音
          this.isShow = true
        }
      }
      else { // 不需要提交，是监测到静音阈值了
        this.stopRecorder()
        this.startRecorder()// 没有人说话,重新开始录音
        this.isShow = true
        // this.$emit('closeAudio', null)
      }
      this.beginRecoding = !this.beginRecoding
    },
    // 继续录音
    resumeRecorder() {
      this.recorder.resume()
    },
    // 暂停录音
    pauseRecorder() {
      this.recorder.pause()
      this.drawRecordId && cancelAnimationFrame(this.drawRecordId)
      this.drawRecordId = null
    },
    // 结束录音
    stopRecorder() {
      this.recorder.stop()
      this.drawRecordId && cancelAnimationFrame(this.drawRecordId)
      this.drawRecordId = null
    },
    // 录音播放
    playRecorder() {
      this.recorder.play()
      // this.drawPlay();//绘制波浪图
    },
    // 暂停录音播放
    pausePlayRecorder() {
      this.recorder.pausePlay()
    },
    // 恢复录音播放
    resumePlayRecorder() {
      this.recorder.resumePlay()
      // this.drawPlay();//绘制波浪图
    },
    // 停止录音播放
    stopPlayRecorder() {
      this.recorder.stopPlay()
    },
    // 销毁录音
    destroyRecorder() {
    //   const vm = this
      if (this.recorder) {
        this.recorder.destroy().then(() => {
          this.recorder = null
          this.drawRecordId && cancelAnimationFrame(this.drawRecordId)
          this.drawRecordId = null
        })
      }
    },
    // 获取录音文件
    getRecorder() {
      const map = new Map()
      map.set('duration', this.recorder.duration)// 录音总时长
      map.set('fileSize', this.recorder.fileSize)// 录音总大小

      // 录音结束，获取取录音数据
      map.set('PCMBlob', this.recorder.getPCMBlob())// 获取 PCM 数据
      map.set('wavBlob', this.recorder.getWAVBlob())// 获取 WAV 数据
      map.set('mp3Blob', this.convertToMp3(this.recorder.getWAV()))
      map.set('channel', this.recorder.getChannelData())// 获取左声道和右声道音频数据
      return map
    },
    // 下载pcm格式
    downPCM() {
      this.recorder.downloadPCM('新文件')// 这里传参进去的时文件名
    },
    // 下载wav格式
    downWAV() {
      this.recorder.downloadWAV('新文件')// 这里传参进去的时文件名
    },
    // 文件格式转换 wav-map3
    downMP3() {
      const mp3Blob = this.convertToMp3(this.recorder.getWAV())
      this.recorder.download(mp3Blob, 'recorder', 'mp3')
    },
    // wav转换成mp3格式
    convertToMp3(wavDataView) {
      // 获取wav头信息
      const wav = lamejs.WavHeader.readHeader(wavDataView) // 此处其实可以不用去读wav头信息，毕竟有对应的config配置
      const { channels, sampleRate } = wav
      const mp3enc = new lamejs.Mp3Encoder(channels, sampleRate, 128)
      // 获取左右通道数据
      const result = this.recorder.getChannelData()
      const buffer = []

      const leftData = result.left && new Int16Array(result.left.buffer, 0, result.left.byteLength / 2)
      const rightData = result.right && new Int16Array(result.right.buffer, 0, result.right.byteLength / 2)
      const remaining = leftData.length + (rightData ? rightData.length : 0)

      const maxSamples = 1152
      for (let i = 0; i < remaining; i += maxSamples) {
        const left = leftData.subarray(i, i + maxSamples)
        let right = null
        let mp3buf = null

        if (channels === 2) {
          right = rightData.subarray(i, i + maxSamples)
          mp3buf = mp3enc.encodeBuffer(left, right)
        }
        else {
          mp3buf = mp3enc.encodeBuffer(left)
        }

        if (mp3buf.length > 0)
          buffer.push(mp3buf)
      }
      const enc = mp3enc.flush()
      if (enc.length > 0)
        buffer.push(enc)

      return new Blob(buffer, { type: 'audio/mp3' })
    },
    // 录音绘制波浪图
    drawRecordWave() {
      // 用requestAnimationFrame稳定60fps绘制
      this.drawRecordId = requestAnimationFrame(this.drawRecordWave)
      // 实时获取音频大小数据
      const dataArray = this.recorder.getRecordAnalyseData()
      // console.log('>>>',dataArray)
      const bufferLength = dataArray.length

      // 填充背景色
      this.ctx.fillStyle = 'rgb(0,0,0)'
      this.ctx.fillRect(0, 0, this.waveCanvas.width, this.waveCanvas.height)

      // 设定波形绘制颜色
      this.ctx.lineWidth = 2
      this.ctx.strokeStyle = 'rgb(109, 212, 0)'

      this.ctx.beginPath()
      const sliceWidth = this.waveCanvas.width * 1.0 / bufferLength // 一个点占多少位置，共有bufferLength个点要绘制
      let x = 0 // 绘制点的x轴位置
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = v * this.waveCanvas.height / 2
        if (i === 0) {
          // 第一个点
          this.ctx.moveTo(x, y)
        }
        else {
          // 剩余的点
          this.ctx.lineTo(x, y)
        }
        // 依次平移，绘制所有点
        x += sliceWidth
      }

      this.ctx.lineTo(this.waveCanvas.width, this.waveCanvas.height / 2)
      this.ctx.stroke()
    },
    // 录音绘制柱状图
    drawRecordColu() {
      // console.log('drawRecordColu')
      // 用requestAnimationFrame稳定60fps绘制(官方写法，录音过程中，会一直自我调用，因此能得到持续的数据，然后根据数据绘制音波图)
      this.drawRecordId = requestAnimationFrame(this.drawRecordColu)
      // 实时获取音频大小数据
      const dataArray = this.recorder.getRecordAnalyseData()
      const transit = []
      this.splitArr([...dataArray], transit)

      const rstArr = []
      for (let i = 0; i < transit.length; i++)
        rstArr.push(Math.max(...transit[i]))

      this.drawColuList = []
      for (let i = 0; i < rstArr.length; i++) {
        if (i >= 9)
          break
        // var v = rstArr[i] / 128.0;
        // var h = v * this.waveCanvas.height / 3;
        // this.drawColuList.push(h)
        // 根据数值大小，设置音波柱状的高度
        let waveH = 10
        const newDb = rstArr[i]
        if (i < 4)
          waveH = newDb - ((5 - i) * 15)
        else if (i === 4)
          waveH = newDb - 3 * 15
        else if (i >= 5)
          waveH = newDb - ((i - 3) * 15)

        // if (newDb >= 150)
        //   console.log(newDb)
        // if (newDb >= 128 && newDb <= 140)
        //   waveH = 15
        // else if (newDb >= 141 && newDb <= 160)
        //   waveH = 20
        // else if (newDb >= 161 && newDb <= 180)
        //   waveH = 25
        // else if (newDb >= 181 && newDb <= 200)
        //   waveH = 30
        // else if (newDb > 200)
        //   waveH = 35
        // if (newDb >)
        // console.log(waveH)
        this.drawColuList.push(waveH)
      }
      // console.log(this.drawColuList)
      this.$forceUpdate()

      // 静音检测逻辑
      this.checkSilence(rstArr)
    },

    // 静音检测逻辑方法
    checkSilence(rstArr) {
      const currentTime = Date.now()
      const hasLoudSound = rstArr.some(db => db >= 150)

      if (hasLoudSound) {
        this.talkingDetected = true
        this.silenceStartTime = null // 重置静音开始时间
        if (!this.talkingStartTime)
          this.talkingStartTime = currentTime
      }
      else if (!this.silenceStartTime) {
        // if (this.talkingStartTime) {
        //   this.talkingDuration = currentTime - this.talkingStartTime// 记录说话间隔时长
        //   this.talkingStartTime = null
        // }
        this.silenceStartTime = currentTime // 首次检测到静音，记录开始时间
      }

      // 检测静音条件
      if (this.silenceStartTime && this.needCheckSlicence) {
        const silenceDuration = currentTime - this.silenceStartTime// 静音时长，ms
        if (this.beginRecoding && (this.talkingDetected && silenceDuration > this.silenceDurationThresholdAfterTalk)) { // 有人说话，且静音超过1500ms
          this.needCheckSlicence = false
          // 结束录音
          cancelAnimationFrame(this.drawRecordId) // 停止drawRecordColu的调用
          console.log(`silenceDuration > 1.5: ${silenceDuration}`)
          this.talkingDuration = currentTime - this.talkingStartTime - this.silenceDurationThresholdAfterTalk // 说话时长
          console.log(`talkingDuration: ${this.talkingDuration}`)
          // if (this.talkingDuration > this.talkDurationThreshold) { // 说话时长大于1500ms
          this.needSubmit = true
          // }
          this.toggleRecording()// 结束录音，且提交
          // 清理逻辑
          this.cleanupAfterRecording()
        }
        else if (this.beginRecoding && !this.talkingDetected && silenceDuration > this.silenceDurationThreshold) { // 没人说话，且静音超过5000ms
          this.needCheckSlicence = false
          console.log(`this.beginRecoding: ${this.beginRecoding}`)
          console.log(`silenceDuration > 5: ${silenceDuration}`)
          this.toggleRecording()// 结束录音，不提交
          this.cleanupAfterRecording()
        }
      }
    },

    // 清理逻辑的实现
    cleanupAfterRecording() {
      this.talkingDetected = false
      this.silenceStartTime = null
      this.talkingStartTime = null
      this.talkingDuration = null
      this.drawColuList = [] // 假设这是存储音波高度的数组，清空它
      this.needSubmit = false

      // 重新开始录音
      // this.toggleRecording()
      // 如果有其他需要重置的属性或状态，也在这里处理

      // 更新UI状态，例如重置按钮状态，清除音波图等
      // this.$forceUpdate() // 强制Vue重新渲染组件

      // 如果有打开的音频流，确保在这里关闭它
      // this.recorder.closeAudioStream(); // 假设这是关闭音频流的方法

      // 触发任何需要的事件，例如告诉外部组件录音已经结束
      // this.$emit('recordingStopped');
    },
    // 拆分数组
    splitArr(arr, rst, idx) {
      if (!arr || arr.length === 0)
        return

      rst.push(arr.splice(0, idx || 32))
      this.splitArr(arr, rst)
    },
    // 取数组平均数
    arrAverageNum2(arr) {
      // eslint-disable-next-line no-eval
      const sum = eval(arr.join('+'))
      return ~~(sum / arr.length * 100) / 100
    },
    // 关闭组件
    close() {
      if (this.beginRecoding) {
        this.beginRecoding = false
        this.stopRecorder() // 停止录音
      }
      this.nowDuration = null
      this.drawColuList = []
      this.$emit('stopAudioInput', null)
    },
    // 销毁实例
    beforeDestroy() {
      this.destroyRecorder()
    },
  },
}
</script>

<template>
  <div v-show="isShow" class="audio-enter" @click="close">
    <van-overlay :show="isShow" class-name="custom-overlay">
      <div class="audio-pie" @click.stop>
        <!-- 录音时显示音波图和时长 -->
        <div v-if="beginRecoding">
          <!-- <div v-if="nowDuration" class="audio-pie_audio--times">
            {{ nowDuration }}
          </div> -->
          <!-- <div v-show="false" class="audio-pie_audio--osc">
            <canvas id="canvas" />
          </div> -->
          <div v-if="drawColuList.length > 0" class="audio-pie_audio--osc">
            <div v-for="(item, idx) in drawColuList" :key="idx" class="audio-pie_audio--osc_item" :style="{ height: `${item}px` }" />
          </div>
        </div>

        <!-- 原逻辑为判断isMobile，现在统一采用PC端的处理方式 -->
        <!-- <div v-if="isMobile" class="audio-pie_btn" @touchstart.prevent="touchstart" @touchend.prevent="touchend" @touchmove.prevent="touchmove">
          <div class="audio-pie_btn-icon">
            <template v-if="beginRecoding">
              <div class="audio-pie_btn-icon1" />
              <div class="audio-pie_btn-icon2" />
            </template>
            <div v-else class="iconfont icon-Voice" />
          </div>

          <div class="audio-pie_txt">
            {{ beginRecoding ? '松开发送，上滑取消' : '按住说话' }}
          </div>
        </div> -->
        <!-- <div class="audio-pie_btn" @click="toggleRecording">
          <div class="audio-pie_btn-icon">
            <template v-if="beginRecoding">
              <div class="audio-pie_btn-icon1" />
              <div class="audio-pie_btn-icon2" />
            </template>
            <div v-else class="iconfont icon-Voice" />
          </div>

          <div class="audio-pie_txt">
            {{ beginRecoding ? '点击停止录音' : '点击开始录音' }}
          </div>
        </div> -->
      </div>
    </van-overlay>
  </div>
</template>

  <style scoped lang="scss">
  // @keyframes voice {
  //   0% {
  //     height: 50px;
  //     opacity: .35;
  //   }
  //   100% {
  //     // 静态定义高度，稍后我们将讨论如何使其动态
  //     height: 100px;
  //     opacity: 1;
  //   }
  // }
  .audio-enter {
    z-index: 999999999;
    display: flex;
    justify-content: center;
    align-items: center;
    position: fixed;
    left: 0;
    top: 0;
    height: 100%;
    width: 100%;
    z-index: 999999999;
    background-color: rgba(0, 0, 0, 0.5);

    .custom-overlay {
      // background-color: rgba(0, 0, 0, 0.8);
    }

    .audio-pie {
      z-index: 999;
      display: flex;
      justify-content: center;
      align-items: center;
      text-align: center;

      .audio-pie_txt {
        height: 20px;
        font-size: 14px;
        font-family: PingFangSC-Regular, PingFang SC;
        font-weight: 400;
        color: #888;
        line-height: 20px;
        margin-top: 20px;
      }

      .audio-pie_audio--times {
        height: 20px;
        font-size: 14px;
        font-family: PingFangSC-Regular, PingFang SC;
        font-weight: 400;
        color: #FFFFFF;
        line-height: 20px;
      }
      .audio-pie_audio--osc {
        display: flex;
        justify-content: center;
        align-items: center;
        width: 157px;
        height: 44px;
        margin: 0 auto;
        .audio-pie_audio--osc_item {
          width: 10px;
          background-color: rgba(109, 212, 0, 1);
          border-radius: 5px;
          // animation: voice 0ms -800ms linear infinite alternate;
          &:not(:first-child) {
            margin-left: 5px;
          }
          // &:nth-child(1)  { animation-duration: 474ms; }
          // &:nth-child(2)  { animation-duration: 433ms; }
          // &:nth-child(3)  { animation-duration: 407ms; }
          // &:nth-child(4)  { animation-duration: 458ms; }
          // &:nth-child(5)  { animation-duration: 400ms; }
          // &:nth-child(6)  { animation-duration: 427ms; }
          // &:nth-child(7)  { animation-duration: 441ms; }
          // &:nth-child(8)  { animation-duration: 419ms; }
          // &:nth-child(9)  { animation-duration: 487ms; }
          // &:nth-child(10) { animation-duration: 442ms; }
        }
      }
      .audio-pie_btn {
        margin-top: 60px;

        .audio-pie_btn-icon {
          position: relative;
          width: 60px;
          height: 60px;
          background: #6DD400;
          border-radius: 100%;
          margin: 0 auto;

          .audio-pie_btn-icon1 {
            position: absolute;
            top: 12px;
            left: 0;
            right: 0;
            margin: 0 auto;
            width: 36px;
            height: 36px;
            border: 4px solid #fff;
            border-radius: 100%;
          }
          .audio-pie_btn-icon2 {
            position: absolute;
            top: 22px;
            left: 0;
            right: 0;
            margin: 0 auto;
            width: 16px;
            height: 16px;
            background-color:  #fff;
            border-radius: 100%;
          }

          .iconfont {
            color: #FFFFFF;font-size: 35px;line-height: 60px
          }
        }
      }
    }
  }
  </style>
