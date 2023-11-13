// lamejs.d.ts
declare module 'lamejs' {
    class Mp3Encoder {
      constructor(channels: number, sampleRate: number, kbps: number);
      encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
      flush(): Int8Array;
    }
  
    // ...其他你需要使用的类和函数...
    
    export { Mp3Encoder };
  }
  