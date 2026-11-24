
const express = require("express");
const router = express.Router();
require("dotenv").config();

const { auth } = require("./firebaseAdmin");

let aiClient = null;

async function getAIClient() {
    if (!process.env.GEMINI_API_KEY) {
        throw new Error("Gemini API key is missing.");
    }

    if (!aiClient) {
        const { GoogleGenAI } = await import("@google/genai");

        aiClient = new GoogleGenAI({
            apiKey: process.env.GEMINI_API_KEY
        });
    }

    return aiClient;
}

// Verify Firebase student login
async function verifyStudent(req, res, next) {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ")
            ? header.substring(7)
            : null;

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Please log in first."
            });
        }

        const decoded = await auth.verifyIdToken(token);

        if (decoded.role !== "Student") {
            return res.status(403).json({
                success: false,
                message: "Student access only."
            });
        }

        req.student = decoded;
        next();

    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Authentication failed. Please log in again."
        });
    }
}

// CAMPUSOS AI ASSISTANT
router.post("/student/ai/chat", verifyStudent, async (req, res) => {
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

        const response = await ai.models.generateContent({
            model: "gemini-3.8-flash",
            contents: message,
            config: {
                systemInstruction:
                    "You are CampusOS AI Assistant, a friendly educational assistant. " +
                    "Help students with all academic subjects, programming, mathematics, " +
                    "science, engineering, languages, general knowledge and everyday " +
                    "questions. Explain concepts in simple beginner-friendly steps. " +
                    "Use examples when useful. Help students learn rather than simply " +
                    "giving unexplained answers. Be respectful and supportive. " +
                    "Never claim to know private college records or student information. " +
                    "Do not ask students to share passwords, API keys or private personal data."
            }
        });

        const answer = response.text;

        if (!answer) {
            return res.status(502).json({
                success: false,
                message: "AI did not return an answer. Please try again."
            });
        }

        return res.json({
            success: true,
            answer
        });

    } catch (error) {
        console.error("CampusOS AI error:", error.message);

        return res.status(500).json({
            success: false,
            message: "AI assistant is temporarily unavailable. Please try again."
        });
    }
});

module.exports = router;


