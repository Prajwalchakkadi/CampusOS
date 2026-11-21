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

const applicationList = document.getElementById("applicationList");
const pendingCount = document.getElementById("pendingCount");
const approvedCount = document.getElementById("approvedCount");
const rejectedCount = document.getElementById("rejectedCount");

function showMessage(message) {
  applicationList.textContent = message;
}

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    showMessage("Administrator login required.");
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
    console.error("Admin verification error:", error);
    showMessage("Unable to verify administrator access: " + error.message);
  }
});

async function loadApplications() {
  showMessage("Loading applications...");

  try {
    const applicationsRef = collection(db, "pendingRegistrations");

    const pendingQuery = query(
      applicationsRef,
      where("status", "==", "pending")
    );

    const approvedQuery = query(
      applicationsRef,
      where("status", "==", "approved")
    );

    const rejectedQuery = query(
      applicationsRef,
      where("status", "==", "rejected")
    );

    const [pending, approved, rejected] = await Promise.all([
      getDocs(pendingQuery),
      getDocs(approvedQuery),
      getDocs(rejectedQuery)
    ]);

    pendingCount.textContent = pending.size;
    approvedCount.textContent = approved.size;
    rejectedCount.textContent = rejected.size;

    applicationList.replaceChildren();

    if (pending.empty) {
      showMessage("No pending applications.");
      return;
    }

    pending.forEach((application) => {
      const student = application.data();

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

      const status = document.createElement("p");
      status.textContent = "Status: Pending";

      const approveButton = document.createElement("button");
      approveButton.textContent = "Approve";
      approveButton.style.cssText =
        "padding:10px;margin-right:10px;background:#16834a;color:white;border:0;border-radius:6px;";

      const rejectButton = document.createElement("button");
      rejectButton.textContent = "Reject";
      rejectButton.style.cssText =
        "padding:10px;background:#c0392b;color:white;border:0;border-radius:6px;";

      approveButton.addEventListener("click", () => {
        updateApplication(application.id, "approved");
      });

      rejectButton.addEventListener("click", () => {
        updateApplication(application.id, "rejected");
      });

      card.append(
        name,
        email,
        registration,
        status,
        approveButton,
        rejectButton
      );

      applicationList.appendChild(card);
    });

  } catch (error) {
    console.error("Application loading error:", error);

    showMessage(
      "Unable to load applications: " +
      (error.code || error.message)
    );
  }
}

async function updateApplication(applicationId, newStatus) {
  const buttons = applicationList.querySelectorAll("button");
  buttons.forEach((button) => button.disabled = true);

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
    console.error("Application update error:", error);

    alert(
      "Unable to update application: " +
      (error.code || error.message)
    );

    buttons.forEach((button) => button.disabled = false);
  }
}
