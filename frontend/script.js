

import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

// HTML ELEMENTS
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = loginForm.querySelector('button[type="submit"]');
const forgotPassword = document.getElementById("forgotPassword");

// FIREBASE ERROR HANDLER
function getFirebaseErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
      return "Invalid email or password. Check your login details.";

    case "auth/user-not-found":
      return "No Firebase account found with this email.";

    case "auth/wrong-password":
      return "Incorrect password. Please check your password.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/too-many-requests":
      return "Too many login attempts. Please wait before trying again.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/user-disabled":
      return "This account has been disabled. Contact your administrator.";

    case "auth/operation-not-allowed":
      return "Email and password login is not enabled in Firebase.";

    default:
      return `Error code: ${error.code || "unknown"} | ${error.message}`;
  }
}

// LOGIN
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const role = document.getElementById("role").value;
  const email = document.getElementById("email").value.trim();
  const password = document.getElementById("password").value;

  if (!role || !email || !password) {
    message.textContent = "Please fill in all fields.";
    return;
  }

  loginButton.disabled = true;
  loginButton.textContent = "Logging in...";
  message.textContent = "Connecting to Firebase...";

  try {
    // STEP 1: FIREBASE LOGIN
    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    console.log("Firebase login successful.");
    console.log("User UID:", result.user.uid);
    console.log("User email:", result.user.email);

    message.textContent = "Checking account permissions...";

    // STEP 2: CHECK FIREBASE ROLE CLAIMS
    const tokenResult = await result.user.getIdTokenResult(true);
    const claims = tokenResult.claims;

    console.log("FIREBASE ROLE CLAIMS:", claims);

    let roleValid = false;

    if (role === "Student" && claims.role === "Student") {
      roleValid = true;
    }

    if (role === "Administrator" && claims.admin === true) {
      roleValid = true;
    }

    if (role === "Teacher" && claims.role === "Teacher") {
      roleValid = true;
    }

    if (role === "Parent" && claims.role === "Parent") {
      roleValid = true;
    }

    if (role === "Warden" && claims.role === "Warden") {
      roleValid = true;
    }

    if (!roleValid) {
      await signOut(auth);
      throw new Error(
        `Your Firebase account does not have the required ${role} role. Contact your administrator.`
      );
    }

    // STEP 3: GET FIREBASE TOKEN
    const idToken = await result.user.getIdToken(true);

    // STEP 4: SAVE SESSION
    sessionStorage.setItem("token", idToken);
    sessionStorage.setItem("userEmail", result.user.email);
    sessionStorage.setItem("userRole", role);
    sessionStorage.setItem("userUid", result.user.uid);

    message.textContent = "Login successful!";

    // STEP 5: ROLE-BASED REDIRECT
    if (role === "Student") {
      window.location.href = "student-dashboard.html";
      return;
    }

    if (role === "Administrator") {
      window.location.href = "admin.html";
      return;
    }

    message.textContent =
      `Login successful as ${role}. Dashboard setup is pending.`;

  } catch (error) {
    console.error("CAMPUSOS LOGIN ERROR:", error);

    message.textContent = getFirebaseErrorMessage(error);

  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});

// FORGOT PASSWORD
forgotPassword.addEventListener("click", (event) => {
  event.preventDefault();

  message.textContent =
    "Please contact your college administrator to reset your password.";
});

