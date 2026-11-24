
const express = require("express");
const crypto = require("crypto");
const { db, auth } = require("./firebaseAdmin");
const { FieldValue } = require("firebase-admin/firestore");
const { sendPasswordSetupEmail } = require("./emailService");

const router = express.Router();

// ==========================================
// VERIFY FIREBASE ADMINISTRATOR
// ==========================================

async function verifyAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || "";

    const token = header.startsWith("Bearer ")
      ? header.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Admin token required."
      });
    }

    const decoded = await auth.verifyIdToken(token);

    if (decoded.admin !== true) {
      return res.status(403).json({
        success: false,
        message: "Administrator access required."
      });
    }

    req.adminUser = decoded;
    return next();

  } catch (error) {
    console.error("Admin verification error:", error.message);

    return res.status(401).json({
      success: false,
      message: "Invalid or expired Firebase token."
    });
  }
}

// ==========================================
// CREATE APPROVED STUDENT ACCOUNT
// ==========================================

router.post(
  "/applications/:applicationId/create-account",
  verifyAdmin,
  async (req, res) => {
    try {
      const applicationId = req.params.applicationId;

      // GET STUDENT APPLICATION
      const applicationRef = db
        .collection("pendingRegistrations")
        .doc(applicationId);

      const snapshot = await applicationRef.get();

      if (!snapshot.exists) {
        return res.status(404).json({
          success: false,
          message: "Student application not found."
        });
      }

      const student = snapshot.data();

      // CHECK APPROVAL STATUS
      if (student.status !== "approved") {
        return res.status(400).json({
          success: false,
          message: "Approve the application first."
        });
      }

      // GET STUDENT EMAIL
      const email = String(student.email || "")
        .trim()
        .toLowerCase();

      if (!email) {
        return res.status(400).json({
          success: false,
          message: "Student email is missing."
        });
      }

      let user;

      // ======================================
      // CHECK EXISTING FIREBASE ACCOUNT
      // ======================================

      try {
        user = await auth.getUserByEmail(email);

        const belongsToApplication =
          user.customClaims?.applicationId === applicationId &&
          user.customClaims?.role === "Student";

        const linkedToApplication =
          student.studentUid === user.uid;

        if (!belongsToApplication && !linkedToApplication) {
          return res.status(409).json({
            success: false,
            message: "This email already belongs to another account."
          });
        }

      } catch (error) {

        if (error.code !== "auth/user-not-found") {
          throw error;
        }

        // CREATE NEW FIREBASE ACCOUNT
        user = await auth.createUser({
          email,
          password: crypto.randomBytes(32).toString("hex"),
          displayName: student.studentName || "CampusOS Student",
          emailVerified: false,
          disabled: false
        });
      }

      // ======================================
      // ENSURE STUDENT FIREBASE ROLE
      // ======================================

      await auth.setCustomUserClaims(user.uid, {
        ...(user.customClaims || {}),
        role: "Student",
        applicationId: applicationId
      });

      // ======================================
      // GENERATE PASSWORD SETUP LINK
      // ======================================

      const setupLink =
        await auth.generatePasswordResetLink(email);

      // SEND PASSWORD SETUP EMAIL
      await sendPasswordSetupEmail(email, setupLink);

      // ======================================
      // UPDATE FIRESTORE APPLICATION
      // ======================================

      await applicationRef.update({
        credentialStatus: "issued",
        studentUid: user.uid,
        credentialIssuedAt: FieldValue.serverTimestamp()
      });

      // SUCCESS RESPONSE
      return res.status(200).json({
        success: true,
        message: "Student account created and setup email sent.",
        email: email
      });

    } catch (error) {

      console.error(
        "Student account creation error:",
        error
      );

      return res.status(500).json({
        success: false,
        message: "Unable to create student account."
      });
    }
  }
);

// ==========================================
// EXPORT ROUTER
// ==========================================


// ==========================================
// CREATE TEACHER FIREBASE ACCOUNT
// ==========================================
router.post(
    "/teachers/create-account",
    verifyAdmin,
    async (req, res) => {
        try {
            const name = String(req.body.name || "").trim();
            const email = String(req.body.email || "").trim().toLowerCase();

            if (!name || !email) {
                return res.status(400).json({
                    success: false,
                    message: "Teacher name and email are required."
                });
            }

            const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailPattern.test(email)) {
                return res.status(400).json({
                    success: false,
                    message: "Enter a valid teacher email address."
                });
            }

            // Prevent duplicate teacher profiles or accounts.
            const existingProfile = await db
                .collection("teachers")
                .where("email", "==", email)
                .limit(1)
                .get();

            if (!existingProfile.empty) {
                return res.status(409).json({
                    success: false,
                    message: "A teacher profile already exists for this email."
                });
            }

            let user;

            try {
                user = await auth.getUserByEmail(email);

                if (user.customClaims?.role !== "Teacher") {
                    return res.status(409).json({
                        success: false,
                        message: "This email already belongs to another account."
                    });
                }

                return res.status(409).json({
                    success: false,
                    message: "A Firebase Teacher account already exists for this email. Check the teachers collection."
                });
            } catch (error) {
                if (error.code !== "auth/user-not-found") {
                    throw error;
                }
            }

            // Create Firebase Authentication account.
            user = await auth.createUser({
                email,
                password: crypto.randomBytes(32).toString("hex"),
                displayName: name,
                emailVerified: false,
                disabled: false
            });

            // Assign the Teacher role securely.
            await auth.setCustomUserClaims(user.uid, {
                ...(user.customClaims || {}),
                role: "Teacher"
            });

            // Generate password setup link and send email.
            const setupLink = await auth.generatePasswordResetLink(email);
            await sendPasswordSetupEmail(email, setupLink);

            // Save teacher profile in Firestore.
            await db.collection("teachers").doc(user.uid).set({
                uid: user.uid,
                name,
                email,
                role: "Teacher",
                accountStatus: "active",
                credentialStatus: "issued",
                createdAt: FieldValue.serverTimestamp(),
                createdBy: req.adminUser.uid
            });

            return res.status(201).json({
                success: true,
                message: "Teacher account created and password setup email sent.",
                email
            });

        } catch (error) {
            console.error("Teacher account creation error:", error);

            return res.status(500).json({
                success: false,
                message: "Unable to create teacher account."
            });
        }
    }
);

module.exports = router;

