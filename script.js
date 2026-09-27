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
        number <= 99;
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
    title.textContent = `⏱️ ${child.name} – köridők`;
    const times = Array.isArray(child.lapTimes) ? child.lapTimes : [];
    if (!times.length) {
        list.innerHTML = '<p class="lap-times-empty">Ehhez a gyerekhez még nincs rögzített QR-beolvasásos köridő.</p>';
    } else {
        list.innerHTML = times.map((entry, index) => `
            <div class="lap-time-row">
                <span>${index + 1}. kör</span>
                <strong>${formatLapDuration(Number(entry.durationMs) || 0)}</strong>
            </div>
        `).join("");
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
        child.lapTimes.push({ durationMs: duration, recordedAt: new Date().toISOString() });
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

    if (scanLocked) {
        return;
    }

    const code = normalizeQrCode(decodedText);
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

    lockScannerBriefly();
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

function lockScannerBriefly() {

    scanLocked = true;


    setTimeout(() => {

        scanLocked = false;

    }, 1800);
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
                // Sikertelen képkocka – folytatjuk a keresést.
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


    scanner = null;

    scannerRunning = false;

    scanLocked = false;


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
// ÖSSZES QR-KÓD NYOMTATÁSA
// NÉV NÉLKÜL
// ==============================

printAllQRButton.addEventListener(
    "click",
    () => {

        if (children.length === 0) {

            alert(
                "Nincs egyetlen gyerek sem."
            );

            return;
        }


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

<title>QR-kódok</title>

<style>

body {
    font-family: Arial, sans-serif;
    margin: 20px;
}

.qr-grid {
    display: grid;

    grid-template-columns:
        repeat(3, 1fr);

    gap: 20px;
}

.qr-card {
    border: 2px solid #222;

    border-radius: 12px;

    padding: 15px;

    text-align: center;

    page-break-inside: avoid;
}

.qr-code {
    display: flex;

    justify-content: center;
}

.code-label {
    margin-top: 10px;

    font-size: 22px;

    font-weight: 900;

    letter-spacing: 2px;
}

@media print {

    body {
        margin: 10px;
    }

    .qr-grid {
        gap: 12px;
    }
}

</style>

</head>

<body>

<div class="qr-grid">

        `);


        children.forEach(
            child => {

                printWindow.document.write(`

<div class="qr-card">

    <div
        class="qr-code"
        id="qr-${child.id}"
    ></div>

    <div class="code-label">
        ${child.id}
    </div>

</div>

                `);
            }
        );


        printWindow.document.write(`

</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js">
<\/script>

<script>

const children =
    ${JSON.stringify(children)};

children.forEach(child => {

    new QRCode(
        document.getElementById(
            "qr-" + child.id
        ),
        {
            text: child.id,

            width: 180,

            height: 180,

            correctLevel:
                QRCode.CorrectLevel.H
        }
    );

});

setTimeout(() => {

    window.print();

}, 700);

<\/script>

</body>

</html>

        `);


        printWindow.document.close();
    }
);


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
    const startButton = document.getElementById("countdownStart");
    const pauseButton = document.getElementById("countdownPause");
    const resetButton = document.getElementById("countdownReset");
    const status = document.getElementById("countdownStatus");
    if (!display || !minutesInput || !startButton || !pauseButton || !resetButton || !status) return;

    let remainingSeconds = 600;
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
        remainingSeconds = Math.max(0, Math.ceil((endAt - Date.now()) / 1000));
        render();
        if (remainingSeconds <= 0) {
            stopInterval();
            startButton.disabled = false;
            pauseButton.disabled = true;
            minutesInput.disabled = false;
            status.textContent = "⏰ Lejárt az idő!";
            pauseLapClock();
        }
    };
    startButton.addEventListener("click", () => {
        if (intervalId !== null) return;
        if (remainingSeconds <= 0) {
            const mins = Math.min(180, Math.max(1, Number.parseInt(minutesInput.value, 10) || 10));
            minutesInput.value = mins;
            remainingSeconds = mins * 60;
        }
        endAt = Date.now() + remainingSeconds * 1000;
        startLapClock();
        intervalId = setInterval(tick, 200);
        startButton.disabled = true;
        pauseButton.disabled = false;
        minutesInput.disabled = true;
        status.textContent = "Visszaszámlálás folyamatban…";
        tick();
    });
    pauseButton.addEventListener("click", () => {
        if (intervalId === null) return;
        tick();
        stopInterval();
        pauseLapClock();
        startButton.disabled = false;
        pauseButton.disabled = true;
        minutesInput.disabled = false;
        status.textContent = "Szüneteltetve. A folytatáshoz nyomd meg az Indítást.";
    });
    resetButton.addEventListener("click", () => {
        stopInterval();
        countdownHasExpired = false;
        resetLapClock();
        const mins = Math.min(180, Math.max(1, Number.parseInt(minutesInput.value, 10) || 10));
        minutesInput.value = mins;
        remainingSeconds = mins * 60;
        startButton.disabled = false;
        pauseButton.disabled = true;
        minutesInput.disabled = false;
        status.textContent = "Visszaszámláló visszaállítva.";
        render();
    });
    minutesInput.addEventListener("change", () => {
        if (intervalId !== null) return;
        const mins = Math.min(180, Math.max(1, Number.parseInt(minutesInput.value, 10) || 10));
        minutesInput.value = mins;
        remainingSeconds = mins * 60;
        status.textContent = "Készen áll az indításra.";
        render();
    });
    render();
})();
