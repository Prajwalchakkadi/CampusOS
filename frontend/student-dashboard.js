const token = sessionStorage.getItem("token");

const statusMessage = document.getElementById("status");

// Check authentication
if (!token) {
    alert("Please login first!");
    window.location.href = "index.html";
}

// Load Student Dashboard
async function loadStudentDashboard() {
    try {
        const response = await fetch(
            "http://localhost:5000/api/student/dashboard",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Dashboard loading failed");
        }

        document.getElementById("studentId").textContent =
            data.student.id;

        document.getElementById("studentEmail").textContent =
            data.student.email;

        document.getElementById("studentRole").textContent =
            data.student.role;

        statusMessage.textContent =
            "Connected successfully to CampusOS!";

        statusMessage.style.color = "green";

    } catch (error) {
        statusMessage.textContent = error.message;
        statusMessage.style.color = "red";
        console.error(error);
    }
}

// Load Student Attendance
async function loadStudentAttendance() {
    try {
        const response = await fetch(
            "http://localhost:5000/api/student/attendance",
            {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || "Attendance loading failed");
        }

        // Display attendance summary
        document.getElementById("attendancePercentage").textContent =
            data.summary.attendancePercentage + "%";

        document.getElementById("totalClasses").textContent =
            data.summary.totalClasses;

        document.getElementById("presentClasses").textContent =
            data.summary.presentClasses;

        document.getElementById("absentClasses").textContent =
            data.summary.totalClasses - data.summary.presentClasses;

        // Display attendance records
        const recordsContainer =
            document.getElementById("attendanceRecords");

        recordsContainer.innerHTML = "";

        data.records.forEach(record => {
            const row = document.createElement("tr");

            [
                record.subject,
                record.classType,
                record.date,
                record.status
            ].forEach(value => {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            recordsContainer.appendChild(row);
        });

        // Calculate subject-wise attendance
        const subjectSummary = {};

        data.records.forEach(record => {
            if (!subjectSummary[record.subject]) {
                subjectSummary[record.subject] = {
                    total: 0,
                    present: 0
                };
            }

            subjectSummary[record.subject].total++;

            if (record.status === "Present") {
                subjectSummary[record.subject].present++;
            }
        });

        const subjectContainer =
            document.getElementById("subjectAttendance");

        subjectContainer.innerHTML = "";

        Object.entries(subjectSummary).forEach(([subject, details]) => {
            const percentage = Math.round(
                (details.present / details.total) * 100
            );

            const row = document.createElement("tr");

            [subject, `${details.present}/${details.total}`, `${percentage}%`]
                .forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value;
                    row.appendChild(cell);
                });

            subjectContainer.appendChild(row);
        });

        console.log("Attendance loaded successfully!");

    } catch (error) {
        console.error("Attendance Error:", error);

        const recordsContainer =
            document.getElementById("attendanceRecords");

        if (recordsContainer) {
            recordsContainer.textContent = error.message;
        }
    }
}

// Logout
document.getElementById("logoutBtn").addEventListener("click", () => {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");

    window.location.href = "index.html";
});

// Load dashboard and attendance
if (token) {
    loadStudentDashboard();
    loadStudentAttendance();
}