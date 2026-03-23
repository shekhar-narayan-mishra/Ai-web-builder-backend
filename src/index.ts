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

const keyPrefix = process.env.GROQ_API_KEY.substring(0, 8);
const keyLen = process.env.GROQ_API_KEY.length;
console.log(`Groq API Key found (${keyPrefix}... length=${keyLen})`);

const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY
});

const MODELS = [
    { name: "llama-3.3-70b-versatile", maxTokens: 8192 },
    { name: "llama-3.1-70b-versatile", maxTokens: 8192 },
    { name: "llama-3.1-8b-instant", maxTokens: 8192 },
    { name: "gemma2-9b-it", maxTokens: 8192 },
];

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

app.post("/template", async (req, res) => {
    try {
        const prompt = req.body.prompt;
        if (!prompt) return res.status(400).json({ message: "Prompt required" });

        let success = false;
        let lastError = "";

        for (const model of MODELS) {
            try {
                console.log(`🤖 Attempting template classification with model: ${model.name}`);
                
                // Add delay between retries (skip first attempt)
                const modelIndex = MODELS.indexOf(model);
                if (modelIndex > 0) {
                    console.log(`⏳ Waiting 1s before trying ${model.name}...`);
                    await delay(1000);
                }

                const completion = await Promise.race([
                    groq.chat.completions.create({
                        messages: [{
                            role: "system",
                            content: "Classify the project type. Return ONLY the single word 'react' or 'node'.\n\nReturn 'react' for: ANY website, landing page, portfolio, dashboard, UI, frontend, web app, visual project, page with sections, blog, e-commerce site, form, gallery, or anything that a user would see in a browser.\n\nReturn 'node' ONLY for: pure backend APIs with no frontend, CLI command-line tools, scripts, or server-only utilities with no UI at all.\n\nWhen in doubt, ALWAYS return 'react'."
                        }, {
                            role: "user",
                            content: prompt
                        }],
                        model: model.name,
                        max_tokens: 10,
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Request timed out after 15s')), 15000))
                ]) as any;

                const answer = completion.choices[0]?.message?.content?.trim().toLowerCase() || "react";
                
                // Keyword-based override: if the prompt mentions any visual/website terms, force react
                const frontendKeywords = /\b(website|landing|page|portfolio|hero|section|dashboard|ui|frontend|blog|gallery|form|card|button|header|footer|nav|sidebar|layout|responsive|design|theme|dark.?mode|animation|image|photo|video|carousel|slider|modal|popup|menu|tab|accordion|table|chart|graph|login|signup|register|profile|checkout|cart|shop|store|e.?commerce|social|feed|chat|todo|calculator|weather|clock|timer|game|quiz|survey)\b/i;
                const isReact = frontendKeywords.test(prompt) || answer.includes("react");

                res.json({
                    prompts: [
                        `Base project: ${isReact ? 'react' : 'node'}. Instructions: ${isReact ? reactBasePrompt : nodeBasePrompt}`
                    ],
                    uiPrompts: [isReact ? reactBasePrompt : nodeBasePrompt]
                });

                success = true;
                console.log(`✅ Template classification successful with ${model.name}`);
                break;
            } catch (modelError: any) {
                const status = modelError?.status || "Unknown";
                lastError = modelError?.message || String(modelError);
                console.error(`❌ Model ${model.name} failed for template (${status}):`, lastError);
                
                // If it's an authentication error, don't bother trying other models
                if (status === 401) {
                    throw new Error("Invalid Groq API Key. Please check your GROQ_API_KEY environment variable.");
                }
            }
        }

        if (!success) {
            throw new Error(`All models failed for template. Last error: ${lastError}`);
        }

    } catch (error: any) {
        console.error("Critical Template error:", error.message);
        res.status(500).json({ 
            message: "Template error", 
            details: error.message,
            hint: error.message.includes("API Key") ? "Check your GROQ_API_KEY" : "Try again in a few minutes"
        });
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

        let success = false;
        let lastError = "";

        for (const model of MODELS) {
            try {
                console.log(`🤖 Attempting stream with model: ${model.name}`);

                // Add delay between retries (skip first attempt)
                const modelIndex = MODELS.indexOf(model);
                if (modelIndex > 0) {
                    console.log(`⏳ Waiting 1s before trying ${model.name}...`);
                    await delay(1000);
                }

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

                // If it's an authentication error, don't bother trying other models
                if (status === 401) {
                    res.write(`data: ${JSON.stringify({ error: "Invalid Groq API Key. Please check your GROQ_API_KEY environment variable.", status: 401 })}\n\n`);
                    res.end();
                    return;
                }

                // If this isn't the last model, we send a notification to the frontend that we're switching
                if (model !== MODELS[MODELS.length - 1]) {
                    res.write(`data: ${JSON.stringify({
                        warning: `Model ${model.name} ${status === 429 ? 'rate-limited' : 'busy'}, trying next...`,
                        retry: true
                    })}\n\n`);
                }
            }
        }

        if (!success) {
            console.error("❌ All models failed. Last error:", lastError);
            res.write(`data: ${JSON.stringify({ error: `All AI models are currently busy or rate-limited. (Last error: ${lastError})` })}\n\n`);
            res.end();
        }

    } catch (error: any) {
        const errMsg = error?.message || "Internal server error";
        console.error("Global Chat error:", errMsg);
        res.write(`data: ${JSON.stringify({ error: `Chat error: ${errMsg}` })}\n\n`);
        res.end();
    }
});

app.get("/", (req, res) => {
    res.json({ message: "AI Website Builder API is running" });
});

app.get("/health", (req, res) => {
    res.json({ status: "OK" });
});

app.get("/debug", async (req, res) => {
    const keyPrefix = process.env.GROQ_API_KEY?.substring(0, 8) || "NOT SET";
    const keyLen = process.env.GROQ_API_KEY?.length || 0;
    try {
        const test = await groq.chat.completions.create({
            messages: [{ role: "user", content: "Say OK" }],
            model: "llama-3.1-8b-instant",
            max_tokens: 3,
        });
        res.json({ 
            keyPrefix: keyPrefix + "...", 
            keyLength: keyLen,
            groqTest: "SUCCESS", 
            response: test.choices[0]?.message?.content 
        });
    } catch (err: any) {
        res.json({ 
            keyPrefix: keyPrefix + "...", 
            keyLength: keyLen,
            groqTest: "FAILED", 
            error: err.message,
            status: err.status || "unknown"
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log("Using Groq API");
});
