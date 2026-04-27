// CJS form sidesteps the @dcloudio/vite-plugin-uni double-default ESM interop:
// the package is published CJS, so when loaded as ESM the plugin function ends up
// at `m.default.default` and Vite never sees the inner config hooks. Loading via
// require() gives us the function directly.
//
// We also pin __UNI_FEATURE_* defines explicitly because Vite's `define` plugin
// in dev mode does not always propagate the values returned by the uni:h5
// plugin's `config()` hook to the served `/node_modules/.../uni-h5.es.js` file.
// Without these, `if (__UNI_FEATURE_PAGES__) initRouter(app)` evaluates to false
// at runtime, $router is never attached, and uni.navigateTo throws
// "Cannot read properties of undefined (reading 'push')".

const { defineConfig } = require('vite');
const uni = require('@dcloudio/vite-plugin-uni').default;

module.exports = defineConfig({
  plugins: [uni()],
  define: {
    __UNI_FEATURE_PAGES__: true,
    __UNI_FEATURE_TABBAR__: false,
    __UNI_FEATURE_TABBAR_MIDBUTTON__: false,
    __UNI_FEATURE_TOPWINDOW__: false,
    __UNI_FEATURE_LEFTWINDOW__: false,
    __UNI_FEATURE_RIGHTWINDOW__: false,
    __UNI_FEATURE_RESPONSIVE__: false,
    __UNI_FEATURE_NAVIGATIONBAR__: true,
    __UNI_FEATURE_PULL_DOWN_REFRESH__: false,
    __UNI_FEATURE_NAVIGATIONBAR_BUTTONS__: false,
    __UNI_FEATURE_NAVIGATIONBAR_SEARCHINPUT__: false,
    __UNI_FEATURE_NAVIGATIONBAR_TRANSPARENT__: false,
    __UNI_FEATURE_PAGE_META__: true,
    __UNI_FEATURE_NVUE__: false,
    __UNI_FEATURE_ROUTER_MODE__: '"hash"',
    __UNI_FEATURE_RPX__: true,
    __UNI_FEATURE_PROMISE__: false,
    __UNI_FEATURE_LONGPRESS__: true,
    __UNI_FEATURE_WX__: false,
    __UNI_FEATURE_WXS__: true,
    __UNI_FEATURE_UNI_CLOUD__: false,
    __UNI_FEATURE_I18N_EN__: true,
    __UNI_FEATURE_I18N_ES__: true,
    __UNI_FEATURE_I18N_FR__: true,
    __UNI_FEATURE_I18N_ZH_HANS__: true,
    __UNI_FEATURE_I18N_ZH_HANT__: true,
    __UNI_FEATURE_I18N_LOCALE__: false,
  },
});
