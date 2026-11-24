
const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const QRCode = require("qrcode");
require("dotenv").config();


const { db, auth } = require("./firebaseAdmin");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

const path = require("path");

// Serve CampusOS frontend files
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 5000;
const JWT_SECRET =
    process.env.JWT_SECRET || "campusos_demo_secret_change_later";

const QR_EXPIRY_MS = 2 * 60 * 1000;

// COLOURED TERMINAL MESSAGES
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    magenta: "\x1b[35m",
    bold: "\x1b[1m"
};

function logSuccess(message) {
    console.log(`${colors.green}✔ ${message}${colors.reset}`);
}

function logError(message) {
    console.error(`${colors.red}✖ ${message}${colors.reset}`);
}

function logInfo(message) {
    console.log(`${colors.cyan}➜ ${message}${colors.reset}`);
}

// DEMO ACCOUNTS
const demoAccounts = [
    { id: 1, name: "Demo Student", email: "student@campusos.test", password: "Student@123", role: "Student" },
    { id: 2, name: "Demo Parent", email: "parent@campusos.test", password: "Parent@123", role: "Parent" },
    { id: 3, name: "Demo Teacher", email: "teacher@campusos.test", password: "Teacher@123", role: "Teacher" },
    { id: 4, name: "Demo Administrator", email: "admin@campusos.test", password: "Admin@123", role: "Administrator" },
    { id: 5, name: "Demo Warden", email: "warden@campusos.test", password: "Warden@123", role: "Warden" }
];

// DEMO ATTENDANCE
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

const teacherSessions = [];
const liveAttendanceRecords = [];

// AUTHENTICATION MIDDLEWARE
async function authenticateToken(req, res, next) {
    console.log("AUTH CHECK:", req.originalUrl, req.headers.authorization ? "TOKEN RECEIVED" : "NO TOKEN");
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Access token required."
        });
    }

    const token = header.slice(7).trim();

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Access token is empty."
        });
    }

    try {
        const decoded = await auth.verifyIdToken(token);

        let role = decoded.role;

        if (decoded.admin === true) {
            role = "Administrator";
        }

        req.user = {
            ...decoded,
            sub: decoded.uid,
            role,
            authType: "firebase"
        };

        return next();

    } catch (firebaseError) {
        logError("FIREBASE TOKEN ERROR");
        console.error("Error code:", firebaseError.code);
        console.error("Error message:", firebaseError.message);

        jwt.verify(token, JWT_SECRET, (error, user) => {
            if (error) {
                return res.status(403).json({
                    success: false,
                    message: "Firebase error: " + (firebaseError.code || firebaseError.message) + " | JWT error: " + error.message
                });
            }

            req.user = {
                ...user,
                authType: "demo"
            };

            return next();
        });
    }
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

// SAFE QR TOKEN COMPARISON
function tokensMatch(received, expected) {
    if (
        typeof received !== "string" ||
        typeof expected !== "string"
    ) {
        return false;
    }

    const a = Buffer.from(received);
    const b = Buffer.from(expected);

    return a.length === b.length &&
        crypto.timingSafeEqual(a, b);
}

// STUDENT PROFILE
async function getStudentProfile(user) {
    if (user.authType === "demo") {
        return demoAccounts.find(
            account => String(account.id) === String(user.sub)
        ) || null;
    }

    const snapshot = await db
        .collection("pendingRegistrations")
        .where("studentUid", "==", user.sub)
        .limit(1)
        .get();

    if (snapshot.empty) {
        return {
            id: user.sub,
            uid: user.sub,
            name: user.name || user.email || "CampusOS Student",
            email: user.email || "",
            role: "Student"
        };
    }

    const data = snapshot.docs[0].data();

    return {
        id: user.sub,
        uid: user.sub,
        name: data.studentName || "CampusOS Student",
        email: data.email || user.email || "",
        role: "Student",
        registrationNumber: data.registrationNumber || "",
        applicationId: data.applicationId || user.applicationId || ""
    };
}

// HEALTH CHECK
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CampusOS Backend is running!"
    });
});

// DEMO LOGIN
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
                message: "Invalid demo email, password or role."
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

        logSuccess(`Demo login: ${user.role}`);

        return res.json({
            success: true,
            message: "Demo login successful!",
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role
            }
        });

    } catch (error) {
        logError("Demo login error");
        console.error(error);

        res.status(500).json({
            success: false,
            message: "Login failed."
        });
    }
});

// STUDENT DASHBOARD
app.get(
    "/api/student/dashboard",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            const student = await getStudentProfile(req.user);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found."
                });
            }

            return res.json({
                success: true,
                message: "Welcome to CampusOS Student Dashboard!",
                student
            });

        } catch (error) {
            logError("Dashboard error");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to load student dashboard."
            });
        }
    }
);

// STUDENT ATTENDANCE
app.get(
    "/api/student/attendance",
    authenticateToken,
    requireRole("Student"),
    (req, res) => {
        const myLiveRecords = liveAttendanceRecords
            .filter(record =>
                String(record.studentId) === String(req.user.sub)
            )
            .map(record => ({
                subject: record.subject,
                classType: record.classType,
                classroom: record.classroom,
                date: record.date,
                status: record.status
            }));

        const records = [
            ...(req.user.authType === "demo"
                ? attendanceRecords
                : []),
            ...myLiveRecords
        ];

        const totalClasses = records.length;

        const presentClasses = records.filter(
            record => record.status === "Present"
        ).length;

        const absentClasses = records.filter(
            record => record.status === "Absent"
        ).length;

        const attendancePercentage = totalClasses === 0
            ? 0
            : Math.round((presentClasses / totalClasses) * 100);

        return res.json({
            success: true,
            summary: {
                totalClasses,
                presentClasses,
                absentClasses,
                attendancePercentage
            },
            attendance: {
                totalClasses,
                presentClasses,
                absentClasses,
                percentage: attendancePercentage
            },
            records
        });
    }
);

// FACE ENROLLMENT STATUS
app.get(
    "/api/student/face-enrollment",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            if (req.user.authType === "demo") {
                return res.json({
                    success: true,
                    enrolled: false,
                    status: "demo_account",
                    message: "Use an approved student account."
                });
            }

            const reference = db
                .collection("studentFaceEnrollments")
                .doc(req.user.sub);

            const snapshot = await reference.get();

            if (!snapshot.exists) {
                return res.json({
                    success: true,
                    enrolled: false,
                    consentGiven: false,
                    status: "not_enrolled"
                });
            }

            const data = snapshot.data();

            return res.json({
                success: true,
                enrolled: data.status === "verified",
                consentGiven: data.consentGiven === true,
                status: data.status
            });

        } catch (error) {
            logError("Face status error");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to check face enrollment."
            });
        }
    }
);

// FACE ENROLLMENT CONSENT
app.post(
    "/api/student/face-enrollment/consent",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            if (req.user.authType !== "firebase") {
                return res.status(403).json({
                    success: false,
                    message: "A real student account is required."
                });
            }

            const { consent } = req.body || {};

            if (consent !== true) {
                return res.status(400).json({
                    success: false,
                    message: "Explicit consent is required."
                });
            }

            const reference = db
                .collection("studentFaceEnrollments")
                .doc(req.user.sub);

            const existing = await reference.get();

            if (
                existing.exists &&
                existing.data().status === "verified"
            ) {
                return res.json({
                    success: true,
                    enrolled: true,
                    message: "Face enrollment is already verified."
                });
            }

            await reference.set({
                studentUid: req.user.sub,
                studentEmail: req.user.email || "",
                consentGiven: true,
                consentVersion: "1.0",
                consentedAt: new Date().toISOString(),
                status: "pending_provider",
                provider: null,
                updatedAt: new Date().toISOString()
            }, { merge: true });

            return res.status(201).json({
                success: true,
                enrolled: false,
                status: "pending_provider",
                message: "Consent saved. Secure face verification provider setup is still required."
            });

        } catch (error) {
            logError("Face consent error");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to save face enrollment consent."
            });
        }
    }
);

// TEACHER CREATES LECTURE QR
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
                    message: "Subject, class type and classroom are required."
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

            const qrPayload = JSON.stringify({
                sessionId,
                qrToken
            });

            const qrCodeDataUrl =
                await QRCode.toDataURL(qrPayload);

            const session = {
                id: sessionId,
                teacherId: String(req.user.sub),
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

            logSuccess(`Attendance QR created: ${subject}`);

            return res.status(201).json({
                success: true,
                message: "Attendance QR created!",
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
            logError("QR creation error");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Could not create attendance QR."
            });
        }
    }
);

// TEACHER SESSION HISTORY
app.get(
    "/api/teacher/sessions",
    authenticateToken,
    requireRole("Teacher"),
    (req, res) => {
        const now = Date.now();

        const mySessions = teacherSessions
            .filter(session =>
                session.teacherId === String(req.user.sub)
            )
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

// STUDENT SCANS TEACHER QR
app.post(
    "/api/student/attendance/scan",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            const { sessionId, qrToken } = req.body || {};

            if (!sessionId || !qrToken) {
                return res.status(400).json({
                    success: false,
                    message: "Session ID and QR token are required."
                });
            }

            if (req.user.authType === "firebase") {
                const faceSnapshot = await db
                    .collection("studentFaceEnrollments")
                    .doc(req.user.sub)
                    .get();

                if (
                    !faceSnapshot.exists ||
                    faceSnapshot.data().status !== "verified"
                ) {
                    return res.status(403).json({
                        success: false,
                        message: "Verified face enrollment is required before attendance."
                    });
                }

                return res.status(501).json({
                    success: false,
                    message: "Live face verification provider is not connected yet. Attendance is not marked."
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
                    message: "QR code expired. Ask your teacher for a new one."
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
                    String(record.studentId) === String(req.user.sub)
            );

            if (alreadyMarked) {
                return res.status(409).json({
                    success: false,
                    message: "Attendance already marked."
                });
            }

            const student = await getStudentProfile(req.user);

            if (!student) {
                return res.status(404).json({
                    success: false,
                    message: "Student not found."
                });
            }

            const record = {
                id: crypto.randomUUID(),
                sessionId: session.id,
                studentId: String(req.user.sub),
                studentName: student.name,
                subject: session.subject,
                classType: session.classType,
                classroom: session.classroom,
                date: new Date().toISOString().slice(0, 10),
                markedAt: new Date().toISOString(),
                status: "Present"
            };

            liveAttendanceRecords.push(record);

            logSuccess(`Demo attendance marked: ${student.name}`);

            return res.status(201).json({
                success: true,
                message: "Demo attendance marked successfully!",
                attendance: {
                    subject: record.subject,
                    classType: record.classType,
                    classroom: record.classroom,
                    date: record.date,
                    status: record.status,
                    markedAt: record.markedAt
                }
            });

        } catch (error) {
            logError("Attendance scan error");
            console.error(error);

            res.status(500).json({
                success: false,
                message: "Unable to process attendance."
            });
        }
    }
);

// ADMIN STUDENT ACCOUNT ROUTES
app.use(
    "/api/admin",
    require("./studentAccountRoutes")
);
// ADMIN AND TEACHER ASSIGNMENT ROUTES
app.use(
    "/api",
    require("./assignmentRoutes")
);
// START SERVER
app.listen(PORT, () => {
    console.log("\n");
    console.log(`${colors.magenta}${colors.bold}╔══════════════════════════════════════╗${colors.reset}`);
    console.log(`${colors.magenta}${colors.bold}║          CAMPUSOS SERVER             ║${colors.reset}`);
    console.log(`${colors.magenta}${colors.bold}╚══════════════════════════════════════╝${colors.reset}`);
    logSuccess(`Server running at http://localhost:${PORT}`);
    logSuccess("Firebase Admin module loaded");
    logInfo("CampusOS is ready to receive requests.");
    console.log("\n");
});




