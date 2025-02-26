const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  selectFolders: () => ipcRenderer.invoke("select-folders"),
  getImageFiles: (folderPath) => ipcRenderer.invoke("get-image-files", folderPath),
});
