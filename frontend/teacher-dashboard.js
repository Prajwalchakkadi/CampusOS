const token = sessionStorage.getItem("token");

const statusMessage = document.getElementById("status");
const sessionMessage = document.getElementById("sessionMessage");

let countdownInterval = null;

// CHECK TEACHER LOGIN
if (!token) {
    alert("Please login as a teacher first!");
    window.location.href = "index.html";
}

// LOAD TEACHER INFORMATION AND SESSIONS
async function loadTeacherDashboard() {

    try {

        const response = await fetch(
            "http://localhost:5000/api/teacher/sessions",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load sessions");
        }

        document.getElementById("teacherName").textContent =
            sessionStorage.getItem("userName") || "Demo Teacher";

        document.getElementById("teacherEmail").textContent =
            sessionStorage.getItem("userEmail") || "teacher@campusos.test";

        document.getElementById("teacherRole").textContent = "Teacher";

        statusMessage.textContent =
            "Connected successfully to CampusOS!";

        displaySessions(data.sessions);

    } catch (error) {

        statusMessage.textContent = error.message;
        console.error(error);

    }
}

// CREATE ATTENDANCE SESSION
document.getElementById("sessionForm")
.addEventListener("submit", async function(event) {

    event.preventDefault();

    const subject =
        document.getElementById("subject").value.trim();

    const classType =
        document.getElementById("classType").value;

    const classroom =
        document.getElementById("classroom").value.trim();

    const createBtn = document.getElementById("createBtn");

    createBtn.disabled = true;
    createBtn.textContent = "Creating...";

    try {

        const response = await fetch(
            "http://localhost:5000/api/teacher/sessions",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    subject,
                    classType,
                    classroom
                })
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Session creation failed");
        }

        sessionMessage.textContent =
            "Attendance session created successfully!";

        document.getElementById("sessionForm").reset();

        // Reload sessions to display the generated QR code
        await loadTeacherDashboard();

    } catch (error) {

        sessionMessage.textContent = error.message;
        console.error(error);

    } finally {

        createBtn.disabled = false;
        createBtn.textContent = "Create Attendance Session";

    }

});

// DISPLAY SESSIONS AND QR CODES
function displaySessions(sessions) {

    const sessionsList =
        document.getElementById("sessionsList");

    sessionsList.innerHTML = "";

    if (countdownInterval) {
        clearInterval(countdownInterval);
    }

    if (!sessions || sessions.length === 0) {

        sessionsList.textContent =
            "No attendance sessions created yet.";

        return;
    }

    sessions.forEach(session => {

        const card = document.createElement("div");
        card.className = "session-card";

        const title = document.createElement("h3");
        title.textContent = session.subject || "Unknown Subject";

        const type = document.createElement("p");
        type.textContent = "Class Type: " + session.classType;

        const room = document.createElement("p");
        room.textContent = "Classroom: " + session.classroom;

        const code = document.createElement("p");
        code.textContent = "Session Code: " + session.sessionCode;

        const status = document.createElement("p");
        status.textContent = "Status: " + (session.status || "Unknown");

        const attendance = document.createElement("p");
        attendance.textContent =
            "Students Present: " + (session.attendanceCount || 0);

        card.append(title, type, room, code, status, attendance);

        // QR CODE DISPLAY
        if (session.qrCodeDataUrl) {

            const qrHeading = document.createElement("h3");
            qrHeading.textContent = "Student Attendance QR Code";

            const qrImage = document.createElement("img");
            qrImage.src = session.qrCodeDataUrl;
            qrImage.alt = "Attendance QR Code";
            qrImage.className = "attendance-qr";

            const countdown = document.createElement("p");
            countdown.className = "qr-countdown";

            countdown.dataset.expiry = session.expiresAt || "";

            card.append(qrHeading, qrImage, countdown);

        } else {

            const noQR = document.createElement("p");
            noQR.textContent = "QR code is not available for this session.";
            card.appendChild(noQR);

        }

        sessionsList.appendChild(card);

    });

    // Start QR expiry countdown
    updateCountdowns();

    countdownInterval = setInterval(updateCountdowns, 1000);

}

// UPDATE QR COUNTDOWN
function updateCountdowns() {

    const countdowns =
        document.querySelectorAll(".qr-countdown");

    countdowns.forEach(countdown => {

        const expiryValue = countdown.dataset.expiry;

        if (!expiryValue) {
            countdown.textContent = "Expiry time unavailable.";
            return;
        }

        const expiryTime = new Date(expiryValue).getTime();
        const currentTime = Date.now();

        const remainingTime = expiryTime - currentTime;

        if (isNaN(expiryTime)) {
            countdown.textContent = "Invalid expiry time.";
            return;
        }

        if (remainingTime <= 0) {

            countdown.textContent =
                "QR Code Expired! Create a new attendance session.";

            countdown.classList.add("expired");
            return;
        }

        const minutes = Math.floor(remainingTime / 60000);

        const seconds = Math.floor((remainingTime % 60000) / 1000);

        countdown.textContent =
            `QR expires in: ${minutes}:${String(seconds).padStart(2, "0")}`;

        countdown.classList.remove("expired");

    });

}

// REFRESH SESSIONS
document.getElementById("refreshBtn")
.addEventListener("click", loadTeacherDashboard);

// LOGOUT
document.getElementById("logoutBtn")
.addEventListener("click", () => {

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userEmail");

    window.location.href = "index.html";

});

// INITIAL LOAD
if (token) {
    loadTeacherDashboard();
}