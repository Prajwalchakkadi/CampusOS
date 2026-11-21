import { auth } from "./firebase.js";

import {
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = loginForm.querySelector('button[type="submit"]');

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
    const result = await signInWithEmailAndPassword(auth, email, password);

    const tokenResult = await result.user.getIdTokenResult(true);
    const isAdmin = tokenResult.claims.admin === true;

    if (role === "Administrator" && !isAdmin) {
      await signOut(auth);
      throw new Error("Administrator permission is missing.");
    }

    if (role !== "Administrator" && isAdmin) {
      await signOut(auth);
      throw new Error("Please select Administrator.");
    }

    sessionStorage.setItem("userEmail", result.user.email);
    sessionStorage.setItem("userRole", role);

    if (role === "Administrator") {
      window.location.href = "admin.html";
      return;
    }

    message.textContent = "Login successful. Dashboard setup pending.";

  } catch (error) {
    console.error("CAMPUSOS LOGIN ERROR:", error);
    message.textContent =
      (error.code || error.name || "Error") + ": " + error.message;
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Login";
  }
});

document.getElementById("forgotPassword").addEventListener("click", (event) => {
  event.preventDefault();
  message.textContent = "Please contact your college administrator.";
});
