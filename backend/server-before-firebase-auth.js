const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
require("dotenv").config();
const { admin, db, auth } = require("./firebaseAdmin");

const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET =
    process.env.JWT_SECRET || "campusos_demo_secret_change_later";

const QR_EXPIRY_MS = 2 * 60 * 1000;

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

// EXISTING DEMO ATTENDANCE
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

// TEMPORARY IN-MEMORY DATA
const teacherSessions = [];
const liveAttendanceRecords = [];

// AUTHENTICATION MIDDLEWARE
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(" ")[1];

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

// ROLE CHECK
function requireRole(role) {
    return (req, res, next) => {
        if (req.user.role !== role) {
            return res.status(403).json({
                success: false,
                message: `${role} access only.`
            });
        }

        next();
    };
}

// CHECK QR TOKEN SAFELY
function tokensMatch(received, expected) {
    if (typeof received !== "string" ||
        typeof expected !== "string") {
        return false;
    }

    const a = Buffer.from(received);
    const b = Buffer.from(expected);

    return a.length === b.length &&
        crypto.timingSafeEqual(a, b);
}

// HEALTH CHECK
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

        if (!user || password !== user.password) {
            return res.status(401).json({
                success: false,
                message: "Invalid email, password or role."
            });
        }

        const token = jwt.sign(
            {
                sub: user.id,
                email: user.email,
                role: user.role
            },
            JWT_SECRET,
            { expiresIn: "2h" }
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
    requireRole("Student"),
    (req, res) => {
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
    requireRole("Student"),
    (req, res) => {
        const myLiveRecords = liveAttendanceRecords
            .filter(record => record.studentId === req.user.sub)
            .map(record => ({
                subject: record.subject,
                classType: record.classType,
                classroom: record.classroom,
                date: record.date,
                status: record.status
            }));

        const records = [
            ...attendanceRecords,
            ...myLiveRecords
        ];

        const totalClasses = records.length;
        const presentClasses = records.filter(
            record => record.status === "Present"
        ).length;
        const absentClasses = records.filter(
            record => record.status === "Absent"
        ).length;

        const percentage = totalClasses === 0
            ? 0
            : Math.round((presentClasses / totalClasses) * 100);

        res.json({
            success: true,
            attendance: {
                totalClasses,
                presentClasses,
                absentClasses,
                percentage
            },
            records
        });
    }
);

// CREATE TEACHER SESSION AND GENERATE QR
app.post(
    "/api/teacher/sessions",
    authenticateToken,
    requireRole("Teacher"),
    async (req, res) => {
        try {
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

            const sessionId = crypto.randomUUID();
            const qrToken = crypto.randomBytes(32).toString("hex");
            const createdAt = new Date();
            const expiresAt = new Date(
                createdAt.getTime() + QR_EXPIRY_MS
            );

            // QR contains only the session ID and random token.
            const qrPayload = JSON.stringify({
                sessionId,
                qrToken
            });

            const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

            const session = {
                id: sessionId,
                teacherId: req.user.sub,
                subject,
                classType,
                classroom,
                qrToken,
                qrCodeDataUrl,
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                status: "Active"
            };

            teacherSessions.push(session);

            res.status(201).json({
                success: true,
                message: "Attendance session and QR code created!",
                session: {
                    id: session.id,
                    subject: session.subject,
                    classType: session.classType,
                    classroom: session.classroom,
                    qrCodeDataUrl: session.qrCodeDataUrl,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt,
                    status: session.status
                }
            });
        } catch (error) {
            console.error("Session creation error:", error);

            res.status(500).json({
                success: false,
                message: "Could not create attendance session."
            });
        }
    }
);

// VIEW TEACHER SESSIONS
app.get(
    "/api/teacher/sessions",
    authenticateToken,
    requireRole("Teacher"),
    (req, res) => {
        const now = Date.now();

        const mySessions = teacherSessions
            .filter(session => session.teacherId === req.user.sub)
            .map(session => {
                const expired =
                    now >= new Date(session.expiresAt).getTime();

                return {
                    id: session.id,
                    subject: session.subject,
                    classType: session.classType,
                    classroom: session.classroom,
                    qrCodeDataUrl: session.qrCodeDataUrl,
                    createdAt: session.createdAt,
                    expiresAt: session.expiresAt,
                    status: expired ? "Expired" : "Active",
                    attendanceCount: liveAttendanceRecords.filter(
                        record => record.sessionId === session.id
                    ).length
                };
            });

        res.json({
            success: true,
            sessions: mySessions
        });
    }
);

// STUDENT SCANS QR AND MARKS ATTENDANCE
app.post(
    "/api/student/attendance/scan",
    authenticateToken,
    requireRole("Student"),
    (req, res) => {
        const { sessionId, qrToken } = req.body || {};

        if (!sessionId || !qrToken) {
            return res.status(400).json({
                success: false,
                message: "Session ID and QR token are required."
            });
        }

        const session = teacherSessions.find(
            item => item.id === sessionId
        );

        if (!session) {
            return res.status(404).json({
                success: false,
                message: "Attendance session not found."
            });
        }

        if (Date.now() >= new Date(session.expiresAt).getTime()) {
            session.status = "Expired";

            return res.status(410).json({
                success: false,
                message: "This QR code has expired. Ask your teacher for a new one."
            });
        }

        if (!tokensMatch(qrToken, session.qrToken)) {
            return res.status(403).json({
                success: false,
                message: "Invalid QR code."
            });
        }

        const alreadyMarked = liveAttendanceRecords.some(
            record =>
                record.sessionId === session.id &&
                record.studentId === req.user.sub
        );

        if (alreadyMarked) {
            return res.status(409).json({
                success: false,
                message: "Attendance has already been marked for this session."
            });
        }

        const student = demoAccounts.find(
            account => account.id === req.user.sub
        );

        const record = {
            id: crypto.randomUUID(),
            sessionId: session.id,
            studentId: req.user.sub,
            studentName: student.name,
            subject: session.subject,
            classType: session.classType,
            classroom: session.classroom,
            date: new Date().toISOString().slice(0, 10),
            markedAt: new Date().toISOString(),
            status: "Present"
        };

        liveAttendanceRecords.push(record);

        res.status(201).json({
            success: true,
            message: "Attendance marked successfully!",
            attendance: {
                subject: record.subject,
                classType: record.classType,
                classroom: record.classroom,
                date: record.date,
                status: record.status,
                markedAt: record.markedAt
            }
        });
    }
);

app.use("/api/admin", require("./studentAccountRoutes"));
// START SERVER
app.listen(PORT, () => {
    console.log(
        `CampusOS server running at http://localhost:${PORT}`
    );
});