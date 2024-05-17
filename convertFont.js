// 将/src/assets/fonts/下simhei.ttf字体文件转成pdfmake需要的vfs_fonts.js，这个文件只能转换ttf字体
// 使用方法，在项目根目录下执行node convertFont.js
const fs = require('fs')
const path = require('path')

function base64Encode(file) {
  const bitmap = fs.readFileSync(file)
  return Buffer.from(bitmap).toString('base64')
}

const fontPath = path.resolve(__dirname, 'src/assets/fonts/simhei.ttf')
const base64Font = base64Encode(fontPath)
const output = `var vfs = {};
vfs['simhei.ttf'] = '${base64Font}';
export { vfs };`

fs.writeFileSync(path.resolve(__dirname, 'src/assets/fonts/vfs_fonts.js'), output)

console.log('vfs_fonts.js has been generated')
