// CommonJS on purpose: sandboxed BrowserWindow preload scripts load through
// Electron's own module loader, which expects require()/module.exports, not
// native ESM — this file must stay .cjs regardless of the project's
// package.json "type": "module".
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('plugin', {
  invoke: (method, ...args) => ipcRenderer.invoke('plugin-panel:invoke', method, ...args)
})
