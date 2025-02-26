const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

let mainWindow;

app.whenReady().then(() => {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("renderer/index.html");

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

// 再帰的にフォルダ内の画像を取得する関数
function getImageFiles(folderPath, recursive = false) {
  let imageFiles = [];

  function scanDirectory(directory) {
    fs.readdirSync(directory, { withFileTypes: true }).forEach(entry => {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory() && recursive) {
        scanDirectory(fullPath);
      } else if (entry.isFile() && /\.(png|jpe?g)$/i.test(entry.name)) {
        imageFiles.push(fullPath);
      }
    });
  }

  scanDirectory(folderPath);
  return imageFiles;
}

// フォルダ選択ダイアログ（複数フォルダ選択対応）
ipcMain.handle("select-folders", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "multiSelections"], // 複数選択可
  });
  return result.filePaths || [];
});

// 未一致のファイルをダイアログで表示
ipcMain.on("show-unmatched-files", (_, unmatchedFiles) => {
  let message = "一致しなかったファイルがあります。\n\n";
  let hasUnmatched = false;

  for (const [folder, files] of Object.entries(unmatchedFiles)) {
    if (files.length > 0) {
      hasUnmatched = true;
      const folderName = folder.split(/[/\\]/).pop();
      message += `[${folderName}]\n`;
      files.forEach(file => {
        message += `  ${file}\n`;
      });
      message += "\n";
    }
  }

  if (hasUnmatched) {
    dialog.showMessageBox(mainWindow, {
      type: "warning",
      title: "ファイル不一致",
      message: message.trim(),
      buttons: ["OK"]
    });
  }
});

// フォルダが同じ場合にエラーダイアログを表示
ipcMain.on("show-same-folder-error", (_, folderPath) => {
  dialog.showMessageBox(mainWindow, {
    type: "error",
    title: "フォルダ選択エラー",
    message: `選択したフォルダ「${folderPath}」は同じです。異なるフォルダを選択してください。`,
    buttons: ["OK"]
  });
});

// 画像ファイル取得（再帰モード対応）
ipcMain.handle("get-image-files", async (_, folderPath, recursive) => {
  if (!folderPath || !fs.existsSync(folderPath)) return [];
  return getImageFiles(folderPath, recursive);
});
