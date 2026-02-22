require("dotenv").config();

import express from "express";
import Groq from "groq-sdk";
import { getSystemPrompt } from "./prompts";
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
        const prompt = req.body.prompt;
        if (!prompt) return res.status(400).json({ message: "Prompt required" });

        const completion = await groq.chat.completions.create({
            messages: [{
                role: "system",
                content: "Return 'node' or 'react' based on project. One word only."
            }, {
                role: "user",
                content: prompt
            }],
            model: "llama-3.1-8b-instant",
            max_tokens: 10,
        });

        const answer = completion.choices[0]?.message?.content?.trim().toLowerCase() || "react";
        const isReact = answer.includes("react");

        res.json({
            prompts: [
                `Base project: ${isReact ? 'react' : 'node'}. Instructions: ${isReact ? reactBasePrompt : nodeBasePrompt}`
            ],
            uiPrompts: [isReact ? reactBasePrompt : nodeBasePrompt]
        });

    } catch (error) {
        console.error("Template error:", error);
        res.status(500).json({ message: "Template error" });
    }
});

app.post("/chat", async (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    try {
        console.log("💬 Streaming chat request received");

        const requestMessages = req.body.messages;
        if (!requestMessages || !Array.isArray(requestMessages)) {
            res.write(`data: ${JSON.stringify({ error: "Messages required" })}\n\n`);
            res.end();
            return;
        }

        const apiMessages = [
            { role: "system" as const, content: getSystemPrompt() },
            ...requestMessages.map((msg: any) => ({
                role: msg.role as "user" | "assistant",
                content: msg.content as string
            }))
        ];

        const models = [
            { name: "llama-3.1-8b-instant", maxTokens: 8000 },
            { name: "llama-3.2-11b-vision-preview", maxTokens: 8000 },
            { name: "llama-3.2-3b-preview", maxTokens: 8000 },
            { name: "mixtral-8x7b-32768", maxTokens: 8000 },
            { name: "llama3-8b-8192", maxTokens: 8000 },
            { name: "llama-3.3-70b-versatile", maxTokens: 8000 },
        ];

        let success = false;
        let lastError = "";

        for (const model of models) {
            try {
                console.log(`🤖 Attempting stream with model: ${model.name}`);

                // Send an initial event with the model name so frontend knows what is happening
                res.write(`data: ${JSON.stringify({ model: model.name, status: "starting" })}\n\n`);

                const stream = await groq.chat.completions.create({
                    messages: apiMessages,
                    model: model.name,
                    max_tokens: model.maxTokens,
                    temperature: 0.2,
                    stream: true,
                });

                let fullResponse = "";
                for await (const chunk of stream) {
                    const content = chunk.choices[0]?.delta?.content || "";
                    if (content) {
                        fullResponse += content;
                        res.write(`data: ${JSON.stringify({ chunk: content, model: model.name })}\n\n`);
                    }
                }

                console.log(`✅ Stream finished from ${model.name} (${fullResponse.length} chars)`);
                res.write(`data: ${JSON.stringify({ done: true, model: model.name })}\n\n`);
                res.end();
                success = true;
                break;
            } catch (modelError: any) {
                const status = modelError?.status || "Unknown";
                const msg = modelError?.message || String(modelError);
                lastError = msg;
                console.error(`❌ Model ${model.name} failed (${status}):`, msg);

                // If this isn't the last model, we send a notification to the frontend that we're switching
                if (model !== models[models.length - 1]) {
                    res.write(`data: ${JSON.stringify({
                        warning: `Model ${model.name} busy, trying next...`,
                        retry: true
                    })}\n\n`);
                }
            }
        }

        if (!success) {
            console.error("❌ All models failed. Last error:", lastError);
            res.write(`data: ${JSON.stringify({ error: `All AI models are currently busy or rate-limited. Please try again in a few minutes. (Last error: ${lastError})` })}\n\n`);
            res.end();
        }

    } catch (error: any) {
        const errMsg = error?.message || "Internal server error";
        console.error("Global Chat error:", errMsg);
        res.write(`data: ${JSON.stringify({ error: `Chat error: ${errMsg}` })}\n\n`);
        res.end();
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
