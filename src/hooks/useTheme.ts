import type { GlobalThemeOverrides } from 'naive-ui'
import { computed, watch } from 'vue'
import { darkTheme } from 'naive-ui'

export function useTheme() {
  // const appStore = useAppStore()

  // const OsTheme = useOsTheme()

  const isDark = computed(() => {
    return true
    // if (appStore.theme === 'auto')
    //   return OsTheme.value === 'dark'
    // else
    //   return appStore.theme === 'dark'
  })

  const theme = computed(() => {
    return isDark.value ? darkTheme : undefined
  })

  const themeOverrides = computed<GlobalThemeOverrides>(() => {
    if (isDark.value) {
      return {
        common: {},
      }
    }
    return {}
  })

  watch(
    () => isDark.value,
    (dark) => {
      if (dark)
        document.documentElement.classList.add('dark')
      else
        document.documentElement.classList.remove('dark')
    },
    { immediate: true },
  )

  return { theme, themeOverrides }
}
