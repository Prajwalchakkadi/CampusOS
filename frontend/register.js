
import { db } from "./firebase.js";

import {
  collection,
  doc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";

const form = document.querySelector("form");
const message = document.getElementById("message");

if (!form) {
  console.error("Registration form not found.");
}

function getValue(data, ...names) {
  for (const name of names) {
    const value = data.get(name);
    if (value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
}

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!form.checkValidity()) {
    form.reportValidity();
    return;
  }

  const button = form.querySelector('button[type="submit"]');
  const data = new FormData(form);

  const studentPhone = getValue(data, "phone", "studentPhone");
  const fatherPhone = getValue(data, "fatherPhone");
  const motherPhone = getValue(data, "motherPhone");

  const phonePattern = /^[0-9]{10}$/;

  if (
    !phonePattern.test(studentPhone) ||
    !phonePattern.test(fatherPhone) ||
    !phonePattern.test(motherPhone)
  ) {
    message.textContent = "Enter valid 10-digit phone numbers.";
    return;
  }

  const dob = getValue(data, "dob", "dateOfBirth");

  if (dob && new Date(dob) > new Date()) {
    message.textContent = "Date of birth cannot be in the future.";
    return;
  }

  const studentEmail = getValue(data, "email", "studentEmail").toLowerCase();

  if (!studentEmail) {
    message.textContent = "Please enter the student email address.";
    return;
  }

  const application = {
    studentName: getValue(data, "studentName", "fullName"),
    fatherName: getValue(data, "fatherName"),
    motherName: getValue(data, "motherName"),
    dob: dob,
    gender: getValue(data, "gender"),
    caste: getValue(data, "caste"),
    registrationNumber: getValue(data, "registrationNumber"),
    email: studentEmail,
    phone: studentPhone,
    fatherPhone: fatherPhone,
    motherPhone: motherPhone,
    parentEmail: getValue(data, "parentEmail").toLowerCase(),
    village: getValue(data, "village", "nativeVillage"),
    accommodation: getValue(data, "accommodation", "accommodationType"),
    status: "pending",
    credentialStatus: "not_issued",
    createdAt: serverTimestamp()
  };

  try {
    if (button) button.disabled = true;

    message.textContent = "Submitting your application...";

    const applicationRef = doc(collection(db, "pendingRegistrations"));

    await setDoc(applicationRef, application);

    message.textContent =
      "Application submitted successfully! Your application ID is: " +
      applicationRef.id +
      ". Wait for college admin approval.";

    form.reset();

  } catch (error) {
    console.error("Registration error:", error);

    message.textContent =
      "Unable to submit. Please check your internet connection and Firestore rules.";
  } finally {
    if (button) button.disabled = false;
  }
});

