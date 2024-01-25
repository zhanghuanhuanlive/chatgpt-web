import { ss } from '@/utils/storage'

const LOCAL_NAME = 'settingsStorage'

export interface SettingsState {
  systemMessage: string
  temperature: number
  top_p: number
  playAudio: boolean// 是否播放音频你
}

export function defaultSetting(): SettingsState {
  return {
    // ，有些内容尽可能使用markdown格式
    systemMessage: '用简体中文回答问题，请确保你回答的内容是正确的，对于不确定的问题请回复我不清楚这个问题',
    temperature: 0.0,
    top_p: 1,
    playAudio: false,
  }
}

export function getLocalState(): SettingsState {
  const localSetting: SettingsState | undefined = ss.get(LOCAL_NAME)
  return { ...defaultSetting(), ...localSetting }
}

export function setLocalState(setting: SettingsState): void {
  ss.set(LOCAL_NAME, setting)
}

export function removeLocalState() {
  ss.remove(LOCAL_NAME)
}
