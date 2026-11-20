const loginForm = document.getElementById("loginForm");
const message = document.getElementById("message");
const loginButton = loginForm.querySelector('button[type="submit"]');

const API_URL = "http://localhost:5000/api/auth/login";

// LOGIN FORM
loginForm.addEventListener("submit", async function (event) {

    event.preventDefault();

    const role = document.getElementById("role").value;
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    if (!role || !email || !password) {
        message.style.color = "red";
        message.textContent = "Please fill in all fields.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "Logging in...";

    message.style.color = "#1264a3";
    message.textContent = "Connecting to CampusOS server...";

    try {

        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                email: email,
                password: password,
                role: role
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed.");
        }

        // SAVE LOGIN INFORMATION
        sessionStorage.setItem("token", data.token);

        sessionStorage.setItem(
            "user",
            JSON.stringify(data.user)
        );

        sessionStorage.setItem("userName", data.user.name);
        sessionStorage.setItem("userEmail", data.user.email);

        message.style.color = "green";
        message.textContent =
            "Welcome " + data.user.name +
            "! Login successful as " + data.user.role + ".";

        console.log("CampusOS Login Successful:", data.user);

        // REDIRECT BASED ON ROLE
        setTimeout(() => {

            if (data.user.role === "Student") {
                window.location.href = "student-dashboard.html";
            }

            else if (data.user.role === "Teacher") {
                window.location.href = "teacher-dashboard.html";
            }

            else if (data.user.role === "Parent") {
                window.location.href = "parent-dashboard.html";
            }

            else if (data.user.role === "Administrator") {
                window.location.href = "admin-dashboard.html";
            }

            else if (data.user.role === "Warden") {
                window.location.href = "warden-dashboard.html";
            }

            else {
                message.textContent = "Unknown user role.";
            }

        }, 1000);

    } catch (error) {

        message.style.color = "red";
        message.textContent = error.message;

        console.error("Login Error:", error);

    } finally {

        loginButton.disabled = false;
        loginButton.textContent = "Login";

    }

});

// FORGOT PASSWORD
document.getElementById("forgotPassword")
    .addEventListener("click", function (event) {

        event.preventDefault();

        message.style.color = "#1264a3";

        message.textContent =
            "Please contact your college administrator for password recovery.";

    });