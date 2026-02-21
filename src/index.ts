require("dotenv").config();

import express from "express";
import Groq from "groq-sdk";
import { BASE_PROMPT, getSystemPrompt } from "./prompts";
import { basePrompt as nodeBasePrompt } from "./defaults/node";
import { basePrompt as reactBasePrompt } from "./defaults/react";
import cors from "cors";

const app = express();

// Enhanced CORS configuration
app.use(cors({
    origin: (origin, callback) => {
        const allowed = [
            'http://localhost:5173',
            'http://localhost:5174',
            'http://localhost:5175',
            'http://localhost:3000',
            'http://localhost:5190',
            'https://ai-web-builder-frontend.vercel.app',
        ];
        // Allow requests with no origin (curl, mobile apps)
        if (!origin) return callback(null, true);
        // Allow exact matches and any Vercel deployment URL
        if (allowed.includes(origin) || /\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }
        callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

if (!process.env.GROQ_API_KEY) {
    console.error("GROQ_API_KEY not found");
    process.exit(1);
}

console.log("Groq API Key found");

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

app.post("/template", async (req, res) => {
    try {
        console.log("Template request:", req.body.prompt);

        const prompt = req.body.prompt;
        if (!prompt) {
            return res.status(400).json({ message: "Prompt required" });
        }

        const completion = await groq.chat.completions.create({
            messages: [{
                role: "system",
                content: "Return 'node' or 'react' based on the project type. Only one word."
            }, {
                role: "user",
                content: prompt
            }],
            model: "llama-3.1-8b-instant",
            max_tokens: 50,
            temperature: 0,
        });

        const answer = completion.choices[0]?.message?.content?.trim().toLowerCase() || "react";

        console.log("🤖 Response:", answer);

        if (answer.includes("react")) {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n - .gitignore\n - package-lock.json\n`],
                uiPrompts: [reactBasePrompt]
            });
            return;
        }

        if (answer.includes("node")) {
            res.json({
                prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${nodeBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n - .gitignore\n - package-lock.json\n`],
                uiPrompts: [nodeBasePrompt]
            });
            return;
        }

        res.json({
            prompts: [BASE_PROMPT, `Here is an artifact that contains all files of the project visible to you.\nConsider the contents of ALL files in the project.\n\n${reactBasePrompt}\n\nHere is a list of files that exist on the file system but are not being shown to you:\n\n - .gitignore\n - package-lock.json\n`],
            uiPrompts: [reactBasePrompt]
        });

    } catch (error) {
        console.error("Template error:", error);
        res.status(500).json({ message: "Template error" });
    }
});

app.post("/chat", async (req, res) => {
    try {
        console.log("💬 Chat request received");

        const requestMessages = req.body.messages;
        if (!requestMessages || !Array.isArray(requestMessages)) {
            return res.status(400).json({ message: "Messages required" });
        }

        const completion = await groq.chat.completions.create({
            messages: [
                { role: "system", content: getSystemPrompt() },
                ...requestMessages.map((msg: any) => ({
                    role: msg.role,
                    content: msg.content
                }))
            ],
            model: "llama-3.3-70b-versatile",
            max_tokens: 16000,
            temperature: 0.1,
        });

        const response = completion.choices[0]?.message?.content || "";

        console.log("✅ Chat response received");
        res.json({ response });

    } catch (error) {
        console.error("Chat error:", error);
        res.status(500).json({ message: "Chat error" });
    }
});

app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Using Groq API");
});
