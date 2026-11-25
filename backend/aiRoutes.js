
const express = require("express");
const router = express.Router();

require("dotenv").config();

const { auth } = require("./firebaseAdmin");

let aiClient = null;

// GEMINI CONNECTION
async function getAIClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("GEMINI_API_KEY is missing in .env");
    }

    if (!aiClient) {
        const { GoogleGenAI } = await import("@google/genai");

        aiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    return aiClient;
}

// FIREBASE AUTHENTICATION
async function authenticateStudent(req, res, next) {
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

        if (role !== "Student") {
            return res.status(403).json({
                success: false,
                message: "Student access only.",
                detectedRole: role || "No role claim"
            });
        }

        req.user = {
            ...decoded,
            sub: decoded.uid,
            role,
            authType: "firebase"
        };

        return next();

    } catch (error) {
        console.error(
            "CampusOS AI Firebase authentication error:",
            error.code || error.message
        );

        return res.status(401).json({
            success: false,
            message: "Invalid or expired Firebase token. Please log in again."
        });
    }
}

// GEMINI AUTOMATIC RETRY
async function generateWithRetry(ai, request) {
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await ai.models.generateContent(request);
        } catch (error) {
            const status = Number(error.status || error.code || 0);
            const temporary = [429, 500, 503].includes(status);

            if (!temporary || attempt === maxAttempts) {
                throw error;
            }

            const delay = attempt * 2000;

            console.log(
                `CampusOS AI: temporary Gemini error (${status}). Retrying in ${delay / 1000}s. Attempt ${attempt + 1}/${maxAttempts}.`
            );

            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

// CAMPUSOS AI ASSISTANT
router.post(
    "/student/ai/chat",
    authenticateStudent,
    async (req, res) => {
        try {
            const message = String(req.body.message || "").trim();

            if (!message) {
                return res.status(400).json({
                    success: false,
                    message: "Please enter a question."
                });
            }

            if (message.length > 4000) {
                return res.status(400).json({
                    success: false,
                    message: "Question must be under 4000 characters."
                });
            }

            const ai = await getAIClient();

            const response = await generateWithRetry(ai, {
                model: "gemini-3.8-flash",
                contents: message,
                config: {
                    systemInstruction:
                        "You are CampusOS AI Assistant. Help students with all academic subjects, " +
                        "mathematics, science, engineering, programming, languages, general knowledge " +
                        "and everyday questions. Explain concepts in simple beginner-friendly steps. " +
                        "Give examples and code when useful. Be patient, supportive and accurate. " +
                        "Do not claim access to private college records or student information. " +
                        "Never ask for passwords, API keys or private personal information."
                }
            });

            const answer = response.text;

            if (!answer) {
                return res.status(502).json({
                    success: false,
                    message: "AI did not return an answer."
                });
            }

            return res.json({
                success: true,
                answer
            });

        } catch (error) {
            console.error("CampusOS AI error:", error.message);

            const status = Number(error.status || error.code || 0);

            if ([429, 500, 503].includes(status)) {
                return res.status(503).json({
                    success: false,
                    message: "Gemini AI is currently busy. Please try again in a little while."
                });
            }

            return res.status(500).json({
                success: false,
                message: "AI assistant is temporarily unavailable."
            });
        }
    }
);

module.exports = router;


