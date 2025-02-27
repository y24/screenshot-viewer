const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  updateSetting: (key, value) => ipcRenderer.invoke("update-setting", key, value),
  selectFolders: () => ipcRenderer.invoke("select-folders"),
  getImageFiles: (folderPath, recursive) => ipcRenderer.invoke("get-image-files", folderPath, recursive),
  showUnmatchedFiles: (unmatchedFiles) => ipcRenderer.send("show-unmatched-files", unmatchedFiles),
  showSameFolderError: (folderPath) => ipcRenderer.send("show-same-folder-error", folderPath),
});
