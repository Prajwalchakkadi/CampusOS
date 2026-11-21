
const API_URL = "http://127.0.0.1:5000";

const token = sessionStorage.getItem("token");
const email = sessionStorage.getItem("userEmail");
const role = sessionStorage.getItem("userRole");

const statusElement = document.getElementById("status");
const video = document.getElementById("faceVideo");
const startCameraBtn = document.getElementById("startCameraBtn");
const stopCameraBtn = document.getElementById("stopCameraBtn");
const consentCheckbox = document.getElementById("faceConsent");
const enrollBtn = document.getElementById("enrollFaceBtn");
const faceMessage = document.getElementById("faceMessage");

let cameraStream = null;

if (!token || role !== "Student") {
  alert("Please log in using your student account.");
  window.location.href = "index.html";
}

document.getElementById("studentEmail").textContent = email || "Not available";
document.getElementById("studentRole").textContent = role || "Student";

document.getElementById("logoutBtn").addEventListener("click", () => {
  stopCamera();
  sessionStorage.clear();
  window.location.href = "index.html";
});

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || "Request failed.");
  }

  return data;
}

async function loadDashboard() {
  try {
    statusElement.textContent = "Loading student information...";

    const data = await apiRequest("/api/student/dashboard");

    document.getElementById("studentId").textContent =
      data.student?.id || data.student?.uid || "Available";

    statusElement.textContent = "Student dashboard connected.";

    await loadFaceStatus();
    await loadAttendance();

  } catch (error) {
    console.error(error);
    statusElement.textContent = error.message;
  }
}

async function loadFaceStatus() {
  try {
    const data = await apiRequest("/api/student/face-enrollment");

    if (data.enrolled) {
      faceMessage.textContent = "Face enrollment is verified.";
    } else if (data.status === "pending_provider") {
      faceMessage.textContent =
        "Consent received. Secure face verification setup is pending.";
    } else {
      faceMessage.textContent =
        "Face enrollment has not been completed.";
    }
  } catch (error) {
    faceMessage.textContent = error.message;
  }
}

async function loadAttendance() {
  try {
    const data = await apiRequest("/api/student/attendance");

    const summary = data.summary || {};

    document.getElementById("attendancePercentage").textContent =
      `${summary.attendancePercentage ?? 0}%`;

    document.getElementById("totalClasses").textContent =
      summary.totalClasses ?? 0;

    document.getElementById("presentClasses").textContent =
      summary.presentClasses ?? 0;

    document.getElementById("absentClasses").textContent =
      summary.absentClasses ?? 0;

  } catch (error) {
    console.error("Attendance error:", error);
  }
}

startCameraBtn.addEventListener("click", async () => {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("Camera is unavailable. Open CampusOS through localhost or HTTPS.");
    }

    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });

    video.srcObject = cameraStream;
    await video.play();

    faceMessage.textContent =
      "Camera is working. This is only a preview, not face verification.";

  } catch (error) {
    faceMessage.textContent = "Camera error: " + error.message;
  }
});

function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(track => track.stop());
    cameraStream = null;
  }

  if (video) {
    video.srcObject = null;
  }
}

stopCameraBtn.addEventListener("click", stopCamera);

enrollBtn.addEventListener("click", async () => {
  if (!consentCheckbox.checked) {
    faceMessage.textContent =
      "Please read and accept the face enrollment consent first.";
    return;
  }

  try {
    enrollBtn.disabled = true;
    faceMessage.textContent = "Submitting consent...";

    const data = await apiRequest(
      "/api/student/face-enrollment/consent",
      {
        method: "POST",
        body: JSON.stringify({ consent: true })
      }
    );

    faceMessage.textContent = data.message ||
      "Consent received. Secure face verification setup is pending.";

    await loadFaceStatus();

  } catch (error) {
    faceMessage.textContent = error.message;
  } finally {
    enrollBtn.disabled = false;
  }
});

window.addEventListener("beforeunload", stopCamera);

loadDashboard();


