
import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

// LOGIN ELEMENTS
const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

const loginButton = loginForm?.querySelector(
  'button[type="submit"]'
);

if (!loginForm || !message) {
  throw new Error(
    "CampusOS login form or message element not found."
  );
}

// DISPLAY MESSAGE
function showMessage(text) {
  message.textContent = text;
}

// SAVE USER SESSION
function saveSession(token, user) {
  sessionStorage.setItem("token", token);
  sessionStorage.setItem("userEmail", user.email || "");
  sessionStorage.setItem("userRole", user.role || "");
  sessionStorage.setItem("userName", user.name || "");
  sessionStorage.setItem("user", JSON.stringify(user));

  if (user.uid) {
    sessionStorage.setItem("userUid", user.uid);
  }
}

// REDIRECT USER
function redirectUser(role) {
  const dashboards = {
    Student: "student-dashboard.html",
    Teacher: "teacher-dashboard.html",
    Parent: "parent-dashboard.html",
    Administrator: "admin.html",
    Warden: "warden-dashboard.html"
  };

  const destination = dashboards[role];

  if (!destination) {
    showMessage("Dashboard is not configured for this role.");
    return;
  }

  window.location.href = destination;
}

// FIREBASE ERROR MESSAGES
function getFirebaseErrorMessage(error) {
  switch (error.code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
      return "Invalid email or password.";

    case "auth/user-not-found":
      return "No Firebase account found with this email.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/too-many-requests":
      return "Too many attempts. Please try again later.";

    case "auth/network-request-failed":
      return "Network error. Check your internet connection.";

    case "auth/user-disabled":
      return "This account is disabled.";

    default:
      return error.message || "Firebase login failed.";
  }
}

// VERIFY FIREBASE ROLE
function verifyUserRole(role, claims) {
  if (role === "Administrator") {
    return (
      claims.admin === true ||
      claims.role === "Administrator"
    );
  }

  return claims.role === role;
}

// REAL FIREBASE LOGIN
async function firebaseLogin(email, password, role) {
  const result = await signInWithEmailAndPassword(
    auth,
    email,
    password
  );

  const firebaseUser = result.user;

  // Force refresh to obtain the latest custom claims.
  const tokenResult = await firebaseUser.getIdTokenResult(true);

  const claims = tokenResult.claims;

  if (!verifyUserRole(role, claims)) {
    await signOut(auth);

    throw new Error(
      `Your Firebase account does not have the ${role} role.`
    );
  }

  return {
    token: tokenResult.token,

    user: {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || email,
      email: firebaseUser.email || email,
      role: role
    }
  };
}

// MAIN LOGIN
loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const role = document.getElementById("role")?.value;

  const email = document.getElementById("email")?.value
    ?.trim()
    .toLowerCase();

  const password = document.getElementById("password")?.value;

  if (!role || !email || !password) {
    showMessage("Please fill in all fields.");
    return;
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";
  }

  showMessage("Checking Firebase account...");

  try {
    const firebase = await firebaseLogin(
      email,
      password,
      role
    );

    saveSession(firebase.token, firebase.user);

    showMessage("Firebase login successful!");

    redirectUser(firebase.user.role);

  } catch (error) {
    console.error("CampusOS login error:", error);

    showMessage(
      error.code
        ? getFirebaseErrorMessage(error)
        : error.message || "Login failed."
    );

    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userName");
    sessionStorage.removeItem("userUid");
    sessionStorage.removeItem("user");

  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  }
});

// FORGOT PASSWORD
if (forgotPassword) {
  forgotPassword.addEventListener("click", (event) => {
    event.preventDefault();

    showMessage(
      "Contact your administrator to reset your password."
    );
  });
}

console.log("CampusOS Firebase login system loaded.");

