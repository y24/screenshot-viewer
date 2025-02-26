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

// フォルダ選択ダイアログ（複数フォルダ選択対応）
ipcMain.handle("select-folders", async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ["openDirectory", "multiSelections"], // 複数選択可
  });
  return result.filePaths || [];
});

// 指定フォルダ内の画像ファイルを取得
ipcMain.handle("get-image-files", async (_, folderPath) => {
  if (!folderPath || !fs.existsSync(folderPath)) return [];
  return fs
    .readdirSync(folderPath)
    .filter(file => /\.(png|jpe?g)$/i.test(file))
    .map(file => path.join(folderPath, file));
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
