<script lang="ts" setup>
import { computed, watch } from 'vue'
import { NButton, NInput, NSlider, NSwitch, useMessage } from 'naive-ui'
import { useSettingStore } from '@/store'
import { t } from '@/locales'

const settingStore = useSettingStore()

const ms = useMessage()

// const systemMessage = ref(settingStore.systemMessage ?? '')

// const playAudio = ref(settingStore.playAudio ?? false)

// const typingSound = ref(settingStore.typingSound ?? false)

// const temperature = ref(settingStore.temperature ?? 0.0)

const temperature = computed({
  get: () => settingStore.temperature,
  set: value => settingStore.updateSetting({ temperature: value }),
})

const systemMessage = computed({
  get: () => settingStore.systemMessage,
  set: value => settingStore.updateSetting({ systemMessage: value }),
})

const playAudio = computed({
  get: () => settingStore.playAudio,
  set: value => settingStore.updateSetting({ playAudio: value }),
})

const typingSound = computed({
  get: () => settingStore.typingSound,
  set: value => settingStore.updateSetting({ typingSound: value }),
})

// 监听 playAudio 和 typingSound 的变化，确保它们是互斥的
watch(playAudio, (newVal, oldVal) => {
  if (newVal && settingStore.typingSound)
    settingStore.updateSetting({ typingSound: false })
})

watch(typingSound, (newVal, oldVal) => {
  if (newVal && settingStore.playAudio)
    settingStore.updateSetting({ playAudio: false })
})

// watch(temperature, (newVal, oldVal) => {
//   if (newVal && settingStore.typingSound)
//     settingStore.updateSetting({ typingSound: false })
// })

// watch(typingSound, (newVal, oldVal) => {
//   if (newVal && settingStore.playAudio)
//     settingStore.updateSetting({ playAudio: false })
// })

// const top_p = ref(settingStore.top_p ?? 1)

// function updateSettings(options: Partial<SettingsState>) {
//   settingStore.updateSetting(options)
//   ms.success(t('common.success'))
// }

function handleReset() {
  settingStore.resetSetting()
  ms.success(t('common.success'))
  window.location.reload()
}
</script>

<template>
  <div class="p-4 space-y-5 min-h-[200px]">
    <div class="space-y-6">
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.role') }}</span>
        <div class="flex-1">
          <NInput v-model:value="systemMessage" type="textarea" :autosize="{ minRows: 3, maxRows: 6 }" />
        </div>
        <!-- <NButton size="tiny" text type="primary" @click="updateSettings({ systemMessage })">
          {{ $t('common.save') }}
        </NButton> -->
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.temperature') }} </span>
        <div class="flex-1">
          <NSlider v-model:value="temperature" :max="1" :min="0" :step="0.1" :tooltip="false" />
        </div>
        <span>{{ $t('setting.temperatureMax') }}</span>
        <!-- <NButton size="tiny" text type="primary" @click="updateSettings({ temperature })">
          {{ $t('common.save') }}
        </NButton> -->
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.playAudio') }} </span>
        <div class="flex-1">
          <NSwitch v-model:value="playAudio" />
        </div>
        <!-- <NButton size="tiny" text type="primary" @click="updateSettings({ playAudio })">
          {{ $t('common.save') }}
        </NButton> -->
      </div>

      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.typingSound') }} </span>
        <div class="flex-1">
          <NSwitch v-model:value="typingSound" />
        </div>
        <!-- <NButton size="tiny" text type="primary" @click="updateSettings({ typingSound })">
          {{ $t('common.save') }}
        </NButton> -->
      </div>

      <!-- <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">{{ $t('setting.top_p') }} </span>
        <div class="flex-1">
          <NSlider v-model:value="top_p" :max="1" :min="0" :step="0.1" />
        </div>
        <span>{{ top_p }}</span>
        <NButton size="tiny" text type="primary" @click="updateSettings({ top_p })">
          {{ $t('common.save') }}
        </NButton>
      </div> -->
      <div class="flex items-center space-x-4">
        <span class="flex-shrink-0 w-[120px]">&nbsp;</span>
        <NButton size="small" @click="handleReset">
          {{ $t('common.reset') }}
        </NButton>
      </div>
    </div>
  </div>
</template>
