const API_URL = window.location.origin;
const token = sessionStorage.getItem("token");

const statusMessage = document.getElementById("status");
const sessionMessage = document.getElementById("sessionMessage");

let countdownInterval = null;

if (!token) {
    alert("Please login as a teacher first!");
    window.location.href = "index.html";
}

// LOAD TEACHER DASHBOARD
async function loadTeacherDashboard() {
    try {
        const response = await fetch(
            `${API_URL}/api/teacher/sessions`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Unable to load sessions");
        }

        const teacherName =
            sessionStorage.getItem("userName") || "Teacher";

        document.getElementById("teacherName").textContent = teacherName;
        document.getElementById("welcomeName").textContent =
            teacherName.split(" ")[0];

        document.getElementById("teacherEmail").textContent =
            sessionStorage.getItem("userEmail") || "Not available";

        document.getElementById("teacherRole").textContent = "Teacher";

        statusMessage.textContent = "Connected successfully";

        displaySessions(data.sessions || []);

    } catch (error) {
        statusMessage.textContent = "Connection error";
        console.error(error);
        document.getElementById("sessionsList").textContent =
            error.message;
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
    createBtn.textContent = "GENERATING QR...";

    sessionMessage.textContent = "";

    try {
        const response = await fetch(
            `${API_URL}/api/teacher/sessions`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
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
            "✓ Attendance session created successfully!";

        document.getElementById("sessionForm").reset();

        await loadTeacherDashboard();

    } catch (error) {
        sessionMessage.textContent = error.message;
        console.error(error);

    } finally {
        createBtn.disabled = false;
        createBtn.innerHTML = "<span>＋</span> GENERATE ATTENDANCE QR";
    }
});

// DISPLAY SESSIONS
function displaySessions(sessions) {
    const sessionsList = document.getElementById("sessionsList");

    sessionsList.innerHTML = "";

    if (countdownInterval) {
        clearInterval(countdownInterval);
        countdownInterval = null;
    }

    const totalSessions = sessions.length;

    const activeSessions = sessions.filter(
        session => session.status === "Active"
    ).length;

    const studentsVerified = sessions.reduce(
        (total, session) =>
            total + Number(session.attendanceCount || 0),
        0
    );

    document.getElementById("totalSessions").textContent =
        totalSessions;

    document.getElementById("activeSessions").textContent =
        activeSessions;

    document.getElementById("studentsVerified").textContent =
        studentsVerified;

    if (sessions.length === 0) {
        const empty = document.createElement("div");
        empty.className = "empty-state";
        empty.textContent =
            "No sessions yet. Create your first lecture or lab session.";
        sessionsList.appendChild(empty);
        return;
    }

    // Newest sessions first
    sessions = [...sessions].reverse();

    sessions.forEach(session => {
        const card = document.createElement("article");
        card.className = "session-card";

        const title = document.createElement("h3");
        title.textContent = session.subject || "Untitled Subject";

        const type = document.createElement("p");
        type.textContent = `Class Type: ${session.classType || "Unknown"}`;

        const room = document.createElement("p");
        room.textContent = `Classroom: ${session.classroom || "Not specified"}`;

        const created = document.createElement("p");
        created.textContent =
            `Created: ${formatDate(session.createdAt)}`;

        const status = document.createElement("span");
        status.className = "session-status";

        const isExpired =
            !session.expiresAt ||
            Date.now() >= new Date(session.expiresAt).getTime();

        status.textContent = isExpired ? "EXPIRED" : "ACTIVE";

        if (isExpired) {
            status.classList.add("expired");
        }

        const attendance = document.createElement("p");
        attendance.textContent =
            `Students scanned: ${Number(session.attendanceCount || 0)}`;

        card.append(
            title,
            type,
            room,
            created,
            status,
            attendance
        );

        if (session.qrCodeDataUrl) {
            const qrHeading = document.createElement("div");
            qrHeading.className = "qr-heading";
            qrHeading.textContent = "STUDENT ATTENDANCE QR";

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
            noQR.textContent = "QR code is not available.";
            card.appendChild(noQR);
        }

        sessionsList.appendChild(card);
    });

    updateCountdowns();
    countdownInterval = setInterval(updateCountdowns, 1000);
}

// FORMAT DATE
function formatDate(value) {
    if (!value) return "Not available";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Not available";
    }

    return date.toLocaleString();
}

// UPDATE QR EXPIRY COUNTDOWN
function updateCountdowns() {
    document.querySelectorAll(".qr-countdown").forEach(countdown => {
        const expiry = new Date(countdown.dataset.expiry).getTime();

        if (!Number.isFinite(expiry)) {
            countdown.textContent = "Expiry unavailable";
            return;
        }

        const remaining = expiry - Date.now();

        if (remaining <= 0) {
            countdown.textContent = "QR EXPIRED — CREATE A NEW SESSION";
            countdown.classList.add("expired");
            return;
        }

        const minutes = Math.floor(remaining / 60000);
        const seconds = Math.floor((remaining % 60000) / 1000);

        countdown.textContent =
            `QR EXPIRES IN ${minutes}:${String(seconds).padStart(2, "0")}`;

        countdown.classList.remove("expired");
    });
}

// REFRESH
document.getElementById("refreshBtn")
.addEventListener("click", loadTeacherDashboard);

// LOGOUT
document.getElementById("logoutBtn")
.addEventListener("click", () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");

    window.location.href = "index.html";
});
// LOAD TEACHER'S ASSIGNED STUDENTS
async function loadAssignedStudents() {
    const status = document.getElementById("assignmentStatus");
    const list = document.getElementById("assignedStudentsList");
    const refresh = document.getElementById("refreshAssignmentsBtn");

    if (!status || !list || !token) return;

    refresh.disabled = true;
    status.textContent = "Loading assigned students...";
    list.textContent = "";

    try {
        const response = await fetch(
            `${API_URL}/api/teacher/assignments`,
            {
                method: "GET",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to load students.");
        }

        const assignments = data.assignments || [];

        status.textContent =
            `${assignments.length} assignment(s) found.`;

        if (assignments.length === 0) {
            list.textContent = "No students assigned yet.";
            return;
        }

        assignments.forEach(assignment => {
            const card = document.createElement("article");
            card.className = "session-card";

            const title = document.createElement("h3");
            title.textContent = assignment.studentName || "Student";

            const email = document.createElement("p");
            email.textContent =
                `Email: ${assignment.studentEmail || "Not available"}`;

            const subject = document.createElement("p");
            subject.textContent =
                `Subject: ${assignment.subject || "Not specified"}`;

            const classInfo = document.createElement("p");
            classInfo.textContent =
                `Class: ${assignment.className || "-"} | Section: ${assignment.section || "-"} | Semester: ${assignment.semester || "-"}`;

            card.append(title, email, subject, classInfo);
            list.appendChild(card);
        });

    } catch (error) {
        console.error("Assigned students error:", error);
        status.textContent = error.message;
        list.textContent = "Could not load assigned students.";
    } finally {
        refresh.disabled = false;
    }
}

// REFRESH ASSIGNED STUDENTS
document.getElementById("refreshAssignmentsBtn")
    ?.addEventListener("click", loadAssignedStudents);

// INITIAL LOAD
if (token) {
    loadTeacherDashboard();
    loadAssignedStudents();
}

