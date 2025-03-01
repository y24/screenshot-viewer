const { app, BrowserWindow, dialog, ipcMain } = require("electron");
const path = require("path");
const fs = require("fs");

const SETTINGS_FILE = path.join(app.getPath("userData"), "settings.json");

let mainWindow;
let appSettings = {
  windowSize: { width: 1000, height: 700 },
  folder1: "",
  folder2: "",
  currentPrefix: "",
  matchMode: "prefix",
  searchMode: "normal"
};

// 設定を読み込む関数
function loadSettings() {
  if (fs.existsSync(SETTINGS_FILE)) {
    try {
      const data = JSON.parse(fs.readFileSync(SETTINGS_FILE, "utf-8"));

      if (data.windowSize) appSettings.windowSize = data.windowSize;
      if (data.folder1) appSettings.folder1 = fs.existsSync(data.folder1) ? data.folder1 : "";
      if (data.folder2) appSettings.folder2 = fs.existsSync(data.folder2) ? data.folder2 : "";
      if (data.currentPrefix) appSettings.currentPrefix = data.currentPrefix;
      if (data.matchMode) appSettings.matchMode = data.matchMode;
      if (data.searchMode) appSettings.searchMode = data.searchMode;

      if (!fs.existsSync(data.folder1) || !fs.existsSync(data.folder2)) {
        dialog.showMessageBoxSync({
          type: "warning",
          title: "フォルダが見つかりません",
          message: "前回のフォルダが見つかりません。フォルダを再選択してください。"
        });
      }
    } catch (error) {
      console.error("設定の読み込みに失敗しました:", error);
    }
  }
}

// 設定を保存する関数
function saveSettings() {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(appSettings, null, 2), "utf-8");
}

// メインウィンドウ作成
app.whenReady().then(() => {
  loadSettings();

  mainWindow = new BrowserWindow({
    width: appSettings.windowSize.width,
    height: appSettings.windowSize.height,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("renderer/index.html");

  // ウィンドウサイズ変更時に保存
  mainWindow.on("resize", () => {
    const bounds = mainWindow.getBounds();
    appSettings.windowSize = { width: bounds.width, height: bounds.height };
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
});

// アプリ終了時に設定を保存
app.on("before-quit", saveSettings);

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

// 設定をフロントエンドに送信
ipcMain.handle("load-settings", () => appSettings);

// 設定を更新
ipcMain.handle("update-setting", (_, key, value) => {
  appSettings[key] = value;
  saveSettings();
});
