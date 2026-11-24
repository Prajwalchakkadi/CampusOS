
const express = require("express");
const cors = require("cors");
const crypto = require("crypto");
const QRCode = require("qrcode");
const path = require("path");
require("dotenv").config();

const { db, auth } = require("./firebaseAdmin");

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

// SERVE FRONTEND
app.use(express.static(path.join(__dirname, "../frontend")));

const PORT = process.env.PORT || 5000;
const QR_EXPIRY_MS = 2 * 60 * 1000;

// CAMPUSOS BACKEND HEALTH CHECK
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "CampusOS Backend is running!"
    });
});

// TERMINAL COLORS
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

// FIREBASE AUTHENTICATION
async function authenticateToken(req, res, next) {
    const header = req.headers.authorization || "";

    if (!header.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Firebase access token required."
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

    } catch (error) {
        logError("Firebase authentication failed");
        console.error(error.code || error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired Firebase token."
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

    return (
        a.length === b.length &&
        crypto.timingSafeEqual(a, b)
    );
}

// STUDENT PROFILE
async function getStudentProfile(user) {
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

// ROOT HEALTH CHECK
app.get("/", (req, res) => {
    res.json({
        success: true,
        message: "CampusOS Backend is running!"
    });
});

// STUDENT DASHBOARD
app.get(
    "/api/student/dashboard",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            const student = await getStudentProfile(req.user);

            return res.json({
                success: true,
                message: "Welcome to CampusOS Student Dashboard!",
                student
            });

        } catch (error) {
            logError("Student dashboard error");
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Unable to load student dashboard."
            });
        }
    }
);

// STUDENT ATTENDANCE - FIRESTORE
app.get(
    "/api/student/attendance",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
            const snapshot = await db
                .collection("attendanceRecords")
                .where("studentId", "==", req.user.sub)
                .get();

            const records = snapshot.docs.map(doc => {
                const data = doc.data();

                return {
                    id: doc.id,
                    subject: data.subject || "",
                    classType: data.classType || "",
                    classroom: data.classroom || "",
                    date: data.date || "",
                    markedAt: data.markedAt || "",
                    status: data.status || ""
                };
            });

            records.sort((a, b) =>
                String(b.markedAt).localeCompare(String(a.markedAt))
            );

            const totalClasses = records.length;

            const presentClasses = records.filter(
                record => record.status === "Present"
            ).length;

            const absentClasses = records.filter(
                record => record.status === "Absent"
            ).length;

            const attendancePercentage = totalClasses === 0
                ? 0
                : Math.round(
                    (presentClasses / totalClasses) * 100
                );

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

        } catch (error) {
            logError("Student attendance error");
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Unable to load attendance records."
            });
        }
    }
);

// FACE ENROLLMENT STATUS
app.get(
    "/api/student/face-enrollment",
    authenticateToken,
    requireRole("Student"),
    async (req, res) => {
        try {
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
            logError("Face enrollment status error");
            console.error(error);

            return res.status(500).json({
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

            const now = new Date().toISOString();

            await reference.set({
                studentUid: req.user.sub,
                studentEmail: req.user.email || "",
                consentGiven: true,
                consentVersion: "1.0",
                consentedAt: now,
                status: "pending_provider",
                provider: null,
                updatedAt: now
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

            return res.status(500).json({
                success: false,
                message: "Unable to save face enrollment consent."
            });
        }
    }
);

// TEACHER CREATES LECTURE QR - FIRESTORE
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

            const qrCodeDataUrl = await QRCode.toDataURL(qrPayload);

            const session = {
                id: sessionId,
                teacherId: String(req.user.sub),
                subject: String(subject).trim(),
                classType,
                classroom: String(classroom).trim(),
                qrToken,
                qrCodeDataUrl,
                createdAt: createdAt.toISOString(),
                expiresAt: expiresAt.toISOString(),
                status: "Active",
                attendanceCount: 0
            };

            await db
                .collection("teacherAttendanceSessions")
                .doc(sessionId)
                .set(session);

            logSuccess(
                `Firestore attendance QR created: ${subject}`
            );

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

            return res.status(500).json({
                success: false,
                message: "Could not create attendance QR."
            });
        }
    }
);

// TEACHER SESSION HISTORY - FIRESTORE
app.get(
    "/api/teacher/sessions",
    authenticateToken,
    requireRole("Teacher"),
    async (req, res) => {
        try {
            const snapshot = await db
                .collection("teacherAttendanceSessions")
                .where(
                    "teacherId",
                    "==",
                    String(req.user.sub)
                )
                .get();

            const now = Date.now();

            const mySessions = snapshot.docs
                .map(doc => {
                    const session = doc.data();

                    const expired =
                        now >= new Date(session.expiresAt).getTime();

                    return {
                        id: doc.id,
                        subject: session.subject,
                        classType: session.classType,
                        classroom: session.classroom,
                        qrCodeDataUrl: session.qrCodeDataUrl,
                        createdAt: session.createdAt,
                        expiresAt: session.expiresAt,
                        status: expired ? "Expired" : "Active",
                        attendanceCount:
                            session.attendanceCount || 0
                    };
                })
                .sort((a, b) =>
                    new Date(b.createdAt) - new Date(a.createdAt)
                );

            return res.json({
                success: true,
                sessions: mySessions
            });

        } catch (error) {
            logError("Teacher session history error");
            console.error(error);

            return res.status(500).json({
                success: false,
                message: "Unable to load teacher sessions."
            });
        }
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

            const sessionRef = db
                .collection("teacherAttendanceSessions")
                .doc(String(sessionId));

            const sessionSnapshot = await sessionRef.get();

            if (!sessionSnapshot.exists) {
                return res.status(404).json({
                    success: false,
                    message: "Attendance session not found."
                });
            }

            const session = sessionSnapshot.data();

            if (
                !session.expiresAt ||
                Date.now() >= new Date(session.expiresAt).getTime()
            ) {
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

            const faceSnapshot = await db
                .collection("studentFaceEnrollments")
                .doc(req.user.sub)
                .get();

            if (
                !faceSnapshot.exists ||
                faceSnapshot.data().consentGiven !== true
            ) {
                return res.status(403).json({
                    success: false,
                    message: "Please provide face-enrollment consent before continuing."
                });
            }

            // QR VALIDATED.
            // CAMERA PREVIEW MAY START ON THE FRONTEND.
            // REAL FACE MATCHING AND LIVENESS ARE NOT CONNECTED.
            // ATTENDANCE MUST NOT BE MARKED AT THIS STAGE.

            return res.status(200).json({
                success: true,
                stage: "face_verification_required",
                verificationAvailable: false,
                sessionId: String(sessionId),
                session: {
                    subject: session.subject || "",
                    classType: session.classType || "",
                    classroom: session.classroom || ""
                },
                message: "QR validated. Face camera can now be activated. Secure face verification is not connected yet, so attendance has not been marked."
            });

        } catch (error) {
            logError("Attendance scan error");
            console.error(error);

            return res.status(500).json({
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

    console.log(
        `${colors.magenta}${colors.bold}╔══════════════════════════════════════╗${colors.reset}`
    );

    console.log(
        `${colors.magenta}${colors.bold}║          CAMPUSOS SERVER             ║${colors.reset}`
    );

    console.log(
        `${colors.magenta}${colors.bold}╚══════════════════════════════════════╝${colors.reset}`
    );

    logSuccess(`Server running at http://localhost:${PORT}`);
    logSuccess("Firebase Admin module loaded");
    logInfo("Firestore teacher sessions enabled.");
    logInfo("Firestore student attendance retrieval enabled.");
    logInfo("CampusOS is ready to receive requests.");

    console.log("\n");
});

