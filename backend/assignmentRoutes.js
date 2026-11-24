const express = require("express");
const crypto = require("crypto");
const { db, auth } = require("./firebaseAdmin");
const { FieldValue } = require("firebase-admin/firestore");

const router = express.Router();

// Verify Firebase ID token and user role.
async function authenticate(req, res, next) {
    try {
        const header = req.headers.authorization || "";

        if (!header.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Firebase token required."
            });
        }

        const token = header.slice(7).trim();
        const decoded = await auth.verifyIdToken(token);

        req.account = decoded;
        return next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired Firebase token."
        });
    }
}

// Only an administrator can manage assignments.
function requireAdmin(req, res, next) {
    if (req.account.admin !== true) {
        return res.status(403).json({
            success: false,
            message: "Administrator access required."
        });
    }

    next();
}

// Only a teacher can access their own assignments.
function requireTeacher(req, res, next) {
    if (req.account.role !== "Teacher") {
        return res.status(403).json({
            success: false,
            message: "Teacher access required."
        });
    }

    next();
}

// GET ALL ACTIVE TEACHERS (ADMIN)
router.get(
    "/teachers",
    authenticate,
    requireAdmin,
    async (req, res) => {
        try {
            const snapshot = await db
                .collection("teachers")
                .where("accountStatus", "==", "active")
                .get();

            const teachers = snapshot.docs.map(doc => {
                const data = doc.data();

                return {
                    uid: doc.id,
                    name: data.name || "",
                    email: data.email || ""
                };
            });

            return res.json({
                success: true,
                teachers
            });
        } catch (error) {
            console.error("Load teachers error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load teachers."
            });
        }
    }
);

// GET APPROVED STUDENTS WITH CREATED ACCOUNTS (ADMIN)
router.get(
    "/students",
    authenticate,
    requireAdmin,
    async (req, res) => {
        try {
            const snapshot = await db
                .collection("pendingRegistrations")
                .where("status", "==", "approved")
                .get();

            const students = snapshot.docs
                .map(doc => {
                    const data = doc.data();

                    return {
                        applicationId: doc.id,
                        uid: data.studentUid || "",
                        name: data.studentName || "",
                        email: data.email || "",
                        registrationNumber:
                            data.registrationNumber || ""
                    };
                })
                .filter(student => student.uid);

            return res.json({
                success: true,
                students
            });
        } catch (error) {
            console.error("Load students error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load students."
            });
        }
    }
);

// ADMIN ASSIGNS A STUDENT TO A TEACHER
router.post(
    "/assignments",
    authenticate,
    requireAdmin,
    async (req, res) => {
        try {
            const {
                teacherUid,
                studentUid,
                className,
                section,
                semester,
                subject
            } = req.body || {};

            const values = {
                teacherUid,
                studentUid,
                className,
                section,
                semester,
                subject
            };

            for (const [field, value] of Object.entries(values)) {
                if (
                    typeof value !== "string" ||
                    !value.trim()
                ) {
                    return res.status(400).json({
                        success: false,
                        message: `${field} is required.`
                    });
                }
            }

            const assignment = {
                teacherUid: teacherUid.trim(),
                studentUid: studentUid.trim(),
                className: className.trim(),
                section: section.trim(),
                semester: semester.trim(),
                subject: subject.trim()
            };

            // Confirm that the teacher exists and is active.
            const teacherDoc = await db
                .collection("teachers")
                .doc(assignment.teacherUid)
                .get();

            if (
                !teacherDoc.exists ||
                teacherDoc.data().accountStatus !== "active"
            ) {
                return res.status(404).json({
                    success: false,
                    message: "Active teacher account not found."
                });
            }

            // Confirm that the student has an approved application
            // linked to their Firebase account.
            const studentSnapshot = await db
                .collection("pendingRegistrations")
                .where("studentUid", "==", assignment.studentUid)
                .where("status", "==", "approved")
                .limit(1)
                .get();

            if (studentSnapshot.empty) {
                return res.status(404).json({
                    success: false,
                    message: "Approved student account not found."
                });
            }

            const studentData = studentSnapshot.docs[0].data();

            // Stable ID prevents the same assignment being created twice.
            const assignmentId = crypto
                .createHash("sha256")
                .update([
                    assignment.teacherUid,
                    assignment.studentUid,
                    assignment.className.toLowerCase(),
                    assignment.section.toLowerCase(),
                    assignment.semester.toLowerCase(),
                    assignment.subject.toLowerCase()
                ].join("|"))
                .digest("hex");

            const assignmentRef = db
                .collection("studentAssignments")
                .doc(assignmentId);

            const existing = await assignmentRef.get();

            if (existing.exists) {
                return res.status(409).json({
                    success: false,
                    message: "This assignment already exists."
                });
            }

            await assignmentRef.create({
                ...assignment,
                studentName: studentData.studentName || "",
                studentEmail: studentData.email || "",
                teacherName: teacherDoc.data().name || "",
                status: "active",
                createdAt: FieldValue.serverTimestamp(),
                createdBy: req.account.uid
            });

            return res.status(201).json({
                success: true,
                message: "Student assigned to teacher successfully.",
                assignmentId
            });
        } catch (error) {
            console.error("Create assignment error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create assignment."
            });
        }
    }
);

// TEACHER CAN VIEW ONLY THEIR OWN ASSIGNMENTS
router.get(
    "/teacher/assignments",
    authenticate,
    requireTeacher,
    async (req, res) => {
        try {
            const snapshot = await db
                .collection("studentAssignments")
                .where("teacherUid", "==", req.account.uid)
                .where("status", "==", "active")
                .get();

            const assignments = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            return res.json({
                success: true,
                assignments
            });
        } catch (error) {
            console.error("Teacher assignments error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to load teacher assignments."
            });
        }
    }
);

module.exports = router;
