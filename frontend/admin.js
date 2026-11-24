
import { auth, db } from "./firebase.js";

import {
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    collection,
    query,
    where,
    getDocs,
    doc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

const API_URL = window.location.origin;

const applicationList = document.getElementById("applicationList");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

const teacherForm = document.getElementById("teacherForm");
const teacherNameInput = document.getElementById("teacherName");
const teacherEmailInput = document.getElementById("teacherEmail");
const createTeacherBtn = document.getElementById("createTeacherBtn");
const teacherMessage = document.getElementById("teacherMessage");

let adminAuthorized = false;

// ==========================================
// DISPLAY APPLICATION MESSAGES
// ==========================================

function showMessage(message) {
    applicationList.textContent = message;
}

// ==========================================
// VERIFY ADMINISTRATOR
// ==========================================

onAuthStateChanged(auth, async (user) => {

    adminAuthorized = false;

    if (!user) {
        showMessage("Administrator login required. Please log in again.");
        return;
    }

    try {

        const token = await user.getIdTokenResult(true);

        if (token.claims.admin !== true) {
            showMessage("Access denied. Administrator permission required.");
            return;
        }

        adminAuthorized = true;

        await loadApplications();

    } catch (error) {

        console.error(error);
        showMessage("Unable to verify administrator access.");

    }

});

// ==========================================
// LOAD STUDENT APPLICATIONS
// ==========================================

async function loadApplications() {

    showMessage("Loading applications...");

    try {

        const applicationsRef = collection(db, "pendingRegistrations");

        const snapshot = await getDocs(applicationsRef);

        applicationList.innerHTML = "";

        let pending = 0;
        let approved = 0;
        let rejected = 0;

        if (snapshot.empty) {

            showMessage("No student applications found.");

            pendingCount.textContent = "0";
            approvedCount.textContent = "0";
            rejectedCount.textContent = "0";

            return;
        }

        snapshot.forEach((application) => {

            const student = application.data();
            const applicationId = application.id;

            const status = String(student.status || "pending").toLowerCase();

            if (status === "pending") pending++;
            if (status === "approved") approved++;
            if (status === "rejected") rejected++;

            const card = createApplicationCard(
                student,
                applicationId
            );

            applicationList.appendChild(card);

        });

        pendingCount.textContent = pending;
        approvedCount.textContent = approved;
        rejectedCount.textContent = rejected;

    } catch (error) {

        console.error("Application loading error:", error);

        showMessage(
            "Unable to load applications: " +
            (error.code || error.message)
        );

    }

}

// ==========================================
// CREATE STUDENT APPLICATION CARD
// ==========================================

function createApplicationCard(student, applicationId) {

    const card = document.createElement("div");

    card.style.cssText =
        "background:white;padding:18px;margin:15px 0;" +
        "border-radius:10px;border:1px solid #ddd;";

    const name = document.createElement("h3");

    name.textContent =
        student.studentName || "Unnamed Student";

    const email = document.createElement("p");

    email.textContent =
        "Email: " + (student.email || "Not provided");

    const registration = document.createElement("p");

    registration.textContent =
        "Registration number: " +
        (student.registrationNumber || "Not provided");

    const status = document.createElement("p");

    status.textContent =
        "Status: " + (student.status || "pending");

    card.append(name, email, registration, status);

    const currentStatus =
        String(student.status || "pending").toLowerCase();

    if (currentStatus === "pending") {

        const approveButton = createButton(
            "Approve",
            "#198754"
        );

        approveButton.addEventListener("click", () => {
            updateApplication(applicationId, "approved");
        });

        const rejectButton = createButton(
            "Reject",
            "#dc3545"
        );

        rejectButton.addEventListener("click", () => {
            updateApplication(applicationId, "rejected");
        });

        card.append(approveButton, rejectButton);

    }

    if (currentStatus === "approved") {

        if (student.credentialStatus === "issued") {

            const issued = document.createElement("p");
            issued.textContent = "Student account: Created";
            card.appendChild(issued);

        } else {

            const accountButton = createButton(
                "Create Student Account",
                "#0d6efd"
            );

            accountButton.addEventListener("click", () => {
                createStudentAccount(applicationId, accountButton);
            });

            card.appendChild(accountButton);

        }

    }

    return card;

}

// ==========================================
// CREATE BUTTON
// ==========================================

function createButton(label, color) {

    const button = document.createElement("button");

    button.textContent = label;

    button.style.cssText =
        `padding:10px;margin:5px 5px 5px 0;` +
        `background:${color};color:white;border:0;` +
        `border-radius:6px;cursor:pointer;`;

    return button;

}

// ==========================================
// UPDATE STUDENT APPLICATION
// ==========================================

async function updateApplication(applicationId, newStatus) {

    if (!adminAuthorized) {
        alert("Administrator access required.");
        return;
    }

    if (!confirm("Are you sure you want to " + newStatus + " this application?")) {
        return;
    }

    try {

        const applicationRef = doc(
            db,
            "pendingRegistrations",
            applicationId
        );

        await updateDoc(applicationRef, {
            status: newStatus,
            reviewedAt: serverTimestamp()
        });

        alert("Application " + newStatus + " successfully!");

        await loadApplications();

    } catch (error) {

        console.error(error);

        alert(
            "Unable to update application: " +
            (error.code || error.message)
        );

    }

}

// ==========================================
// CREATE STUDENT FIREBASE ACCOUNT
// ==========================================

async function createStudentAccount(applicationId, button) {

    if (!adminAuthorized) {
        alert("Administrator access required.");
        return;
    }

    if (!confirm(
        "Create this student's Firebase account and send a password setup email?"
    )) {
        return;
    }

    button.disabled = true;
    button.textContent = "Creating account...";

    try {

        const user = auth.currentUser;

        if (!user) {
            throw new Error("Please log in again.");
        }

        const idToken = await user.getIdToken(true);

        const response = await fetch(
            `${API_URL}/api/admin/applications/${encodeURIComponent(applicationId)}/create-account`,
            {
                method: "POST",
                headers: {
                    "Authorization": "Bearer " + idToken,
                    "Content-Type": "application/json"
                }
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Account creation failed."
            );
        }

        alert(
            "Student account created successfully! " +
            "Password setup email sent to " +
            result.email
        );

        await loadApplications();

    } catch (error) {

        console.error("Student account error:", error);

        alert(
            "Unable to create student account: " +
            error.message
        );

        button.disabled = false;
        button.textContent = "Create Student Account";

    }

}

// ==========================================
// CREATE TEACHER FIREBASE ACCOUNT
// ==========================================

teacherForm.addEventListener("submit", async (event) => {

    event.preventDefault();

    if (!adminAuthorized) {
        teacherMessage.textContent =
            "Administrator access required.";
        return;
    }

    const name = teacherNameInput.value.trim();
    const email = teacherEmailInput.value.trim().toLowerCase();

    if (!name || !email) {
        teacherMessage.textContent =
            "Please enter teacher name and email.";
        return;
    }

    const user = auth.currentUser;

    if (!user) {
        teacherMessage.textContent =
            "Please log in again.";
        return;
    }

    createTeacherBtn.disabled = true;
    createTeacherBtn.textContent = "Creating account...";

    teacherMessage.textContent =
        "Creating Firebase Teacher account...";

    try {

        const idToken = await user.getIdToken(true);

        const response = await fetch(
            `${API_URL}/api/admin/teachers/create-account`,
            {
                method: "POST",

                headers: {
                    "Authorization": "Bearer " + idToken,
                    "Content-Type": "application/json"
                },

                body: JSON.stringify({
                    name,
                    email
                })
            }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.message || "Teacher account creation failed."
            );
        }

        teacherMessage.textContent =
            "Teacher account created successfully. Password setup email sent to " +
            result.email;

        teacherMessage.style.color = "green";

        teacherForm.reset();

    } catch (error) {

        console.error("Teacher account error:", error);

        teacherMessage.textContent =
            "Unable to create teacher account: " +
            error.message;

        teacherMessage.style.color = "red";

    } finally {

        createTeacherBtn.disabled = false;
        createTeacherBtn.textContent =
            "Create Teacher Account";

    }

});


