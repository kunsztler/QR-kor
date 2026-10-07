// ==============================
// QR KÖR
// ==============================


// ==============================
// HTML ELEMEK
// ==============================

const childrenList =
    document.getElementById("childrenList");

const message =
    document.getElementById("message");

const startScannerButton =
    document.getElementById("startScanner");

const stopScannerButton =
    document.getElementById("stopScanner");

const addChildButton =
    document.getElementById("addChildButton");

const childModal =
    document.getElementById("childModal");

const closeModal =
    document.getElementById("closeModal");

const childName =
    document.getElementById("childName");

const saveChildButton =
    document.getElementById("saveChildButton");


// ==============================
// ADATOK
// ==============================

let children =
    JSON.parse(
        localStorage.getItem("qrKorChildren")
    ) || [];

let scanner = null;

let scannerRunning = false;

let editingChildId = null;

let scanLocked = false;
let countdownHasExpired = false;
let lastScannedCode = null;
let scanNoDetectionFrames = 0;
const scanDelayStorageKey = "qrKorScanDelaySeconds";
const lapTimingModeStorageKey = "qrKorLapTimingMode";

// A köridőmérés a visszaszámláló indításával együtt indul.
let lapClockElapsedMs = 0;
let lapClockStartedAt = null;

function getLapClockElapsedMs() {
    return lapClockStartedAt === null
        ? lapClockElapsedMs
        : lapClockElapsedMs + (Date.now() - lapClockStartedAt);
}

function startLapClock() {
    if (lapClockStartedAt === null) lapClockStartedAt = Date.now();
}

function pauseLapClock() {
    if (lapClockStartedAt !== null) {
        lapClockElapsedMs += Date.now() - lapClockStartedAt;
        lapClockStartedAt = null;
    }
}

function resetLapClock() {
    lapClockElapsedMs = 0;
    lapClockStartedAt = null;
    children.forEach(child => { child.lastLapElapsedMs = null; });
    saveChildren();
}

function formatLapDuration(milliseconds) {
    const total = Math.max(0, Math.floor(milliseconds / 1000));
    const minutes = Math.floor(total / 60);
    const seconds = total % 60;
    const tenths = Math.floor((milliseconds % 1000) / 100);
    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${tenths}`;
}


// ==============================
// RÉGI KÓDOK ÁTALAKÍTÁSA
// ==============================

children = children.map(child => {

    if (
        child.id &&
        child.id.startsWith("GYEREK-")
    ) {

        const number =
            parseInt(
                child.id.replace("GYEREK-", ""),
                10
            );

        if (!isNaN(number)) {

            child.id =
                "KOD-" +
                String(number).padStart(2, "0");
        }
    }

    if (!Array.isArray(child.lapTimes)) child.lapTimes = [];
    if (typeof child.lastLapElapsedMs !== "number") child.lastLapElapsedMs = null;
    return child;
});

saveChildren();


// ==============================
// ADATOK MENTÉSE
// ==============================

function saveChildren() {

    localStorage.setItem(
        "qrKorChildren",
        JSON.stringify(children)
    );
}


// ==============================
// KÖVETKEZŐ KÓD
// ==============================

function getNextCode() {

    for (
        let number = 1;
        number <= 999;
        number++
    ) {

        const code =
            "KOD-" +
            String(number).padStart(2, "0");

        const exists =
            children.some(
                child => child.id === code
            );

        if (!exists) {

            return code;
        }
    }

    return null;
}


// ==============================
// GYEREK KERESÉSE
// ==============================

function normalizeQrCode(decodedText) {

    const raw = String(decodedText ?? "").trim();

    // Új QR-kódok: KOD-01, KOD-02, ...
    const kodMatch = raw.match(/^KOD[-_ ]?(\d{1,3})$/i);

    if (kodMatch) {
        return `KOD-${String(parseInt(kodMatch[1], 10)).padStart(2, "0")}`;
    }

    // Régi, korábban nyomtatott QR-kódok: GYEREK-004 stb.
    const oldMatch = raw.match(/^GYEREK[-_ ]?(\d{1,3})$/i);

    if (oldMatch) {
        return `KOD-${String(parseInt(oldMatch[1], 10)).padStart(2, "0")}`;
    }

    // Ha csak egy szám van a QR-kódban: 1 / 01 / 4 ...
    const numberMatch = raw.match(/^\d{1,3}$/);

    if (numberMatch) {
        return `KOD-${String(parseInt(raw, 10)).padStart(2, "0")}`;
    }

    return raw;
}


function findChild(id) {

    const code = normalizeQrCode(id);

    return children.find(
        child => child.id === code
    );
}


// ==============================
// HTML BIZTONSÁG
// ==============================

function escapeHtml(text) {

    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==============================
// GYEREKEK MEGJELENÍTÉSE
// ==============================

function renderChildren() {

    if (children.length === 0) {

        childrenList.innerHTML = `
            <p class="empty">
                Még nincs hozzáadott gyerek.
            </p>
        `;

        return;
    }


    childrenList.innerHTML = "";


    children.forEach(child => {

        const element =
            document.createElement("div");

        element.className = "child";
        element.tabIndex = 0;
        element.setAttribute("role", "button");
        element.setAttribute("aria-label", `${child.name} köridőinek megtekintése`);

        element.dataset.childId =
            child.id;


        element.innerHTML = `

            <div class="child-info">

                <div class="child-name">
                    ${escapeHtml(child.name)}
                </div>

                <div class="child-id">
                    ${child.id}
                </div>

            </div>

            <div class="child-laps">
                🏃 ${child.laps} kör
            </div>

            <div class="child-actions">

                <button
                    class="small-button qr-button"
                    data-action="qr"
                    data-id="${child.id}"
                >
                    📱 QR
                </button>

                <button
                    class="small-button edit-button"
                    data-action="edit"
                    data-id="${child.id}"
                >
                    ✏️
                </button>

                <button
                    class="small-button"
                    data-action="minus"
                    data-id="${child.id}"
                >
                    ➖
                </button>

                <button
                    class="small-button"
                    data-action="plus"
                    data-id="${child.id}"
                >
                    ➕
                </button>

                <button
                    class="small-button delete-button"
                    data-action="delete"
                    data-id="${child.id}"
                >
                    🗑️
                </button>

            </div>
        `;


        childrenList.appendChild(element);
    });
}


// ==============================
// GYEREKLISTA GOMBOK
// ==============================

childrenList.addEventListener(
    "click",
    event => {

        const button = event.target.closest("button");
        if (!button) {
            const card = event.target.closest(".child[data-child-id]");
            if (card) showChildLapTimes(card.dataset.childId);
            return;
        }


        const id =
            button.dataset.id;

        const action =
            button.dataset.action;


        if (action === "qr") {

            showQRCode(id);
        }


        if (action === "edit") {

            editChild(id);
        }


        if (action === "minus") {

            removeLap(id);
        }


        if (action === "plus") {

            addLap(id);
        }


        if (action === "delete") {

            deleteChild(id);
        }
    }
);

childrenList.addEventListener("keydown", event => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const card = event.target.closest(".child[data-child-id]");
    if (!card || event.target.closest("button")) return;
    event.preventDefault();
    showChildLapTimes(card.dataset.childId);
});

function showChildLapTimes(id) {
    const child = findChild(id);
    if (!child) return;
    const list = document.getElementById("lapTimesList");
    const title = document.getElementById("lapTimesTitle");
    title.textContent = `⏱️ ${child.name} – idő / köridő`;
    const times = Array.isArray(child.lapTimes) ? child.lapTimes : [];
    if (!times.length) {
        list.innerHTML = '<p class="lap-times-empty">Ehhez a gyerekhez még nincs rögzített QR-beolvasásos köridő.</p>';
    } else {
        list.innerHTML = times.map((entry, index) => {
            const elapsed = Number(entry.elapsedMs ?? entry.durationMs) || 0;
            const duration = Number(entry.durationMs ?? elapsed) || 0;
            return `
                <div class="lap-time-row">
                    <span>${index + 1}. kör</span>
                    <strong>${formatLapDuration(elapsed)} <span class="lap-duration-secondary">(${formatLapDuration(duration)})</span></strong>
                </div>
            `;
        }).join("");
    }
    document.getElementById("lapTimesModal").classList.add("active");
}

document.getElementById("closeLapTimes").addEventListener("click", () => {
    document.getElementById("lapTimesModal").classList.remove("active");
});
document.getElementById("lapTimesModal").addEventListener("click", event => {
    if (event.target.id === "lapTimesModal") event.currentTarget.classList.remove("active");
});

// ==============================
// ÚJ GYEREK
// ==============================

addChildButton.addEventListener(
    "click",
    () => {

        editingChildId = null;

        childName.value = "";

        childModal.querySelector(
            "h2"
        ).textContent =
            "➕ Új gyerek";

        saveChildButton.textContent =
            "💾 Gyerek mentése";

        childModal.classList.add(
            "active"
        );

        setTimeout(() => {

            childName.focus();

        }, 100);
    }
);


// ==============================
// MODAL BEZÁRÁSA
// ==============================

closeModal.addEventListener(
    "click",
    closeChildModal
);


function closeChildModal() {

    childModal.classList.remove(
        "active"
    );

    editingChildId = null;
}


// ==============================
// GYEREK MENTÉSE
// ==============================

saveChildButton.addEventListener(
    "click",
    saveChild
);


childName.addEventListener(
    "keydown",
    event => {

        if (event.key === "Enter") {

            saveChild();
        }
    }
);


function saveChild() {

    const name =
        childName.value.trim();


    if (!name) {

        alert(
            "Írd be a gyerek nevét!"
        );

        return;
    }


    // NÉV MÓDOSÍTÁSA

    if (editingChildId) {

        const child =
            findChild(
                editingChildId
            );


        if (child) {

            child.name = name;

            saveChildren();

            renderChildren();

            showMessage(
                `✏️ Név módosítva: ${name}`,
                "success"
            );
        }


        closeChildModal();

        return;
    }


    // ÚJ GYEREK

    const id =
        getNextCode();


    if (!id) {

        alert(
            "Nincs több szabad QR-kód!"
        );

        return;
    }


    children.push({

        id: id,

        name: name,

        laps: 0,
        lapTimes: [],
        lastLapElapsedMs: null

    });


    saveChildren();

    renderChildren();

    closeChildModal();


    showMessage(
        `✅ ${name} hozzáadva!<br>${id}`,
        "success"
    );
}


// ==============================
// NÉV SZERKESZTÉSE
// ==============================

function editChild(id) {

    const child =
        findChild(id);


    if (!child) return;


    editingChildId = id;

    childName.value =
        child.name;


    childModal.querySelector(
        "h2"
    ).textContent =
        `✏️ ${child.id} – név módosítása`;


    saveChildButton.textContent =
        "💾 Módosítás mentése";


    childModal.classList.add(
        "active"
    );


    setTimeout(() => {

        childName.focus();

        childName.select();

    }, 100);
}


// ==============================
// +1 KÖR
// ==============================

function addLap(id, recordTime = false) {

    const child =
        findChild(id);


    if (!child) {

        showMessage(
            "❌ Ismeretlen QR-kód!",
            "error"
        );

        return;
    }


    if (recordTime) {
        const elapsed = getLapClockElapsedMs();
        if (!Array.isArray(child.lapTimes)) child.lapTimes = [];
        const duration = child.lastLapElapsedMs === null || typeof child.lastLapElapsedMs !== "number"
            ? elapsed
            : Math.max(0, elapsed - child.lastLapElapsedMs);
        child.lapTimes.push({ elapsedMs: elapsed, durationMs: duration, recordedAt: new Date().toISOString() });
        child.lastLapElapsedMs = elapsed;
    }

    child.laps++;


    saveChildren();

    renderChildren();


    showMessage(
        `
        ✅ ${child.name}<br>
        +1 kör!<br>
        🏃 ${child.laps} kör
        `,
        "success"
    );
}


// ==============================
// -1 KÖR
// ==============================

function removeLap(id) {

    const child =
        findChild(id);


    if (!child) return;


    if (child.laps > 0) {

        child.laps--;

        saveChildren();

        renderChildren();
    }
}


// ==============================
// GYEREK TÖRLÉSE
// ==============================

function deleteChild(id) {

    const child =
        findChild(id);


    if (!child) return;


    const confirmed =
        confirm(
            `Biztosan törlöd ${child.name} adatait?`
        );


    if (!confirmed) return;


    children =
        children.filter(
            item => item.id !== id
        );


    saveChildren();

    renderChildren();
}


// ==============================
// ÜZENET
// ==============================

function showMessage(text, type = "") {
    message.innerHTML = text;
    message.className = type === "success" ? "scan-feedback scan-feedback-success" :
        type === "error" ? "scan-feedback scan-feedback-error" : "scan-feedback";
    void message.offsetWidth;
    if (type === "success") message.classList.add("scan-feedback-pop");

    const messageToken = String(Date.now()) + Math.random();
    message.dataset.messageToken = messageToken;
    setTimeout(() => {
        if (message.dataset.messageToken === messageToken) {
            message.innerHTML = "";
            message.className = "";
        }
    }, 2600);
}


// QR-KÓD MEGJELENÍTÉSE
// ==============================

function showQRCode(id) {

    const child =
        findChild(id);


    if (!child) return;


    const modal =
        document.createElement("div");

    modal.className =
        "modal active";


    modal.innerHTML = `

        <div class="modal-content qr-modal-content">

            <button
                class="close-button"
                id="closeQR"
            >
                ✕
            </button>

            <h2>
                📱 ${escapeHtml(child.name)}
            </h2>

            <div id="qrCode"></div>

            <p class="qr-code-label">
                ${child.id}
            </p>

            <button id="printQR">
                🖨️ Nyomtatás
            </button>

        </div>
    `;


    document.body.appendChild(modal);


    modal.querySelector(
        "#closeQR"
    ).addEventListener(
        "click",
        () => modal.remove()
    );


    modal.querySelector(
        "#printQR"
    ).addEventListener(
        "click",
        () => {

            printSingleQR(
                child.id
            );
        }
    );


    new QRCode(
        modal.querySelector(
            "#qrCode"
        ),
        {
            text: child.id,

            width: 250,

            height: 250,

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );
}


// ==============================
// EGY QR-KÓD NYOMTATÁSA
// NÉV NÉLKÜL
// ==============================

function printSingleQR(id) {

    const printWindow =
        window.open(
            "",
            "_blank"
        );


    if (!printWindow) {

        alert(
            "A böngésző blokkolta a felugró ablakot."
        );

        return;
    }


    printWindow.document.write(`

<!DOCTYPE html>

<html lang="hu">

<head>

<meta charset="UTF-8">

<title>${id}</title>

<style>

body {
    margin: 0;

    min-height: 100vh;

    display: flex;

    justify-content: center;

    align-items: center;

    font-family: Arial, sans-serif;
}

.container {
    text-align: center;
}

#qr {
    display: flex;

    justify-content: center;
}

.code {
    margin-top: 12px;

    font-size: 24px;

    font-weight: 900;

    letter-spacing: 2px;
}

</style>

</head>

<body>

<div class="container">

    <div id="qr"></div>

    <div class="code">
        ${id}
    </div>

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js">
<\/script>

<script>

new QRCode(
    document.getElementById("qr"),
    {
        text: "${id}",
        width: 300,
        height: 300,
        correctLevel:
            QRCode.CorrectLevel.H
    }
);

setTimeout(() => {

    window.print();

}, 500);

<\/script>

</body>

</html>

    `);


    printWindow.document.close();
}


// ==============================
// QR BEOLVASÁSA
// ==============================

function qrCodeScanned(
    decodedText
) {

    console.log(
        "QR-kód felismerve:",
        decodedText
    );

    if (countdownHasExpired) {
        return;
    }

    const code = normalizeQrCode(decodedText);

    if (scanLocked || code === lastScannedCode) {
        scanNoDetectionFrames = 0;
        return;
    }
    const child = findChild(code);

    if (!child) {
        showMessage(
            `❌ Ismeretlen QR-kód:<br>${escapeHtml(String(decodedText).trim())}`,
            "error"
        );

        lockScannerBriefly();
        return;
    }

    addLap(child.id, true);
    highlightChild(child.id);

    showMessage(
        `<span class="scan-name">🎉 ${escapeHtml(child.name)}</span>
         <span class="scan-plus">+1 KÖR!</span>
         <span class="scan-total">Összesen: ${child.laps} kör</span>`,
        "success"
    );

    lockScannerBriefly(code);
}


// ==============================
// BEOLVASOTT GYEREK KIEMELÉSE
// ==============================

function highlightChild(id) {

    const card =
        document.querySelector(
            `.child[data-child-id="${id}"]`
        );


    if (!card) return;


    card.classList.remove(
        "qr-success"
    );


    // Animáció újraindítása

    void card.offsetWidth;


    card.classList.add(
        "qr-success"
    );


    setTimeout(() => {

        card.classList.remove(
            "qr-success"
        );

    }, 900);
}


// ==============================
// DUPLA BEOLVASÁS VÉDELEM
// ==============================

function getScanDelayMs() {
    const value = Number.parseFloat(localStorage.getItem(scanDelayStorageKey) || "1.8");
    return Math.max(0, Math.min(10000, Number.isFinite(value) ? value * 1000 : 1800));
}

function lockScannerBriefly(code = null) {
    scanLocked = true;
    if (code !== null) {
        lastScannedCode = code;
        scanNoDetectionFrames = 0;
    }

    const delay = getScanDelayMs();
    setTimeout(() => {
        scanLocked = false;
        // Az azonos QR-kód továbbra is tiltott marad, amíg ki nem kerül a kameraképből.
    }, delay);
}

function noteScannerFrameWithoutQr() {
    if (lastScannedCode === null) return;
    scanNoDetectionFrames += 1;
    if (!scanLocked && scanNoDetectionFrames >= 5) {
        lastScannedCode = null;
        scanNoDetectionFrames = 0;
    }
}


// ==============================
// KAMERA INDÍTÁSA
// ==============================

async function startScanner() {

    if (scannerRunning) {

        return;
    }


    // ==========================
    // TELJES KÉPERNYŐ
    // ==========================

    try {

        if (
            !document.fullscreenElement &&
            document.documentElement.requestFullscreen
        ) {

            await document.documentElement.requestFullscreen();
        }

    }

    catch (error) {

        console.log(
            "A teljes képernyő nem indítható:",
            error
        );
    }


    // ==========================
    // QR SCANNER LÉTREHOZÁSA
    // ==========================

    scanner =
        new Html5Qrcode(
            "reader",
            {
                formatsToSupport: [
                    Html5QrcodeSupportedFormats.QR_CODE
                ]
            }
        );


    // ==========================
    // KAMERA INDÍTÁSA
    // ==========================

    try {

        await scanner.start(

            {
                facingMode: "user"
            },

            {
                fps: 10
                // NINCS qrbox és NINCS aspectRatio:
                // a teljes kameraképet vizsgáljuk.
            },

            decodedText => {
                qrCodeScanned(decodedText);
            },

            () => {
                // Ha a QR eltűnik a kameraképből, később ugyanaz a kód újra olvasható.
                noteScannerFrameWithoutQr();
            }
        );


        // ==========================
        // SIKERES INDÍTÁS
        // ==========================

        scannerRunning = true;


        startScannerButton.textContent =
            "📷 Beolvasás aktív – csak mutasd a QR-kódot!";


        startScannerButton.classList.add(
            "scanner-active"
        );


        stopScannerButton.style.display =
            "block";


        showMessage(
            "📷 Beolvasás aktív! Mutasd a QR-kódokat egymás után."
        );

        // A mérés és a visszaszámláló a sikeres kamerakezdéssel indul.
        if (typeof window.startActivityTimer === "function") {
            window.startActivityTimer();
        }
    }


    catch (error) {

        console.error(
            "Kamera indítási hiba:",
            error
        );


        scanner = null;

        scannerRunning = false;


        showMessage(
            "❌ Nem sikerült elindítani a kamerát.",
            "error"
        );
    }
}


// ==============================
// KAMERA LEÁLLÍTÁSA
// ==============================

async function stopScanner() {

    console.log(
        "Kamera leállítása..."
    );


    if (!scanner) {

        console.log(
            "Nincs aktív kamera."
        );

        return;
    }


    try {

        await scanner.stop();

        console.log(
            "Kamera sikeresen leállt."
        );

    }

    catch (error) {

        console.error(
            "Hiba a kamera leállításakor:",
            error
        );
    }


    try {

        scanner.clear();

    }

    catch (error) {

        console.log(
            "A scanner törlése nem volt szükséges."
        );
    }


    // A kamera leállítása egyben szünetelteti az időmérést és a visszaszámlálót.
    if (!countdownHasExpired && typeof window.pauseActivityTimer === "function") {
        window.pauseActivityTimer();
    }

    scanner = null;

    scannerRunning = false;

    scanLocked = false;
    lastScannedCode = null;
    scanNoDetectionFrames = 0;


    startScannerButton.textContent =
        "📷 Beolvasás indítása";


    startScannerButton.classList.remove(
        "scanner-active"
    );


    stopScannerButton.style.display =
        "none";


    // ==========================
    // TELJES KÉPERNYŐ KIKAPCSOLÁSA
    // ==========================

    if (document.fullscreenElement) {

        try {

            await document.exitFullscreen();

        }

        catch (error) {

            console.log(
                "Nem sikerült kilépni a teljes képernyőből."
            );
        }
    }


    showMessage(
        "⏹️ A kamera leállítva.",
        "success"
    );
}


// ==============================
// KAMERA GOMBOK
// ==============================

startScannerButton.addEventListener(
    "click",
    startScanner
);


stopScannerButton.addEventListener(
    "click",
    stopScanner
);


// ==================================================
// ⚙️ BEÁLLÍTÁSOK
// ==================================================


// ==============================
// BEÁLLÍTÁSOK GOMB
// ==============================

const settingsButton =
    document.getElementById(
        "settingsButton"
    );


// ==============================
// BEÁLLÍTÁSOK MODAL
// ==============================

// A modal már az index.html-ben szerepel.
// Nem hozunk létre belőle második példányt, így nem lesznek
// duplikált ID-k és a beállítások gomb mindig ugyanazt az ablakot kezeli.

const settingsModal =
    document.getElementById("settingsModal");

const closeSettings =
    document.getElementById("closeSettings");

const resetLapsButton =
    document.getElementById("resetLapsButton");

const printAllQRButton =
    document.getElementById("printAllQRButton");

const exportDataButton =
    document.getElementById("exportDataButton");

const importDataButton =
    document.getElementById("importDataButton");

const importFile =
    document.getElementById("importFile");

const deleteAllButton =
    document.getElementById("deleteAllButton");

// Kézi tablet nézet: eltároljuk az eszközön, hogy a következő megnyitáskor is megmaradjon.
const tabletModeToggle = document.getElementById("tabletModeToggle");
const scanDelayInput = document.getElementById("scanDelay");

const tabletModeStorageKey = "qrKorTabletMode";
const savedTabletMode = localStorage.getItem(tabletModeStorageKey) === "true";
document.body.classList.toggle("manual-tablet-layout", savedTabletMode);
tabletModeToggle.checked = savedTabletMode;
tabletModeToggle.addEventListener("change", () => {
    const enabled = tabletModeToggle.checked;
    document.body.classList.toggle("manual-tablet-layout", enabled);
    localStorage.setItem(tabletModeStorageKey, String(enabled));
});

const savedScanDelay = Number.parseFloat(localStorage.getItem(scanDelayStorageKey) || "1.8");
scanDelayInput.value = Number.isFinite(savedScanDelay) ? Math.max(0, Math.min(10, savedScanDelay)) : 1.8;
scanDelayInput.addEventListener("change", () => {
    const value = Number.parseFloat(scanDelayInput.value);
    const safe = Math.max(0, Math.min(10, Number.isFinite(value) ? value : 1.8));
    scanDelayInput.value = safe;
    localStorage.setItem(scanDelayStorageKey, String(safe));
});


// ==============================
// BEÁLLÍTÁSOK MEGNYITÁSA
// ==============================

settingsButton.addEventListener(
    "click",
    () => {
        settingsModal.classList.add("active");
    }
);


// ==============================
// BEÁLLÍTÁSOK BEZÁRÁSA
// ==============================

closeSettings.addEventListener(
    "click",
    () => {
        settingsModal.classList.remove("active");
    }
);

// ==============================
// KÖRÖK NULLÁZÁSA
// ==============================

resetLapsButton.addEventListener(
    "click",
    () => {

        if (children.length === 0) {

            alert(
                "Nincs egyetlen gyerek sem."
            );

            return;
        }


        const confirmed =
            confirm(
                "Biztosan nullázod minden gyerek körszámát?"
            );


        if (!confirmed) return;


        children.forEach(
            child => {

                child.laps = 0;
                child.lapTimes = [];
                child.lastLapElapsedMs = null;
            }
        );


        saveChildren();

        renderChildren();


        showMessage(
            "🔄 Minden kör nullázva!",
            "success"
        );
    }
);


// ==============================
// ÖSSZES GYEREK TÖRLÉSE
// ==============================

deleteAllButton.addEventListener(
    "click",
    () => {

        if (children.length === 0) {

            alert(
                "Nincs törölhető gyerek."
            );

            return;
        }


        const confirmed =
            confirm(
                "FIGYELEM!\n\nBiztosan törlöd az összes gyereket és minden körszámot?"
            );


        if (!confirmed) return;


        children = [];

        saveChildren();

        renderChildren();


        settingsModal.classList.remove(
            "active"
        );


        showMessage(
            "🗑️ Minden gyerek törölve.",
            "success"
        );
    }
);


// ==============================
// ADATOK MENTÉSE
// ==============================

exportDataButton.addEventListener(
    "click",
    () => {

        const data = {

            version: 1,

            date:
                new Date().toISOString(),

            children: children

        };


        const json =
            JSON.stringify(
                data,
                null,
                2
            );


        const blob =
            new Blob(
                [json],
                {
                    type:
                        "application/json"
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                "a"
            );


        link.href = url;

        link.download =
            "qr-kor-mentes.json";


        link.click();


        URL.revokeObjectURL(
            url
        );


        showMessage(
            "💾 Az adatok elmentve!",
            "success"
        );
    }
);


// ==============================
// ADATOK BETÖLTÉSE
// ==============================

importDataButton.addEventListener(
    "click",
    () => {

        importFile.click();
    }
);


importFile.addEventListener(
    "change",
    event => {

        const file =
            event.target.files[0];


        if (!file) return;


        const reader =
            new FileReader();


        reader.onload =
            event => {

                try {

                    const data =
                        JSON.parse(
                            event.target.result
                        );


                    if (
                        !data.children ||
                        !Array.isArray(
                            data.children
                        )
                    ) {

                        throw new Error(
                            "Hibás fájl."
                        );
                    }


                    const confirmed =
                        confirm(
                            "A betöltés felülírja a jelenlegi adatokat. Folytatod?"
                        );


                    if (!confirmed) {

                        return;
                    }


                    children =
                        data.children;


                    saveChildren();

                    renderChildren();


                    settingsModal.classList.remove(
                        "active"
                    );


                    showMessage(
                        "📂 Az adatok betöltve!",
                        "success"
                    );

                }

                catch (error) {

                    console.error(
                        error
                    );


                    alert(
                        "❌ Nem sikerült betölteni az adatokat."
                    );
                }
            };


        reader.readAsText(
            file
        );


        event.target.value = "";
    }
);


// ==============================
// ELŐRE GENERÁLT QR-KÓDOK – ELŐNÉZET ÉS PDF
// ==============================

printAllQRButton.addEventListener("click", () => {
    const countInput = document.getElementById("qrBatchCount");
    const requestedCount = Number.parseInt(countInput?.value, 10);

    if (!Number.isInteger(requestedCount) || requestedCount < 1 || requestedCount > 500) {
        alert("1 és 500 közötti darabszámot adj meg.");
        return;
    }

    // Ugyanazt a szabad kódsorrendet használjuk, mint az új gyerekek felvétele.
    const usedCodes = new Set(children.map(child => child.id));
    const codes = [];
    for (let number = 1; number <= 999 && codes.length < requestedCount; number++) {
        const code = `KOD-${String(number).padStart(2, "0")}`;
        if (!usedCodes.has(code)) codes.push(code);
    }

    if (codes.length !== requestedCount) {
        alert("Nem sikerült a kért mennyiségű szabad kódot létrehozni.");
        return;
    }

    const previewWindow = window.open("", "_blank");
    if (!previewWindow) {
        alert("A böngésző blokkolta az előnézeti ablakot. Engedélyezd a felugró ablakokat ehhez az oldalhoz.");
        return;
    }

    const safeCodes = JSON.stringify(codes).replace(/</g, "\\u003c");
    previewWindow.document.open();
    previewWindow.document.write(`<!DOCTYPE html>
<html lang="hu">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR-kódok előnézete</title>
<style>
*{box-sizing:border-box}body{margin:0;padding:20px;background:#eef2f7;color:#17314c;font-family:Arial,sans-serif}
.toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;background:#fff;padding:14px 18px;border-radius:12px;box-shadow:0 3px 14px #0001;margin:0 auto 20px;max-width:1100px}
.toolbar button{border:0;border-radius:8px;padding:12px 18px;background:#147d43;color:#fff;font-weight:700;cursor:pointer}.toolbar .secondary{background:#245f91}.toolbar p{margin:0}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;max-width:1100px;margin:auto}
.card{background:white;border:1px solid #d7e0ea;border-radius:10px;padding:14px;text-align:center;break-inside:avoid;display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:220px}
.qr{width:160px;height:160px;display:flex;align-items:center;justify-content:center}.qr canvas,.qr img{width:160px!important;height:160px!important}.code{font-size:19px;font-weight:800;letter-spacing:1px;margin-top:8px}
@media(max-width:650px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.qr,.qr canvas,.qr img{width:125px!important;height:125px!important}.card{min-height:185px}}
@page{size:A4 landscape;margin:8mm}@media print{body{background:#fff;padding:0}.toolbar{display:none}.grid{gap:5mm;grid-template-columns:repeat(4,1fr);max-width:none}.card{border:1px solid #bbb;border-radius:0;min-height:58mm;padding:2mm;break-inside:avoid}.qr,.qr canvas,.qr img{width:48mm!important;height:48mm!important}.code{font-size:13pt;margin-top:2mm}}
</style>
</head><body>
<div class="toolbar"><p><strong>${requestedCount} QR-kód</strong> előnézete · A kódok név nélkül készülnek.</p><div><button id="downloadPdf">PDF letöltése</button> <button class="secondary" onclick="window.print()">Nyomtatás</button></div></div>
<div class="grid" id="qrGrid"></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"><\/script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"><\/script>
<script>
const codes = ${safeCodes};
const grid = document.getElementById('qrGrid');
codes.forEach(code => {
 const card=document.createElement('div'); card.className='card';
 const qr=document.createElement('div'); qr.className='qr';
 const label=document.createElement('div'); label.className='code'; label.textContent=code;
 card.append(qr,label); grid.appendChild(card);
 new QRCode(qr,{text:code,width:320,height:320,correctLevel:QRCode.CorrectLevel.H});
});
document.getElementById('downloadPdf').addEventListener('click', async () => {
 const button=document.getElementById('downloadPdf'); button.disabled=true; button.textContent='PDF készül…';
 try {
  if(!window.jspdf?.jsPDF) throw new Error('A PDF-készítő könyvtár nem töltődött be. Ellenőrizd az internetkapcsolatot.');
  const {jsPDF}=window.jspdf; const pdf=new jsPDF({orientation:'landscape',unit:'mm',format:'a4'});
  const margin=8, cols=4, rows=3, gapX=5, gapY=4, cellW=(297-2*margin-3*gapX)/cols, cellH=(210-2*margin-2*gapY)/rows, qrSize=48;
  for(let i=0;i<codes.length;i++){
   if(i>0 && i%(cols*rows)===0) pdf.addPage();
   const col=i%cols, row=Math.floor((i%(cols*rows))/cols), x=margin+col*(cellW+gapX), y=margin+row*(cellH+gapY);
   const canvas=grid.children[i].querySelector('canvas');
   if(!canvas) throw new Error('Nem sikerült elkészíteni az egyik QR-kód képét.');
   const qx=x+(cellW-qrSize)/2, qy=y+3;
   pdf.addImage(canvas.toDataURL('image/png'),'PNG',qx,qy,qrSize,qrSize);
   pdf.setFont('helvetica','bold'); pdf.setFontSize(12); pdf.text(codes[i],x+cellW/2,qy+qrSize+7,{align:'center'});
   pdf.setDrawColor(205,215,225); pdf.roundedRect(x,y,cellW,cellH,2,2,'S');
  }
  pdf.save('QR-kodok-'+codes.length+'-db.pdf');
 } catch(error) { alert(error.message || 'A PDF készítése nem sikerült.'); }
 finally { button.disabled=false; button.textContent='PDF letöltése'; }
});
<\/script>
</body></html>`);
    previewWindow.document.close();
});


// ==============================
// INDULÁS
// ==============================

renderChildren();

// ==============================
// VISSZASZÁMLÁLÓ
// ==============================
(() => {
    const display = document.getElementById("countdownDisplay");
    const minutesInput = document.getElementById("countdownMinutes");
    const secondsInput = document.getElementById("countdownSeconds");
    const startButton = document.getElementById("countdownStart");
    const pauseButton = document.getElementById("countdownPause");
    const resetButton = document.getElementById("countdownReset");
    const status = document.getElementById("countdownStatus");
    if (!display || !minutesInput || !secondsInput || !startButton || !pauseButton || !resetButton || !status) return;

    const readDurationSeconds = () => {
        const mins = Math.min(180, Math.max(0, Number.parseInt(minutesInput.value, 10) || 0));
        const secs = Math.min(59, Math.max(0, Number.parseInt(secondsInput.value, 10) || 0));
        minutesInput.value = mins;
        secondsInput.value = secs;
        return mins * 60 + secs;
    };

    let remainingSeconds = readDurationSeconds() || 600;
    if (remainingSeconds === 600 && Number(minutesInput.value) === 0 && Number(secondsInput.value) === 0) {
        minutesInput.value = 10;
        secondsInput.value = 0;
    }
    let intervalId = null;
    let endAt = 0;

    const formatTime = seconds => {
        const safe = Math.max(0, Math.ceil(seconds));
        return `${String(Math.floor(safe / 60)).padStart(2, "0")}:${String(safe % 60).padStart(2, "0")}`;
    };
    const render = () => {
        display.textContent = formatTime(remainingSeconds);
        display.classList.toggle("countdown-warning", remainingSeconds <= 60 && remainingSeconds > 0);
        display.classList.toggle("countdown-finished", remainingSeconds <= 0);
    };
    const stopInterval = () => {
        if (intervalId !== null) clearInterval(intervalId);
        intervalId = null;
    };
    const tick = () => {
        remainingSeconds = Math.max(0, (endAt - Date.now()) / 1000);
        render();
        if (remainingSeconds <= 0) {
            stopInterval();
            countdownHasExpired = true;
            pauseLapClock();
            void stopScanner();
            startButton.disabled = false;
            pauseButton.disabled = true;
            minutesInput.disabled = false;
            secondsInput.disabled = false;
            status.textContent = "⏰ Lejárt az idő!";
        }
    };
    const startActivityTimer = () => {
        if (intervalId !== null) return;
        if (remainingSeconds <= 0) {
            remainingSeconds = readDurationSeconds();
        }
        if (remainingSeconds <= 0) {
            remainingSeconds = 60;
            minutesInput.value = 1;
            secondsInput.value = 0;
        }
        countdownHasExpired = false;
        endAt = Date.now() + remainingSeconds * 1000;
        startLapClock();
        intervalId = setInterval(tick, 100);
        startButton.disabled = true;
        pauseButton.disabled = false;
        minutesInput.disabled = true;
        secondsInput.disabled = true;
        status.textContent = "Visszaszámlálás folyamatban…";
        tick();
    };

    const pauseActivityTimer = () => {
        if (intervalId === null) return;
        tick();
        stopInterval();
        pauseLapClock();
        startButton.disabled = false;
        pauseButton.disabled = true;
        minutesInput.disabled = false;
        secondsInput.disabled = false;
        status.textContent = "Szüneteltetve. A folytatáshoz nyomd meg az Indítást.";
    };

    // A kamera és az időmérés mostantól együtt működik.
    window.startActivityTimer = startActivityTimer;
    window.pauseActivityTimer = pauseActivityTimer;

    // Az Indítás gomb is a kamerát indítja: sikeres kamerakezdés után indul az idő.
    startButton.addEventListener("click", () => {
        if (typeof startScanner === "function") startScanner();
    });

    // A Szünet gomb a kamerát is leállítja, így az időmérés is szünetel.
    pauseButton.addEventListener("click", () => {
        if (scannerRunning) {
            void stopScanner();
        } else {
            pauseActivityTimer();
        }
    });
    resetButton.addEventListener("click", () => {
        stopInterval();
        countdownHasExpired = false;
        resetLapClock();
        remainingSeconds = readDurationSeconds();
        if (remainingSeconds <= 0) {
            remainingSeconds = 60;
            minutesInput.value = 1;
            secondsInput.value = 0;
        }
        startButton.disabled = false;
        pauseButton.disabled = true;
        minutesInput.disabled = false;
        secondsInput.disabled = false;
        status.textContent = "Visszaszámláló visszaállítva.";
        render();
    });
    const timeInputChanged = () => {
        if (intervalId !== null) return;
        remainingSeconds = readDurationSeconds();
        status.textContent = "Készen áll az indításra.";
        render();
    };
    minutesInput.addEventListener("change", timeInputChanged);
    secondsInput.addEventListener("change", timeInputChanged);
    render();
})();
