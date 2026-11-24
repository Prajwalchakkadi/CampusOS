
const API_URL = window.location.origin;

const $ = (id) => document.getElementById(id);

const email = sessionStorage.getItem("userEmail");
const role = sessionStorage.getItem("userRole");

let cameraStream = null;
let qrStream = null;
let qrScanActive = false;
let qrAnimationFrame = null;
let qrDetector = null;
let qrRequestInProgress = false;

// ==========================================
// AUTHENTICATION
// ==========================================

function checkStudentLogin() {
    const token = sessionStorage.getItem("token");

    if (!token || role !== "Student") {
        alert("Please log in using your student account.");
        window.location.href = "index.html";
        return false;
    }

    return true;
}

// ==========================================
// HELPERS
// ==========================================

function setText(id, value, fallback = "Not provided") {
    const element = $(id);

    if (element) {
        element.textContent =
            value === undefined || value === null || value === ""
                ? fallback
                : String(value);
    }
}

function showToast(message) {
    const toast = $("toast");

    if (!toast) {
        console.log(message);
        return;
    }

    toast.textContent = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2500);
}

// ==========================================
// FIREBASE API REQUEST
// ==========================================

async function apiRequest(path, options = {}) {
    const currentToken = sessionStorage.getItem("token");

    if (!currentToken) {
        throw new Error("Session expired. Please log in again.");
    }

    const response = await fetch(`${API_URL}${path}`, {
        ...options,
        headers: {
            Authorization: `Bearer ${currentToken}`,
            "Content-Type": "application/json",
            ...(options.headers || {})
        }
    });

    const raw = await response.text();
    let data = {};

    try {
        data = raw ? JSON.parse(raw) : {};
    } catch {
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok) {
        throw new Error(
            `HTTP ${response.status}: ${
                data.message || raw || "Request failed."
            }`
        );
    }

    return data;
}

// ==========================================
// ATTENDANCE SUMMARY
// ==========================================

function renderSummary(summary = {}) {
    const percentage = Number(
        summary.attendancePercentage || 0
    );

    const safePercentage = Math.max(
        0,
        Math.min(100, percentage)
    );

    setText("attendancePercentage", `${safePercentage}%`);
    setText("ringValue", `${safePercentage}%`);
    setText("totalClasses", summary.totalClasses || 0);
    setText("presentClasses", summary.presentClasses || 0);
    setText("absentClasses", summary.absentClasses || 0);
    setText("legendPresent", summary.presentClasses || 0);
    setText("legendAbsent", summary.absentClasses || 0);

    const ring = $("attendanceRing");

    if (ring) {
        ring.style.background =
            `conic-gradient(#10B981 ${
                safePercentage * 3.6
            }deg, #E5F2E9 0deg)`;
    }
}

// ==========================================
// ATTENDANCE TABLES
// ==========================================

function addCell(row, value) {
    const cell = document.createElement("td");
    cell.textContent = value ?? "—";
    row.appendChild(cell);
}

function renderAttendanceRecords(records = []) {
    const recordBody = $("attendanceRecords");
    const subjectBody = $("subjectAttendance");

    if (!recordBody || !subjectBody) return;

    recordBody.replaceChildren();
    subjectBody.replaceChildren();

    if (!records.length) {
        recordBody.innerHTML =
            '<tr><td colspan="4">No attendance records available.</td></tr>';

        subjectBody.innerHTML =
            '<tr><td colspan="3">No subject records available.</td></tr>';

        return;
    }

    const subjects = new Map();

    records.forEach(record => {
        const subject = record.subject || "Unknown";

        if (!subjects.has(subject)) {
            subjects.set(subject, {
                present: 0,
                total: 0
            });
        }

        const item = subjects.get(subject);
        item.total++;

        if (
            String(record.status).toLowerCase() === "present"
        ) {
            item.present++;
        }
    });

    subjects.forEach((item, subject) => {
        const row = document.createElement("tr");

        addCell(row, subject);
        addCell(row, `${item.present} / ${item.total}`);
        addCell(
            row,
            `${Math.round(
                item.present / item.total * 100
            )}%`
        );

        subjectBody.appendChild(row);
    });

    records.slice().reverse().forEach(record => {
        const row = document.createElement("tr");

        addCell(row, record.subject);
        addCell(row, record.classType);
        addCell(row, record.date);

        const cell = document.createElement("td");
        const pill = document.createElement("span");

        const present =
            String(record.status).toLowerCase() === "present";

        pill.className = present
            ? "status-pill present"
            : "status-pill absent";

        pill.textContent = record.status || "Unknown";

        cell.appendChild(pill);
        row.appendChild(cell);

        recordBody.appendChild(row);
    });
}

// ==========================================
// LOAD ATTENDANCE
// ==========================================

async function loadAttendance() {
    try {
        setText("attendanceMessage", "Loading attendance...");

        const data = await apiRequest(
            "/api/student/attendance"
        );

        renderSummary(data.summary || {});
        renderAttendanceRecords(data.records || []);

        setText(
            "attendanceMessage",
            `${(data.records || []).length} attendance records loaded.`
        );

    } catch (error) {
        console.error(error);

        setText("attendanceMessage", error.message);
        renderAttendanceRecords([]);
    }
}

// ==========================================
// FACE ENROLLMENT STATUS
// ==========================================

async function loadFaceStatus() {
    try {
        const data = await apiRequest(
            "/api/student/face-enrollment"
        );

        if (data.enrolled) {
            setText(
                "faceMessage",
                "Face enrollment is verified."
            );
        } else if (data.status === "pending_provider") {
            setText(
                "faceMessage",
                "Consent received. Secure verification provider is pending."
            );
        } else if (data.status === "demo_account") {
            setText(
                "faceMessage",
                "Face enrollment is unavailable for demo accounts."
            );
        } else {
            setText(
                "faceMessage",
                data.message || "Face enrollment not completed."
            );
        }

    } catch (error) {
        setText("faceMessage", error.message);
    }
}

// ==========================================
// LOAD PAGE
// ==========================================

async function loadAttendancePage() {
    setText("connectionLabel", "Connecting");

    try {
        await Promise.all([
            loadAttendance(),
            loadFaceStatus()
        ]);

        setText("connectionLabel", "Connected");

    } catch (error) {
        setText("connectionLabel", error.message);
    }
}

// ==========================================
// FACE CAMERA
// ==========================================

function stopCamera() {
    if (cameraStream) {
        cameraStream.getTracks().forEach(track => track.stop());
        cameraStream = null;
    }

    const video = $("faceVideo");

    if (video) {
        video.pause();
        video.srcObject = null;
        video.style.display = "none";
    }
}

async function startFaceCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Camera requires HTTPS or localhost.");
    }

    stopCamera();

    cameraStream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: "user"
        },
        audio: false
    });

    const video = $("faceVideo");

    if (!video) {
        stopCamera();
        throw new Error("Face camera video element not found.");
    }

    video.style.display = "block";
    video.srcObject = cameraStream;

    await video.play();
}

if ($("startCameraBtn")) {
    $("startCameraBtn").addEventListener("click", async () => {
        try {
            await startFaceCamera();

            setText(
                "faceMessage",
                "Camera preview active. This is not identity verification."
            );

        } catch (error) {
            setText("faceMessage", error.message);
        }
    });
}

if ($("stopCameraBtn")) {
    $("stopCameraBtn").addEventListener("click", () => {
        stopCamera();
        setText("faceMessage", "Camera stopped.");
    });
}

// ==========================================
// FACE CONSENT
// ==========================================

if ($("enrollFaceBtn")) {
    $("enrollFaceBtn").addEventListener("click", async () => {
        const consentCheckbox = $("faceConsent");

        if (!consentCheckbox || !consentCheckbox.checked) {
            setText(
                "faceMessage",
                "Please accept the consent first."
            );
            return;
        }

        const button = $("enrollFaceBtn");
        button.disabled = true;

        try {
            const data = await apiRequest(
                "/api/student/face-enrollment/consent",
                {
                    method: "POST",
                    body: JSON.stringify({
                        consent: true
                    })
                }
            );

            setText(
                "faceMessage",
                data.message || "Consent submitted."
            );

            await loadFaceStatus();

        } catch (error) {
            setText("faceMessage", error.message);

        } finally {
            button.disabled = false;
        }
    });
}

// ==========================================
// QR CAMERA STOP
// ==========================================

function stopQRScanner() {
    qrScanActive = false;

    if (qrAnimationFrame) {
        cancelAnimationFrame(qrAnimationFrame);
        qrAnimationFrame = null;
    }

    if (qrStream) {
        qrStream.getTracks().forEach(track => track.stop());
        qrStream = null;
    }

    const video = $("qrVideo");

    if (video) {
        video.pause();
        video.srcObject = null;
        video.style.display = "none";
    }
}

// ==========================================
// PROCESS QR
// ==========================================

async function processAttendanceQR(rawValue) {
    if (qrRequestInProgress) return;

    qrRequestInProgress = true;
    stopQRScanner();

    setText(
        "qrScanMessage",
        "Validating classroom QR code..."
    );

    try {
        let payload;

        try {
            payload = JSON.parse(rawValue);
        } catch {
            throw new Error("Invalid CampusOS attendance QR code.");
        }

        if (!payload.sessionId || !payload.qrToken) {
            throw new Error(
                "QR code does not contain a valid session ID and token."
            );
        }

        const result = await apiRequest(
            "/api/student/attendance/scan",
            {
                method: "POST",
                body: JSON.stringify({
                    sessionId: payload.sessionId,
                    qrToken: payload.qrToken
                })
            }
        );

        if (
            result.success &&
            result.stage === "face_verification_required"
        ) {
            setText(
                "qrScanMessage",
                "QR validated. Opening face camera..."
            );

            await startFaceCamera();

            setText(
                "faceMessage",
                "Camera preview active. Real face matching and liveness verification are not connected. Attendance has NOT been marked."
            );

            setText(
                "qrScanMessage",
                "QR validated. Attendance is pending secure face verification."
            );

            showToast("QR validated. Attendance is not yet marked.");

        } else {
            setText(
                "qrScanMessage",
                result.message || "Attendance request processed."
            );
        }

    } catch (error) {
        console.error("QR attendance:", error);

        setText("qrScanMessage", error.message);
        showToast(error.message);

    } finally {
        qrRequestInProgress = false;
    }
}

// ==========================================
// SCAN QR FRAMES
// ==========================================

async function scanQRFrame() {
    if (!qrScanActive) return;

    const video = $("qrVideo");

    if (
        video &&
        video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA
    ) {
        try {
            const results = await qrDetector.detect(video);

            if (results.length > 0) {
                await processAttendanceQR(
                    results[0].rawValue
                );
                return;
            }

        } catch (error) {
            console.error("QR detection error:", error);
        }
    }

    if (qrScanActive) {
        qrAnimationFrame = requestAnimationFrame(scanQRFrame);
    }
}

// ==========================================
// START QR SCANNER
// ==========================================

async function startQRScanner() {
    try {
        if (
            !sessionStorage.getItem("token") ||
            sessionStorage.getItem("userRole") !== "Student"
        ) {
            throw new Error("Please log in as a student.");
        }

        if (!("BarcodeDetector" in window)) {
            throw new Error(
                "QR scanning is not supported. Use an updated Chrome browser."
            );
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            throw new Error(
                "Camera access requires HTTPS or localhost."
            );
        }

        if (!qrDetector) {
            qrDetector = new BarcodeDetector({
                formats: ["qr_code"]
            });
        }

        stopQRScanner();

        const video = $("qrVideo");

        if (!video) {
            throw new Error("QR camera video element not found.");
        }

        video.style.display = "block";

        qrStream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: {
                    ideal: "environment"
                }
            },
            audio: false
        });

        video.srcObject = qrStream;
        await video.play();

        qrScanActive = true;

        setText(
            "qrScanMessage",
            "Camera active. Point it at your teacher's QR code."
        );

        scanQRFrame();

    } catch (error) {
        stopQRScanner();
        setText("qrScanMessage", error.message);
    }
}

if ($("startQRScannerBtn")) {
    $("startQRScannerBtn").addEventListener(
        "click",
        startQRScanner
    );
}

if ($("stopQRScannerBtn")) {
    $("stopQRScannerBtn").addEventListener("click", () => {
        stopQRScanner();
        setText("qrScanMessage", "QR scanner stopped.");
    });
}

// ==========================================
// SIDEBAR
// ==========================================

if ($("menuBtn")) {
    $("menuBtn").addEventListener("click", () => {
        $("sidebar")?.classList.toggle("open");
    });
}

// ==========================================
// LOGOUT
// ==========================================

if ($("logoutBtn")) {
    $("logoutBtn").addEventListener("click", () => {
        stopCamera();
        stopQRScanner();

        sessionStorage.clear();
        window.location.href = "index.html";
    });
}

// ==========================================
// START
// ==========================================

if (checkStudentLogin()) {
    loadAttendancePage();
}

