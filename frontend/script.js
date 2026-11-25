import { auth } from "./firebase.js";

import {
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const forgotPassword = document.getElementById("forgotPassword");

const emailInput =
    document.getElementById("email") ||
    document.getElementById("loginEmail");

const passwordInput =
    document.getElementById("password") ||
    document.getElementById("loginPassword");

const roleInput =
    document.getElementById("role") ||
    document.getElementById("userRole");

const loginButton = loginForm?.querySelector(
    'button[type="submit"], input[type="submit"]'
);

function showMessage(text, type = "error") {
    if (!message) {
        alert(text);
        return;
    }

    message.textContent = text;
    message.style.display = "block";
    message.style.color = type === "success" ? "#087443" : "#dc2626";
}

function clearSession() {
    [
        "token",
        "userEmail",
        "userRole",
        "userName",
        "user",
        "userUid"
    ].forEach(key => sessionStorage.removeItem(key));
}

function saveSession(token, user, role) {
    sessionStorage.setItem("token", token);
    sessionStorage.setItem("userEmail", user.email || "");
    sessionStorage.setItem("userRole", role);
    sessionStorage.setItem("userName", user.displayName || user.email || "");
    sessionStorage.setItem("userUid", user.uid);

    sessionStorage.setItem("user", JSON.stringify({
        uid: user.uid,
        email: user.email,
        name: user.displayName || user.email,
        role
    }));
}

function getDashboard(role) {
    const dashboards = {
        Student: "student-home.html",
        Teacher: "teacher-dashboard.html",
        Parent: "parent-dashboard.html",
        Administrator: "admin.html",
        Warden: "warden-dashboard.html"
    };

    return dashboards[role] || null;
}

function getActualRole(claims) {
    if (claims.admin === true) {
        return "Administrator";
    }

    const role = claims.role;

    const allowedRoles = [
        "Student",
        "Teacher",
        "Parent",
        "Administrator",
        "Warden"
    ];

    if (allowedRoles.includes(role)) {
        return role;
    }

    return null;
}

function getFirebaseErrorMessage(error) {
    const errors = {
        "auth/invalid-email": "Please enter a valid email address.",
        "auth/user-not-found": "No account found with this email.",
        "auth/wrong-password": "Incorrect password.",
        "auth/invalid-credential": "Incorrect email or password.",
        "auth/too-many-requests": "Too many attempts. Please try again later.",
        "auth/network-request-failed": "Network error. Check your internet connection.",
        "auth/user-disabled": "This account has been disabled."
    };

    return errors[error.code] || error.message || "Login failed. Please try again.";
}

if (loginForm) {
    loginForm.addEventListener("submit", async function(event) {
        event.preventDefault();

        const email = emailInput?.value.trim();
        const password = passwordInput?.value;
        const selectedRole = roleInput?.value;

        if (!email || !password || !selectedRole) {
            showMessage("Please enter your email, password and select your role.");
            return;
        }

        if (loginButton) {
            loginButton.disabled = true;
            loginButton.textContent = "Signing in...";
        }

        clearSession();
        showMessage("Verifying your account...", "success");

        try {
            const credential = await signInWithEmailAndPassword(
                auth,
                email,
                password
            );

            const user = credential.user;

            const tokenResult = await user.getIdTokenResult(true);
            const actualRole = getActualRole(tokenResult.claims);

            if (!actualRole) {
                await signOut(auth);
                throw new Error(
                    "Your account role is not configured. Contact the College Administrator."
                );
            }

            if (actualRole !== selectedRole) {
                await signOut(auth);
                throw new Error(
                    "Selected role does not match your account. Please select " +
                    actualRole + "."
                );
            }

            const dashboard = getDashboard(actualRole);

            if (!dashboard) {
                await signOut(auth);
                throw new Error("Dashboard not configured for this account.");
            }

            saveSession(tokenResult.token, user, actualRole);

            showMessage("Login successful. Opening your dashboard...", "success");

            window.location.replace(dashboard);

        } catch (error) {
            clearSession();

            console.error("CampusOS login error:", error);

            showMessage(getFirebaseErrorMessage(error));

        } finally {
            if (loginButton) {
                loginButton.disabled = false;
                loginButton.textContent = "Login";
            }
        }
    });
} else {
    console.error("CampusOS: loginForm element was not found.");
}

if (forgotPassword) {
    forgotPassword.addEventListener("click", async function(event) {
        event.preventDefault();

        const email = emailInput?.value.trim();

        if (!email) {
            showMessage("Enter your email address first.");
            emailInput?.focus();
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            showMessage("Password reset email sent. Check your inbox.", "success");
        } catch (error) {
            showMessage(getFirebaseErrorMessage(error));
        }
    });
}
