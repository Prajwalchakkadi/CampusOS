
import { auth } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const API_URL = window.location.origin;

const teacherSelect = document.getElementById("assignmentTeacher");
const studentSelect = document.getElementById("assignmentStudent");
const assignmentForm = document.getElementById("assignmentForm");
const loadButton = document.getElementById("loadAssignmentsBtn");
const assignButton = document.getElementById("assignStudentBtn");
const message = document.getElementById("assignmentMessage");

let adminAuthorized = false;

function showMessage(text, color = "black") {
    message.textContent = text;
    message.style.color = color;
}

async function getAdminToken() {
    const user = auth.currentUser;

    if (!user || !adminAuthorized) {
        throw new Error("Administrator login required.");
    }

    const tokenResult = await user.getIdTokenResult(true);

    if (tokenResult.claims.admin !== true) {
        adminAuthorized = false;
        throw new Error("Administrator permission required.");
    }

    return user.getIdToken(true);
}

async function apiRequest(endpoint, options = {}) {
    const token = await getAdminToken();

    const response = await fetch(`${API_URL}${endpoint}`, {
        ...options,
        headers: {
            ...(options.headers || {}),
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
        throw new Error(result.message || "Request failed.");
    }

    return result;
}

async function loadTeachersAndStudents() {
    if (!adminAuthorized) {
        showMessage("Administrator access required.", "red");
        return;
    }

    loadButton.disabled = true;
    showMessage("Loading teachers and students...");

    try {
        const [teacherResult, studentResult] = await Promise.all([
            apiRequest("/api/teachers"),
            apiRequest("/api/students")
        ]);

        teacherSelect.innerHTML = '<option value="">Select teacher</option>';
        studentSelect.innerHTML = '<option value="">Select student</option>';

        teacherResult.teachers.forEach(teacher => {
            const option = document.createElement("option");
            option.value = teacher.uid;
            option.textContent = `${teacher.name} (${teacher.email})`;
            teacherSelect.appendChild(option);
        });

        studentResult.students.forEach(student => {
            const option = document.createElement("option");
            option.value = student.uid;
            option.textContent =
                `${student.name} - ${student.registrationNumber || student.email}`;
            studentSelect.appendChild(option);
        });

        showMessage(
            `Loaded ${teacherResult.teachers.length} teachers and ${studentResult.students.length} students.`,
            "green"
        );

    } catch (error) {
        console.error("Assignment loading error:", error);
        showMessage(error.message, "red");
    } finally {
        loadButton.disabled = false;
    }
}

loadButton.addEventListener("click", loadTeachersAndStudents);

assignmentForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (!adminAuthorized) {
        showMessage("Administrator access required.", "red");
        return;
    }

    const assignment = {
        teacherUid: teacherSelect.value,
        studentUid: studentSelect.value,
        className: document.getElementById("assignmentClass").value.trim(),
        section: document.getElementById("assignmentSection").value.trim(),
        semester: document.getElementById("assignmentSemester").value.trim(),
        subject: document.getElementById("assignmentSubject").value.trim()
    };

    if (Object.values(assignment).some(value => !value)) {
        showMessage("Please complete every field.", "red");
        return;
    }

    assignButton.disabled = true;
    showMessage("Creating student assignment...");

    try {
        const result = await apiRequest("/api/assignments", {
            method: "POST",
            body: JSON.stringify(assignment)
        });

        showMessage(result.message, "green");
        assignmentForm.reset();

    } catch (error) {
        console.error("Assignment creation error:", error);
        showMessage(error.message, "red");
    } finally {
        assignButton.disabled = false;
    }
});

onAuthStateChanged(auth, async user => {
    adminAuthorized = false;
    loadButton.disabled = true;
    assignButton.disabled = true;

    if (!user) {
        showMessage("Please log in as administrator.", "red");
        return;
    }

    try {
        const token = await user.getIdTokenResult(true);

        if (token.claims.admin !== true) {
            showMessage("Access denied: administrator only.", "red");
            return;
        }

        adminAuthorized = true;
        loadButton.disabled = false;
        assignButton.disabled = false;
        showMessage("Administrator verified. Load teachers and students.");

    } catch (error) {
        showMessage("Unable to verify administrator.", "red");
    }
});

