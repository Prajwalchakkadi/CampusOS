const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
require("dotenv").config();

const app = express();

// MIDDLEWARE
app.use(cors());
app.use(express.json());

// SERVER CONFIGURATION
const PORT = process.env.PORT || 5000;

const JWT_SECRET =
    process.env.JWT_SECRET || "campusos_demo_secret_change_later";

// DEMO USER ACCOUNTS
const demoAccounts = [
    {
        id: 1,
        name: "Demo Student",
        email: "student@campusos.test",
        password: "Student@123",
        role: "Student"
    },
    {
        id: 2,
        name: "Demo Parent",
        email: "parent@campusos.test",
        password: "Parent@123",
        role: "Parent"
    },
    {
        id: 3,
        name: "Demo Teacher",
        email: "teacher@campusos.test",
        password: "Teacher@123",
        role: "Teacher"
    },
    {
        id: 4,
        name: "Demo Administrator",
        email: "admin@campusos.test",
        password: "Admin@123",
        role: "Administrator"
    },
    {
        id: 5,
        name: "Demo Warden",
        email: "warden@campusos.test",
        password: "Warden@123",
        role: "Warden"
    }
];

// TEMPORARY STUDENT ATTENDANCE DATA
const attendanceRecords = [
    {
        subject: "Programming in C",
        classType: "Lecture",
        date: "2026-11-09",
        status: "Present"
    },
    {
        subject: "Engineering Physics",
        classType: "Lab",
        date: "2026-11-09",
        status: "Present"
    },
    {
        subject: "Mathematics",
        classType: "Lecture",
        date: "2026-11-08",
        status: "Absent"
    }
];

// TEMPORARY TEACHER SESSIONS
const teacherSessions = [];

// JWT AUTHENTICATION MIDDLEWARE
function authenticateToken(req, res, next) {

    const authHeader = req.headers["authorization"];

    const token =
        authHeader && authHeader.split(" ")[1];

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access token required."
        });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {

        if (err) {
            return res.status(403).json({
                success: false,
                message: "Invalid or expired token."
            });
        }

        req.user = user;
        next();
    });
}

// HEALTH CHECK API
app.get("/", (req, res) => {

    res.json({
        success: true,
        message: "CampusOS Backend is running!"
    });

});

// LOGIN API
app.post("/api/auth/login", (req, res) => {

    try {

        const { email, password, role } = req.body || {};

        if (!email || !password || !role) {
            return res.status(400).json({
                success: false,
                message: "Email, password and role are required."
            });
        }

        const user = demoAccounts.find(account =>
            account.email.toLowerCase() === email.toLowerCase() &&
            account.role === role
        );

        if (!user) {
            return res.status(401).json({
                success: false,
                message: "Account not found."
            });
        }

        if (password !== user.password) {
            return res.status(401).json({
                success: false,
                message: "Incorrect password."
            });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            {
                expiresIn: "2h"
            }
        );

        res.json({
            success: true,
            message: "Login successful!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {

        console.error("Login error:", error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });

    }

});

// STUDENT DASHBOARD API
app.get(
    "/api/student/dashboard",
    authenticateToken,
    (req, res) => {

        if (req.user.role !== "Student") {
            return res.status(403).json({
                success: false,
                message: "Student access only."
            });
        }

        const student = demoAccounts.find(
            account => account.id === req.user.sub
        );

        if (!student) {
            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        res.json({
            success: true,
            message: "Welcome to CampusOS Student Dashboard!",
            student: {
                id: student.id,
                name: student.name,
                email: student.email,
                role: student.role
            }
        });

    }
);

// STUDENT ATTENDANCE API
app.get(
    "/api/student/attendance",
    authenticateToken,
    (req, res) => {

        if (req.user.role !== "Student") {
            return res.status(403).json({
                success: false,
                message: "Student access only."
            });
        }

        const totalClasses = attendanceRecords.length;

        const presentClasses = attendanceRecords.filter(
            record => record.status === "Present"
        ).length;

        const absentClasses = attendanceRecords.filter(
            record => record.status === "Absent"
        ).length;

        const percentage = totalClasses === 0
            ? 0
            : Math.round(
                (presentClasses / totalClasses) * 100
            );

        res.json({
            success: true,
            attendance: {
                totalClasses,
                presentClasses,
                absentClasses,
                percentage
            },
            records: attendanceRecords
        });

    }
);

// CREATE TEACHER ATTENDANCE SESSION
app.post(
    "/api/teacher/sessions",
    authenticateToken,
    (req, res) => {

        if (req.user.role !== "Teacher") {
            return res.status(403).json({
                success: false,
                message: "Teacher access only."
            });
        }

        // Protect against missing request body
        const {
            subject,
            classType,
            classroom
        } = req.body || {};

        if (!subject || !classType || !classroom) {
            return res.status(400).json({
                success: false,
                message: "Please provide subject, class type and classroom."
            });
        }

        if (!["Lecture", "Lab"].includes(classType)) {
            return res.status(400).json({
                success: false,
                message: "Class type must be Lecture or Lab."
            });
        }

        const session = {
            id: crypto.randomUUID(),
            teacherId: req.user.sub,
            subject,
            classType,
            classroom,
            sessionCode: crypto.randomBytes(4).toString("hex"),
            createdAt: new Date().toISOString(),
            status: "Active"
        };

        teacherSessions.push(session);

        res.status(201).json({
            success: true,
            message: "Attendance session created successfully!",
            session
        });

    }
);

// VIEW TEACHER ATTENDANCE SESSIONS
app.get(
    "/api/teacher/sessions",
    authenticateToken,
    (req, res) => {

        if (req.user.role !== "Teacher") {
            return res.status(403).json({
                success: false,
                message: "Teacher access only."
            });
        }

        const mySessions = teacherSessions.filter(
            session => session.teacherId === req.user.sub
        );

        res.json({
            success: true,
            sessions: mySessions
        });

    }
);

// START SERVER
app.listen(PORT, () => {

    console.log(
        `CampusOS server running at http://localhost:${PORT}`
    );

});