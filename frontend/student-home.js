// CAMPUSOS - STUDENT HOME PAGE

const API_URL = window.location.origin;

const token = sessionStorage.getItem("token");
const role = sessionStorage.getItem("userRole");

const $ = (id) => document.getElementById(id);

// Check student login
if (!token || role !== "Student") {
  alert("Please log in using your student account.");
  window.location.href = "index.html";
}

// Display today's date
const todayLabel = $("todayLabel");

if (todayLabel) {
  todayLabel.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

// Display connection status
function setConnectionStatus(message) {
  const label = $("connectionLabel");
  if (label) label.textContent = message;
}

// Load student profile from backend
async function loadStudentHome() {
  try {
    setConnectionStatus("Connecting...");

    const response = await fetch(`${API_URL}/api/student/dashboard`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${sessionStorage.getItem("token")}`,
        "Content-Type": "application/json"
      }
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Unable to load student profile.");
    }

    const student =
      result.student ||
      result.profile ||
      result.data?.student ||
      result.data ||
      result;

    const firstName = student.firstName || student.first_name || "";
    const lastName = student.lastName || student.last_name || "";

    const studentName =
      student.name ||
      student.fullName ||
      student.full_name ||
      `${firstName} ${lastName}`.trim() ||
      sessionStorage.getItem("userName") ||
      "Student";

    if ($("welcomeName")) {
      $("welcomeName").textContent = studentName;
    }

    const initial = studentName.charAt(0).toUpperCase() || "S";

    if ($("avatarInitial")) {
      $("avatarInitial").textContent = initial;
    }

    setConnectionStatus("Connected");

  } catch (error) {
    console.error("CampusOS Home Error:", error);
    setConnectionStatus("Connection issue");

    if ($("welcomeName")) {
      $("welcomeName").textContent =
        sessionStorage.getItem("userName") || "Student";
    }
  }
}

// Mobile sidebar
const menuBtn = $("menuBtn");
const sidebar = $("sidebar");

if (menuBtn && sidebar) {
  menuBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });
}

// Close sidebar after selecting a navigation link
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (sidebar) sidebar.classList.remove("open");
  });
});

// Logout
const logoutBtn = $("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    const confirmLogout = confirm("Are you sure you want to log out?");

    if (confirmLogout) {
      sessionStorage.clear();
      window.location.href = "index.html";
    }
  });
}

// Start Home page
if (token && role === "Student") {
  loadStudentHome();
}
