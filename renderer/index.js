const initialContainer = document.getElementById("initialContainer");
const folderBtn = document.getElementById("selectFolder");
const loadSettingLink = document.getElementById("loadSettings");
const matchModeRadios = document.querySelectorAll("input[name='matchMode']");
const searchModeRadios = document.querySelectorAll("input[name='searchMode']");

const mainUiContainer = document.getElementById("mainUiContainer");
const clearBtn = document.getElementById("clearSelection");
const fileDropdown = document.getElementById("fileDropdown");
const nextBtn = document.getElementById("moveToNext");
const prevBtn = document.getElementById("moveToPrev");
const firstBtn = document.getElementById("moveToFirst");
const lastBtn = document.getElementById("moveToLast");

const folder1Btn = document.getElementById("selectFolder1");
const folder2Btn = document.getElementById("selectFolder2");
const folder1Name = document.getElementById("folder1Name");
const folder2Name = document.getElementById("folder2Name");
const imageContainer1 = document.getElementById("imageContainer1");
const imageContainer2 = document.getElementById("imageContainer2");

const fullscreenContainer = document.getElementById("fullscreenContainer");
const fullscreenImage = document.getElementById("fullscreenImage");
const closeFullscreen = document.getElementById("closeFullscreen");

const reloadBtn = document.getElementById("reloadBtn");
const settingsIcon = document.getElementById("settingsIcon");
const settingsModal = document.getElementById("settingsModal");
const settingsChaged = document.getElementById("settingsChaged");
const closeModal = document.querySelector(".modal-close");

let folder1Files = {};
let folder2Files = {};
let folder1Path = "";
let folder2Path = "";
let matchedGroups = {};
let currentPrefix = "";
let zoomLevel = 1;
let moveX = 0, moveY = 0;
let matchMode = "prefix"; // 初期値はプレフィックス一致
let searchMode = "normal"; // 初期値は通常モード

// 設定をロードして復元
async function loadSettings() {
    const settings = await window.electronAPI.loadSettings();

    matchMode = settings.matchMode || "prefix";
    searchMode = settings.searchMode || "normal";
    currentPrefix = settings.currentPrefix || "";

    // ラジオボタン設定
    document.querySelector(`input[name="matchMode"][value="${matchMode}"]`).checked = true;
    document.querySelector(`input[name="searchMode"][value="${searchMode}"]`).checked = true;

    // フォルダ1,2の選択
    if (settings.folder1) assignFolder("folder1", settings.folder1);
    if (settings.folder2) assignFolder("folder2", settings.folder2);

    // メインUIに切り替え
    switchToMainUi();
}

// フォルダ選択
async function selectFolders(targetFolder) {
    const folderPaths = await window.electronAPI.selectFolders();
    // キャンセル時
    if (!folderPaths.length) return;

    // フォルダ割当
    if (folderPaths.length === 1) {
        assignFolder(targetFolder, folderPaths[0]);
    } else if (folderPaths.length === 2) {
        assignFolder("folder1", folderPaths[0]);
        assignFolder("folder2", folderPaths[1]);
    } else {
        alert("最大2つのフォルダを選択してください。");
    }

    switchToMainUi();
}

// メインUIに切り替え
function switchToMainUi() {
    initialContainer.classList.add("hidden");
    mainUiContainer.classList.remove("hidden");
}

// データが揃う前の各種UI非表示
function hideControls(){
    fileDropdown.classList.add("hidden");
    firstBtn.classList.add("hidden");
    prevBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    lastBtn.classList.add("hidden");
    reloadBtn.classList.add("hidden");
}
// 各種UI表示
function showControls(){
    fileDropdown.classList.remove("hidden");
    firstBtn.classList.remove("hidden");
    prevBtn.classList.remove("hidden");
    nextBtn.classList.remove("hidden");
    lastBtn.classList.remove("hidden");
    reloadBtn.classList.remove("hidden");
}

// フォルダを割り当てる
async function assignFolder(type, folderPath) {
    const folderName = folderPath.split(/[/\\]/).pop();
    if (type === "folder1") {
        // フォルダ1選択時
        folder1Path = folderPath;
        folder1Name.textContent = folderName;

        // フォルダ2をまだ選択していない場合
        if (Object.keys(folder2Files).length === 0) {
            folder2Name.textContent = "<選択してください>"
            // 各種UI非表示
            hideControls();
            // 設定更新
            window.electronAPI.updateSetting("folder2", "");
        }
    } else {
        // フォルダ2選択時
        folder2Path = folderPath;
        folder2Name.textContent = folderName;
        showControls();
    }

    // フォルダ1とフォルダ2が同じパスだった場合、エラーダイアログを表示
    if (folder1Path === folder2Path) {
        hideControls();
        window.electronAPI.showSameFolderError(folderPath);
        return;
    }

    const recursive = searchMode === "recursive";  // 再帰モードかどうか
    const files = await window.electronAPI.getImageFiles(folderPath, recursive);
    const fileMap = {};

    files.forEach(filePath => {
        // ファイル名取得
        const fileName = filePath.split(/[/\\]/).pop();
        // モードに応じてキーを設定
        const key = matchMode === "prefix" ? fileName.split("_")[0] : fileName;

        if (!fileMap[key]) {
            fileMap[key] = [];
        }
        fileMap[key].push(filePath);
    });

    if (type === "folder1") {
        folder1Files = fileMap;
    } else {
        folder2Files = fileMap;
    }

    // フォルダ割当時に設定更新
    window.electronAPI.updateSetting(type, folderPath);

    if (Object.keys(folder1Files).length > 0 && Object.keys(folder2Files).length > 0) {
        matchFiles();
    }
}

// ファイル名のプレフィックスでマッチング
function matchFiles() {
    matchedGroups = {};
    let unmatchedFiles = { [folder1Path]: [], [folder2Path]: [] };

    Object.keys(folder1Files).forEach(prefix => {
        if (folder2Files[prefix]) {
            matchedGroups[prefix] = {
                folder1: folder1Files[prefix],
                folder2: folder2Files[prefix]
            };
        } else {
            unmatchedFiles[folder1Path].push(...folder1Files[prefix].map(file => file.split(/[/\\]/).pop()));
        }
    });

    Object.keys(folder2Files).forEach(prefix => {
        if (!folder1Files[prefix]) {
            unmatchedFiles[folder2Path].push(...folder2Files[prefix].map(file => file.split(/[/\\]/).pop()));
        }
    });

    if (Object.keys(matchedGroups).length === 0) {
        alert("一致するファイルが1つもありません");
        return;
    }

    // 一部のファイルが一致しない場合はメッセージ表示
    if (Object.values(unmatchedFiles).some(files => files.length > 0)) {
        window.electronAPI.showUnmatchedFiles(unmatchedFiles);
    }

    updateDropdown();
    currentPrefix = Object.keys(matchedGroups)[0];
    showImages();
}

// プルダウンメニューを更新
function updateDropdown() {
    // 毎回リセット
    fileDropdown.innerHTML = "";

    Object.keys(matchedGroups).forEach(prefix => {
        const option = document.createElement("option");
        option.value = prefix;
        option.textContent = prefix;
        fileDropdown.appendChild(option);
    });

    fileDropdown.onchange = (event) => {
        currentPrefix = event.target.value;
        showImages();
    };
}

// 選択された画像を表示
function showImages() {
    imageContainer1.innerHTML = "";
    imageContainer2.innerHTML = "";

    matchedGroups[currentPrefix]?.folder1.forEach(imagePath => {
        const img = document.createElement("img");
        img.src = imagePath;
        img.addEventListener("click", () => enterFullscreen(img.src));
        imageContainer1.appendChild(img);
    });

    matchedGroups[currentPrefix]?.folder2.forEach(imagePath => {
        const img = document.createElement("img");
        img.src = imagePath;
        img.addEventListener("click", () => enterFullscreen(img.src));
        imageContainer2.appendChild(img);
    });

    fileDropdown.value = currentPrefix;

}

// 画像クリックでフルスクリーン表示
function enterFullscreen(imageSrc) {
    fullscreenImage.src = imageSrc;
    fullscreenContainer.classList.remove("hidden");

    zoomLevel = 1;
    moveX = 0;
    moveY = 0;
    //   fullscreenImage.style.transform = `translate(0px, 0px) scale(${zoomLevel})`;
    adjustImageSize(); // ウィンドウのサイズにフィット
}

// フルスクリーン終了
// ×ボタン
closeFullscreen.addEventListener("click", () => {
    fullscreenContainer.classList.add("hidden");
});
// 背面のマスク部分
fullscreenContainer.addEventListener("click", () => {
    fullscreenContainer.classList.add("hidden");
});

// ウィンドウサイズが変わったら画像サイズを調整
window.addEventListener("resize", adjustImageSize);

function adjustImageSize() {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const imgAspectRatio = fullscreenImage.naturalWidth / fullscreenImage.naturalHeight;
    const windowAspectRatio = windowWidth / windowHeight;

    if (imgAspectRatio > windowAspectRatio) {
        // 横長の画像は、横幅100%に合わせる
        fullscreenImage.style.width = "100vw";
        fullscreenImage.style.height = "auto";
    } else {
        // 縦長の画像は、縦幅100%に合わせる
        fullscreenImage.style.width = "auto";
        fullscreenImage.style.height = "100vh";
    }

    fullscreenImage.style.transform = `translate(0px, 0px) scale(${zoomLevel})`;
}

// ホイールでズーム
fullscreenContainer.addEventListener("wheel", (event) => {
    event.preventDefault();
    zoomLevel += event.deltaY * -0.01;
    zoomLevel = Math.min(Math.max(zoomLevel, 1), 5);
    fullscreenImage.style.transform = `translate(${moveX}px, ${moveY}px) scale(${zoomLevel})`;
});

// クリアボタンを押したときの処理
function clearSelection() {
    folder1Files = {};
    folder2Files = {};
    folder1Path = "";
    folder2Path = "";
    matchedGroups = {};
    currentPrefix = "";

    folder1Name.textContent = "";
    folder2Name.textContent = "";
    fileDropdown.innerHTML = "";
    imageContainer1.innerHTML = "";
    imageContainer2.innerHTML = "";

    // 初期UIに切り替え
    initialContainer.classList.remove("hidden");
    mainUiContainer.classList.add("hidden");
}

// 次の画像へ移動
function moveToNext() {
    const keys = Object.keys(matchedGroups);
    let currentIndex = keys.indexOf(currentPrefix);
    if (currentIndex < keys.length - 1) {
        currentPrefix = keys[currentIndex + 1];
        showImages();
    }
}
// 前の画像へ移動
function moveToPrev() {
    const keys = Object.keys(matchedGroups);
    let currentIndex = keys.indexOf(currentPrefix);
    if (currentIndex > 0) {
        currentPrefix = keys[currentIndex - 1];
        showImages();
    }
}
// 最初の画像へ移動
function moveToFirst() {
    const keys = Object.keys(matchedGroups);
    if (keys.length === 0) return;
    currentPrefix = keys[0];
    showImages();
}

// 最後の画像へ移動
function moveToLast() {
    const keys = Object.keys(matchedGroups);
    if (keys.length === 0) return;
    currentPrefix = keys[keys.length - 1];
    showImages();
}

// キーボード操作で画像切り替え
document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowRight") {
        moveToNext();
    } else if (event.key === "ArrowLeft") {
        moveToPrev();
    }
});

// 設定アイコンをクリックでモーダル表示
settingsIcon.addEventListener("click", () => {
    // モーダル表示
    settingsModal.classList.remove("hidden");
    // ラジオボタン設定
    document.querySelector(`input[name="matchMode"][value="${matchMode}"]`).checked = true;
    document.querySelector(`input[name="searchMode"][value="${searchMode}"]`).checked = true;
});

// モーダル外をクリックで閉じる
settingsModal.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
        settingsModal.classList.add("hidden");
    }
});

// 設定画面閉じるボタン
closeModal.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
});

// 再読み込みボタン
async function reloadAll() {
    folder1Files = {};
    folder2Files = {};
    matchedGroups = {};
    currentPrefix = "";

    await loadSettings();  // 設定を再ロード
}

// クリックイベント: 初期画面
loadSettingLink.addEventListener("click", () => loadSettings());
folderBtn.addEventListener("click", () => selectFolders("folder1"));

// クリックイベント: メニューバー
clearBtn.addEventListener("click", clearSelection);
reloadBtn.addEventListener("click", reloadAll);
nextBtn.addEventListener("click", moveToNext);
prevBtn.addEventListener("click", moveToPrev);
firstBtn.addEventListener("click", moveToFirst);
lastBtn.addEventListener("click", moveToLast);

// クリックイベント: ビューア
folder1Btn.addEventListener("click", () => selectFolders("folder1"));
folder2Btn.addEventListener("click", () => selectFolders("folder2"));

// 設定画面: ラジオボタン変更時に設定を更新
matchModeRadios.forEach(radio => {
    radio.addEventListener("change", (event) => {
        matchMode = event.target.value;
        window.electronAPI.updateSetting("matchMode", matchMode);
        // リロードを促すメッセージを表示
        settingsChaged.classList.remove("hidden");
    });
});
searchModeRadios.forEach(radio => {
    radio.addEventListener("change", (event) => {
        searchMode = event.target.value;
        window.electronAPI.updateSetting("searchMode", searchMode);
        // リロードを促すメッセージを表示
        settingsChaged.classList.remove("hidden");
    });
});