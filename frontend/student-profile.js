// ==========================================
// CAMPUSOS - STUDENT PROFILE
// Read-only student profile
// ==========================================

const API_URL = window.location.origin;

const token = sessionStorage.getItem("token");
const role = sessionStorage.getItem("userRole");
const email = sessionStorage.getItem("userEmail");

const $ = (id) => document.getElementById(id);

// Protect student page
if (!token || role !== "Student") {
  alert("Please log in using your student account.");
  window.location.href = "index.html";
}

// Safe text display
function setProfileText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent =
      value !== undefined && value !== null && value !== ""
        ? value
        : "Not available";
  }
}

// Get first available field from API response
function getValue(student, fields) {
  for (const field of fields) {
    const value = student[field];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return "";
}

// Display student information
function renderStudentProfile(student) {

  const name =
    getValue(student, ["name", "fullName", "full_name"]) ||
    email ||
    "Student";

  const initial = name.charAt(0).toUpperCase();

  // Profile heading
  setProfileText("profileName", name);
  setProfileText("profileInitial", initial);
  setProfileText("avatarInitial", initial);

  setProfileText(
    "profileCourse",
    getValue(student, ["course", "program", "department"])
  );

  setProfileText(
    "profileUSN",
    getValue(student, ["registrationNumber", "usn", "applicationId"])
  );

  // Personal information
  setProfileText("fullName", name);

  setProfileText(
    "dateOfBirth",
    getValue(student, ["dateOfBirth", "dob", "birthDate"])
  );

  setProfileText("gender", getValue(student, ["gender"]));
  setProfileText("bloodGroup", getValue(student, ["bloodGroup"]));

  // Academic information
  setProfileText(
    "collegeName",
    getValue(student, ["collegeName", "college"])
  );

  setProfileText(
    "department",
    getValue(student, ["department", "branch"])
  );

  setProfileText(
    "course",
    getValue(student, ["course", "program"])
  );

  setProfileText(
    "year",
    getValue(student, ["year", "academicYear"])
  );

  setProfileText(
    "semester",
    getValue(student, ["semester"])
  );

  setProfileText(
    "section",
    getValue(student, ["section"])
  );

  setProfileText(
    "registrationNumber",
    getValue(student, ["registrationNumber", "usn"])
  );

  setProfileText(
    "admissionYear",
    getValue(student, ["admissionYear"])
  );

  // Contact information
  setProfileText(
    "email",
    getValue(student, ["email"]) || email
  );

  setProfileText(
    "phone",
    getValue(student, ["phone", "mobile", "phoneNumber"])
  );

  setProfileText(
    "address",
    getValue(student, ["address", "residentialAddress"])
  );

  // Parent / guardian information
  setProfileText(
    "parentName",
    getValue(student, ["parentName", "guardianName"])
  );

  setProfileText(
    "parentRelation",
    getValue(student, ["parentRelation", "guardianRelation"])
  );

  setProfileText(
    "parentPhone",
    getValue(student, ["parentPhone", "guardianPhone"])
  );

  setProfileText(
    "parentEmail",
    getValue(student, ["parentEmail", "guardianEmail"])
  );
}

// Load profile from backend
async function loadStudentProfile() {

  const connection = $("connectionLabel");

  try {

    if (connection) {
      connection.textContent = "Connecting...";
    }

    const response = await fetch(
      `${API_URL}/api/student/dashboard`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          "Content-Type": "application/json"
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || "Unable to load student profile."
      );
    }

    if (!data.student) {
      throw new Error("Student profile not found.");
    }

    renderStudentProfile(data.student);

    if (connection) {
      connection.textContent = "Connected";
    }

  } catch (error) {

    console.error("Profile loading error:", error);

    if (connection) {
      connection.textContent = "Connection issue";
    }

    alert("Unable to load your profile: " + error.message);
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

// Close sidebar after navigation
document.querySelectorAll(".nav-link").forEach((link) => {
  link.addEventListener("click", () => {
    if (sidebar) {
      sidebar.classList.remove("open");
    }
  });
});

// Logout
const logoutBtn = $("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {

    if (confirm("Are you sure you want to log out?")) {
      sessionStorage.clear();
      window.location.href = "index.html";
    }

  });
}

// Start profile
if (token && role === "Student") {
  loadStudentProfile();
}
