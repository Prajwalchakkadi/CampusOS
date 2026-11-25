(() => {
    "use strict";

    const API_URL = window.location.origin;
    const token = sessionStorage.getItem("token");
    const role = sessionStorage.getItem("userRole");

    const $ = id => document.getElementById(id);

    if (!token || role !== "Student") {
        alert("Please log in using your student account.");
        window.location.replace("index.html");
        return;
    }

    const chatArea = $("chatArea");
    const messages = $("messages");
    const welcomeScreen = $("welcomeScreen");
    const typing = $("typingIndicator");
    const input = $("messageInput");
    const sendBtn = $("sendBtn");
    const chatForm = $("chatForm");

    const STORAGE_KEY = "campusOS_AI_chat_history";
    let activeMode = "General";
    let chatHistory = [];

    const modeInstructions = {
        General: "Answer as a helpful and accurate student assistant.",
        Study: "Use Study Mode. Explain concepts in simple beginner-friendly steps, with examples and a short recap.",
        Programming: "Use Programming Help Mode. Explain code line by line, identify errors, and provide working examples suitable for beginners.",
        Exam: "Use Exam Preparation Mode. Give exam-focused explanations, important points, practice questions and revision tips. Do not claim questions will definitely appear in an exam.",
        Notes: "Use Notes Generator Mode. Create organized notes with headings, definitions, examples, key points and a short summary."
    };

    function saveHistory() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(chatHistory.slice(-60)));
        } catch (error) {
            console.warn("Could not save AI chat history:", error);
        }
    }

    function loadHistory() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            if (Array.isArray(saved)) {
                chatHistory = saved.filter(item =>
                    item &&
                    ["user", "assistant"].includes(item.role) &&
                    typeof item.text === "string"
                ).slice(-60);
            }
        } catch {
            chatHistory = [];
        }

        chatHistory.forEach(item => renderMessage(item.role, item.text));
        updateWelcome();
    }

    function updateWelcome() {
        welcomeScreen.classList.toggle("hidden", chatHistory.length > 0);
    }

    function renderMessage(role, text) {
        const row = document.createElement("div");
        row.className = `message ${role === "user" ? "user" : "assistant"}`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = role === "user" ? "YOU" : "AI";

        const content = document.createElement("div");
        content.className = "message-content";
        content.textContent = text;

        row.append(avatar, content);
        messages.appendChild(row);

        chatArea.scrollTop = chatArea.scrollHeight;
    }

    function addMessage(role, text) {
        chatHistory.push({ role, text, time: Date.now() });
        saveHistory();
        renderMessage(role, text);
        updateWelcome();
    }

    function setMode(mode) {
        if (!modeInstructions[mode]) return;

        activeMode = mode;

        document.querySelectorAll(".mode-side").forEach(button => {
            button.classList.toggle("active", button.dataset.mode === mode);
        });

        $("activeModeLabel").textContent = mode.toUpperCase() +
            (mode === "General" ? " ASSISTANT" : " MODE");
    }

    async function sendMessage(message) {
        const cleanMessage = message.trim();

        if (!cleanMessage || sendBtn.disabled) return;

        if (cleanMessage.length > 4000) {
            alert("Please keep your question under 4000 characters.");
            return;
        }

        addMessage("user", cleanMessage);
        input.value = "";
        input.style.height = "auto";

        sendBtn.disabled = true;
        typing.classList.remove("hidden");

        try {
            const contextualMessage =
                `[${activeMode} Mode]\n` +
                `${modeInstructions[activeMode]}\n\n` +
                `Student question:\n${cleanMessage}`;

            const response = await fetch(`${API_URL}/api/student/ai/chat`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${sessionStorage.getItem("token")}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ message: contextualMessage })
            });

            const result = await response.json();

            if (response.status === 401) {
                sessionStorage.clear();
                alert("Your login session has expired. Please log in again.");
                window.location.replace("index.html");
                return;
            }

            if (!response.ok) {
                throw new Error(result.message || "AI request failed.");
            }

            if (!result.answer) {
                throw new Error("AI did not return an answer.");
            }

            addMessage("assistant", result.answer);

        } catch (error) {
            console.error("CampusOS AI error:", error);
            addMessage(
                "assistant",
                "Sorry, I could not get a response right now.\n\n" +
                error.message +
                "\n\nPlease check your internet connection and try again."
            );
        } finally {
            typing.classList.add("hidden");
            sendBtn.disabled = false;
            input.focus();
        }
    }

    chatForm.addEventListener("submit", event => {
        event.preventDefault();
        sendMessage(input.value);
    });

    input.addEventListener("input", () => {
        input.style.height = "auto";
        input.style.height = Math.min(input.scrollHeight, 130) + "px";
    });

    input.addEventListener("keydown", event => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            chatForm.requestSubmit();
        }
    });

    document.querySelectorAll(".mode-side").forEach(button => {
        button.addEventListener("click", () => {
            setMode(button.dataset.mode);
            $("sidebar").classList.remove("open");
        });
    });

    document.querySelectorAll(".suggestion").forEach(button => {
        button.addEventListener("click", () => {
            sendMessage(button.dataset.prompt || "");
        });
    });

    $("newChatBtn").addEventListener("click", () => {
        chatHistory = [];
        saveHistory();
        messages.replaceChildren();
        updateWelcome();
        input.focus();
        $("sidebar").classList.remove("open");
    });

    $("clearHistoryBtn").addEventListener("click", () => {
        if (!confirm("Delete all saved AI conversation history on this device?")) return;

        chatHistory = [];
        saveHistory();
        messages.replaceChildren();
        updateWelcome();
    });

    $("menuBtn").addEventListener("click", () => {
        $("sidebar").classList.toggle("open");
    });

    loadHistory();
    setMode("General");
})();
