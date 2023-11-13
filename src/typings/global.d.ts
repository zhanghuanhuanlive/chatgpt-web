interface Window {
  $loadingBar?: import('naive-ui').LoadingBarProviderInst;
  $dialog?: import('naive-ui').DialogProviderInst;
  $message?: import('naive-ui').MessageProviderInst;
  $notification?: import('naive-ui').NotificationProviderInst;
}
declare module 'js-audio-recorder' {
  const JsAudioRecorder: any;
  export default JsAudioRecorder;
}
declare module 'lamejs' {
  const lamejs: any;
  export default lamejs;
}
declare module '*.vue' {
  import { DefineComponent } from 'vue';
  const component: DefineComponent<{}, {}, any>;
  export default component;
}