#!/usr/bin/env node

/**
 * 重置左側面板狀態為展開
 *
 * 這個腳本會在瀏覽器中執行以下操作：
 * localStorage.removeItem('dashboard-left-collapsed')
 *
 * 執行方式：
 * 1. 打開 Dashboard (http://localhost:3000)
 * 2. 打開瀏覽器開發者工具 Console
 * 3. 貼上以下程式碼並執行：
 *
 * localStorage.removeItem('dashboard-left-collapsed')
 * location.reload()
 */

console.log('\n重置左側面板狀態\n')
console.log('請在瀏覽器 Console 中執行以下指令：\n')
console.log('  localStorage.removeItem(\'dashboard-left-collapsed\')')
console.log('  location.reload()\n')
