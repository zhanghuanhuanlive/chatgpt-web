<script setup lang='ts'>
import { defineAsyncComponent, ref } from 'vue'
import { library } from '@fortawesome/fontawesome-svg-core'
import { faCog } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/vue-fontawesome'
import { HoverButton } from '@/components/common'

library.add(faCog)

const Setting = defineAsyncComponent(() => import('@/components/common/Setting/index.vue'))

const show = ref(false)
</script>

<template>
  <footer class="flex items-center justify-between min-w-0 p-4 overflow-hidden border-t dark:border-neutral-800">
    <!-- <div class="flex-1 flex-shrink-0 overflow-hidden">
      <UserAvatar />
    </div> -->

    <HoverButton title="设置" @click="show = true">
      <span class="text-xl text-[#4f555e] dark:text-white">
        <FontAwesomeIcon icon="fas fa-cog" />
      </span>
    </HoverButton>

    <Setting v-if="show" v-model:visible="show" />
  </footer>
</template>
