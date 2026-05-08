const { contextBridge, ipcRenderer } = require('electron')
console.log("✅ preload.js loaded")

contextBridge.exposeInMainWorld('electronAPI', {
    invoke: (channel, data) => ipcRenderer.invoke(channel, data),
    send: (channel, data) => ipcRenderer.send(channel, data) // 👈 THÊM
});

contextBridge.exposeInMainWorld('electronEvent', {
  onServerStatus(callback) {
    const handler = (_e, payload) => callback(payload);
    ipcRenderer.on('server-status-change', handler);
    return () => ipcRenderer.removeListener('server-status-change', handler);
  }
});