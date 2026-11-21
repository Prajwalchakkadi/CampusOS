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

const API_URL = "http://127.0.0.1:5000";

const applicationList = document.getElementById("applicationList");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

function showMessage(message) {
  applicationList.textContent = message;
}

onAuthStateChanged(auth, async (user) => {
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

    await loadApplications();

  } catch (error) {
    console.error(error);
    showMessage("Unable to verify administrator access.");
  }
});

async function loadApplications() {
  showMessage("Loading applications...");

  try {
    const applicationsRef = collection(db, "pendingRegistrations");

    const [pending, approved, rejected] = await Promise.all([
      getDocs(query(applicationsRef, where("status", "==", "pending"))),
      getDocs(query(applicationsRef, where("status", "==", "approved"))),
      getDocs(query(applicationsRef, where("status", "==", "rejected")))
    ]);

    pendingCount.textContent = pending.size;
    approvedCount.textContent = approved.size;
    rejectedCount.textContent = rejected.size;

    applicationList.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Pending Applications";
    applicationList.appendChild(heading);

    if (pending.empty) {
      const empty = document.createElement("p");
      empty.textContent = "No pending applications.";
      applicationList.appendChild(empty);
    }

    pending.forEach((application) => {
      const student = application.data();
      const card = createCard(student);

      const status = document.createElement("p");
      status.textContent = "Status: Pending";

      const approveButton = createButton("Approve", "#16834a");
      const rejectButton = createButton("Reject", "#c0392b");

      approveButton.addEventListener("click", () => {
        updateApplication(application.id, "approved");
      });

      rejectButton.addEventListener("click", () => {
        updateApplication(application.id, "rejected");
      });

      card.append(status, approveButton, rejectButton);
      applicationList.appendChild(card);
    });

    const approvedHeading = document.createElement("h2");
    approvedHeading.textContent = "Approved Applications";
    approvedHeading.style.marginTop = "30px";
    applicationList.appendChild(approvedHeading);

    if (approved.empty) {
      const empty = document.createElement("p");
      empty.textContent = "No approved applications yet.";
      applicationList.appendChild(empty);
    }

    approved.forEach((application) => {
      const student = application.data();
      const card = createCard(student);

      const status = document.createElement("p");
      status.textContent = "Status: Approved";

      const accountStatus = document.createElement("p");
      accountStatus.textContent =
        student.credentialStatus === "issued"
          ? "Student account: Created"
          : "Student account: Not created";

      card.append(status, accountStatus);

      if (student.credentialStatus !== "issued") {
        const accountButton = createButton(
          "Create Student Account",
          "#1769aa"
        );

        accountButton.addEventListener("click", () => {
          createStudentAccount(application.id, createButton);
        });

        card.appendChild(accountButton);
      }

      applicationList.appendChild(card);
    });

    const rejectedHeading = document.createElement("h2");
    rejectedHeading.textContent = "Rejected Applications";
    rejectedHeading.style.marginTop = "30px";
    applicationList.appendChild(rejectedHeading);

    if (rejected.empty) {
      const empty = document.createElement("p");
      empty.textContent = "No rejected applications.";
      applicationList.appendChild(empty);
    }

    rejected.forEach((application) => {
      const student = application.data();
      const card = createCard(student);

      const status = document.createElement("p");
      status.textContent = "Status: Rejected";

      card.appendChild(status);
      applicationList.appendChild(card);
    });

  } catch (error) {
    console.error("Application loading error:", error);
    showMessage("Unable to load applications: " +
      (error.code || error.message));
  }
}

function createCard(student) {
  const card = document.createElement("div");

  card.style.cssText =
    "padding:15px;margin-bottom:12px;border:1px solid #ddd;border-radius:10px;";

  const name = document.createElement("h3");
  name.textContent = student.studentName || "Unnamed student";

  const email = document.createElement("p");
  email.textContent = "Email: " + (student.email || "Not provided");

  const registration = document.createElement("p");
  registration.textContent =
    "Registration number: " +
    (student.registrationNumber || "Not provided");

  card.append(name, email, registration);

  return card;
}

function createButton(label, color) {
  const button = document.createElement("button");

  button.textContent = label;
  button.style.cssText =
    `padding:10px;margin:5px 5px 5px 0;background:${color};color:white;border:0;border-radius:6px;`;

  return button;
}

async function updateApplication(applicationId, newStatus) {
  if (!confirm("Are you sure you want to " + newStatus + " this application?")) {
    return;
  }

  try {
    const applicationRef = doc(db, "pendingRegistrations", applicationId);

    await updateDoc(applicationRef, {
      status: newStatus,
      reviewedAt: serverTimestamp()
    });

    alert("Application " + newStatus + " successfully!");
    await loadApplications();

  } catch (error) {
    console.error(error);
    alert("Unable to update application: " +
      (error.code || error.message));
  }
}

async function createStudentAccount(applicationId, button) {
  if (!confirm("Create this student's Firebase account and send a password setup email?")) {
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
      throw new Error(result.message || "Account creation failed.");
    }

    alert("Student account created successfully! Password setup email sent to " + result.email);

    await loadApplications();

  } catch (error) {
    console.error("Student account error:", error);
    alert("Unable to create student account: " + error.message);

    button.disabled = false;
    button.textContent = "Create Student Account";
  }
}
