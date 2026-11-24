import { auth } from "./firebase.js";
import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

// ==========================================
// HTML ELEMENTS
// ==========================================

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

if (!loginForm || !message) {
  throw new Error("CampusOS login form or message element not found.");
}

const loginButton = loginForm.querySelector(
  'button[type="submit"]'
);

// ==========================================
// FIREBASE ERROR HANDLER
// ==========================================

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
      return error.message || "Something went wrong. Please try again.";
  }
}

// ==========================================
// ROLE VALIDATION
// ==========================================

function verifyUserRole(selectedRole, claims) {
  switch (selectedRole) {
    case "Student":
      return claims.role === "Student";

    case "Teacher":
      return claims.role === "Teacher";

    case "Parent":
      return claims.role === "Parent";

    case "Warden":
      return claims.role === "Warden";

    case "Administrator":
      return claims.admin === true;

    default:
      return false;
  }
}

// ==========================================
// ROLE-BASED DASHBOARD REDIRECTION
// ==========================================

function redirectUser(role) {
  const dashboards = {
    Student: "student-dashboard.html",
    Administrator: "admin.html",

    // Update these filenames if your dashboards
    // use different names.
    Teacher: "teacher-dashboard.html",
    Parent: "parent-dashboard.html",
    Warden: "warden-dashboard.html"
  };

  const destination = dashboards[role];

  if (!destination) {
    message.textContent =
      `Dashboard for ${role} is not configured.`;

    return;
  }

  window.location.href = destination;
}

// ==========================================
// FIREBASE LOGIN
// ==========================================

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const role = document.getElementById("role")?.value;
  const email = document.getElementById("email")?.value
    .trim()
    .toLowerCase();

  const password = document.getElementById("password")?.value;

  if (!role || !email || !password) {
    message.textContent = "Please fill in all fields.";
    return;
  }

  if (loginButton) {
    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";
  }

  message.textContent = "Connecting to Firebase...";

  let firebaseUser = null;

  try {
    // STEP 1: FIREBASE EMAIL AND PASSWORD LOGIN

    const result = await signInWithEmailAndPassword(
      auth,
      email,
      password
    );

    firebaseUser = result.user;

    console.log("Firebase login successful.");
    console.log("User UID:", firebaseUser.uid);
    console.log("User email:", firebaseUser.email);

    // STEP 2: REFRESH FIREBASE TOKEN AND GET CLAIMS

    message.textContent = "Checking account permissions...";

    const tokenResult = await firebaseUser.getIdTokenResult(true);

    const claims = tokenResult.claims;

    console.log("FIREBASE ROLE CLAIMS:", claims);

    // STEP 3: VERIFY SELECTED ROLE

    const roleValid = verifyUserRole(role, claims);

    if (!roleValid) {
      await signOut(auth);
      firebaseUser = null;

      throw new Error(
        `Your Firebase account does not have the required ${role} role. Contact your administrator.`
      );
    }

    // STEP 4: SAVE FIREBASE SESSION

    const idToken = tokenResult.token;

    sessionStorage.setItem("token", idToken);
    sessionStorage.setItem("userEmail", firebaseUser.email || email);
    sessionStorage.setItem("userRole", role);
    sessionStorage.setItem("userUid", firebaseUser.uid);

    message.textContent = "Login successful!";

    console.log("CampusOS role verified:", role);

    // STEP 5: REDIRECT TO CORRECT DASHBOARD

    redirectUser(role);

  } catch (error) {
    console.error("CAMPUSOS LOGIN ERROR:", error);

    message.textContent = getFirebaseErrorMessage(error);

    // Clear incomplete session after a failed login.
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("userEmail");
    sessionStorage.removeItem("userRole");
    sessionStorage.removeItem("userUid");

  } finally {
    if (loginButton) {
      loginButton.disabled = false;
      loginButton.textContent = "Login";
    }
  }
});

// ==========================================
// FORGOT PASSWORD
// ==========================================

if (forgotPassword) {
  forgotPassword.addEventListener("click", (event) => {
    event.preventDefault();

    message.textContent =
      "Please contact your college administrator to reset your password.";
  });
}

console.log("CampusOS login system loaded successfully.");

