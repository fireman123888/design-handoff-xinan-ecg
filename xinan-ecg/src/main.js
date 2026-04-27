/* ============================================================================
 *  ENTRY  ——  uni-app 入口
 * ----------------------------------------------------------------------------
 *  uni-app 要求导出 createApp() 返回 { app }。
 *  使用 createSSRApp 是 uni-app vue3 的官方推荐(对 H5/小程序/App 都兼容)。
 * ========================================================================== */

import { createSSRApp } from 'vue';
import App from './App.vue';

export function createApp() {
  const app = createSSRApp(App);
  return { app };
}
