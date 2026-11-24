
const API_URL = "http://127.0.0.1:5000";

const token = sessionStorage.getItem("token");
const email = sessionStorage.getItem("userEmail");
const role = sessionStorage.getItem("userRole");

const $ = (id) => document.getElementById(id);

let cameraStream = null;
let timerInterval = null;
let remainingSeconds = 25 * 60;
let timerRunning = false;

if (!token || role !== "Student") {
  alert("Please log in using your student account.");
  window.location.href = "index.html";
}

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

  if (!toast) return;

  toast.textContent = message;
  toast.classList.add("show");

  setTimeout(() => {
    toast.classList.remove("show");
  }, 2500);
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
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
    throw new Error("HTTP " + response.status + ": " + (data.message || raw || "Request failed."));
  }

  return data;
}

// STUDENT PROFILE

function renderProfile(student) {
  const name = student.name || email || "Student";
  const initial = name.charAt(0).toUpperCase();

  setText("welcomeName", name);
  setText("profileName", name);
  setText("studentId", student.id || student.uid);
  setText("studentEmail", student.email || email);
  setText("studentRole", student.role || role);
  setText("registrationNumber", student.registrationNumber);
  setText(
    "profileSubline",
    student.applicationId
      ? `Application ID: ${student.applicationId}`
      : "Your CampusOS student account"
  );

  setText("avatarInitial", initial);
  setText("profileInitial", initial);
}

// ATTENDANCE SUMMARY

function renderSummary(summary) {
  const percentage = Number(summary.attendancePercentage || 0);
  const safePercentage = Math.max(0, Math.min(100, percentage));

  setText("attendancePercentage", `${safePercentage}%`);
  setText("ringValue", `${safePercentage}%`);
  setText("totalClasses", summary.totalClasses || 0);
  setText("presentClasses", summary.presentClasses || 0);
  setText("absentClasses", summary.absentClasses || 0);
  setText("legendPresent", summary.presentClasses || 0);
  setText("legendAbsent", summary.absentClasses || 0);

  $("attendanceRing").style.background =
    `conic-gradient(#2563eb ${safePercentage * 3.6}deg, #eaf0f7 0deg)`;
}

// ATTENDANCE TABLES

function addCell(row, value) {
  const cell = document.createElement("td");
  cell.textContent = value ?? "—";
  row.appendChild(cell);
}

function renderAttendanceRecords(records) {
  const recordBody = $("attendanceRecords");
  const subjectBody = $("subjectAttendance");

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
      subjects.set(subject, { present: 0, total: 0 });
    }

    const item = subjects.get(subject);
    item.total++;

    if (String(record.status).toLowerCase() === "present") {
      item.present++;
    }
  });

  subjects.forEach((item, subject) => {
    const row = document.createElement("tr");

    addCell(row, subject);
    addCell(row, `${item.present} / ${item.total}`);
    addCell(
      row,
      `${Math.round(item.present / item.total * 100)}%`
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

// LOAD PROFILE

async function loadProfile() {
  const data = await apiRequest("/api/student/dashboard");

  if (!data.student) {
    throw new Error("Student profile not found.");
  }

  renderProfile(data.student);
}

// LOAD ATTENDANCE

async function loadAttendance() {
  try {
    const data = await apiRequest("/api/student/attendance");

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

// FACE ENROLLMENT

async function loadFaceStatus() {
  try {
    const data = await apiRequest(
      "/api/student/face-enrollment"
    );

    if (data.enrolled) {
      setText("faceMessage", "Face enrollment is verified.");
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

// LOAD DASHBOARD

async function loadDashboard() {
  setText("connectionLabel", "Connecting");

  try {
    await loadProfile();

    setText("connectionLabel", "Connected");

    await Promise.all([
      loadAttendance(),
      loadFaceStatus()
    ]);

  } catch (error) {
    console.error(error);
    setText("connectionLabel", error.message);
    showToast(error.message);
  }
}

// CAMERA

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  $("faceVideo").srcObject = null;
}

$("startCameraBtn").addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera needs HTTPS or localhost.");
    }

    stopCamera();

    cameraStream =
      await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user" },
        audio: false
      });

    $("faceVideo").srcObject = cameraStream;

    await $("faceVideo").play();

    setText(
      "faceMessage",
      "Camera preview active. This is not identity verification."
    );

  } catch (error) {
    setText("faceMessage", error.message);
  }
});

$("stopCameraBtn").addEventListener("click", () => {
  stopCamera();
  setText("faceMessage", "Camera stopped.");
});

// CONSENT

$("enrollFaceBtn").addEventListener("click", async () => {
  if (!$("faceConsent").checked) {
    setText("faceMessage", "Please accept the consent first.");
    return;
  }

  const button = $("enrollFaceBtn");
  button.disabled = true;

  try {
    const data = await apiRequest(
      "/api/student/face-enrollment/consent",
      {
        method: "POST",
        body: JSON.stringify({ consent: true })
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

// STUDY TIMER

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function updateTimer() {
  setText("timerDisplay", formatTime(remainingSeconds));
}

function stopTimer() {
  clearInterval(timerInterval);
  timerInterval = null;
  timerRunning = false;

  setText("timerStartBtn", "Start");
}

$("timerStartBtn").addEventListener("click", () => {
  if (timerRunning) {
    stopTimer();
    setText("timerStatus", "Timer paused.");
    return;
  }

  timerRunning = true;
  setText("timerStartBtn", "Pause");
  setText("timerStatus", "Stay focused!");

  timerInterval = setInterval(() => {
    remainingSeconds--;
    updateTimer();

    if (remainingSeconds <= 0) {
      stopTimer();
      setText("timerStatus", "Study session complete!");
      showToast("Great work! Take a short break.");
    }
  }, 1000);
});

$("timerResetBtn").addEventListener("click", () => {
  stopTimer();
  remainingSeconds = 25 * 60;
  updateTimer();
  setText("timerStatus", "Timer reset to 25 minutes.");
});

// STUDY TASKS

const TASKS_KEY = "campusos_student_tasks";

function readTasks() {
  try {
    const tasks = JSON.parse(
      localStorage.getItem(TASKS_KEY) || "[]"
    );

    return Array.isArray(tasks) ? tasks : [];
  } catch {
    return [];
  }
}

function saveTasks(tasks) {
  localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
}

function renderTasks() {
  const list = $("taskList");
  const tasks = readTasks();

  list.replaceChildren();

  if (!tasks.length) {
    const empty = document.createElement("li");
    empty.textContent = "No tasks yet. Add your first task.";
    list.appendChild(empty);
    return;
  }

  tasks.forEach((task, index) => {
    const item = document.createElement("li");

    if (task.done) item.classList.add("done");

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = Boolean(task.done);

    checkbox.addEventListener("change", () => {
      const updated = readTasks();
      updated[index].done = checkbox.checked;
      saveTasks(updated);
      renderTasks();
    });

    const label = document.createElement("span");
    label.textContent = task.text;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "task-delete";
    remove.textContent = "×";

    remove.addEventListener("click", () => {
      const updated = readTasks();
      updated.splice(index, 1);
      saveTasks(updated);
      renderTasks();
    });

    item.append(checkbox, label, remove);
    list.appendChild(item);
  });
}

function addTask() {
  const input = $("taskInput");
  const text = input.value.trim();

  if (!text) {
    showToast("Enter a task first.");
    return;
  }

  const tasks = readTasks();

  tasks.push({
    text: text,
    done: false
  });

  saveTasks(tasks);
  input.value = "";

  renderTasks();
}

$("addTaskBtn").addEventListener("click", addTask);

$("taskInput").addEventListener("keydown", event => {
  if (event.key === "Enter") addTask();
});

// LOGOUT

$("logoutBtn").addEventListener("click", () => {
  stopCamera();
  stopTimer();

  sessionStorage.clear();

  window.location.href = "index.html";
});

// MOBILE MENU

$("menuBtn").addEventListener("click", () => {
  $("sidebar").classList.toggle("open");
});

document.querySelectorAll(".nav-link").forEach(link => {
  link.addEventListener("click", () => {
    document.querySelectorAll(".nav-link").forEach(item => {
      item.classList.remove("active");
    });

    link.classList.add("active");
    $("sidebar").classList.remove("open");
  });
});

// INITIALIZE

setText(
  "todayLabel",
  new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long"
  }).toUpperCase()
);

updateTimer();
renderTasks();
loadDashboard();

window.addEventListener("beforeunload", () => {
  stopCamera();
  stopTimer();
});

