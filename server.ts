import "dotenv/config";
import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

app.use(express.json({ limit: "10mb" }));

// Initialize GoogleGenAI client lazy-loaded
let aiClient: GoogleGenAI | null = null;

function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment.");
    }
    aiClient = new GoogleGenAI({
      apiKey: apiKey || "",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Helper for retrying API calls
async function callGeminiWithRetry(fn: () => Promise<any>, retries = 3, delay = 1000): Promise<any> {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error.status === 503 || error.status === 429)) {
      console.warn(`Gemini API busy (status ${error.status}). Retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return callGeminiWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
}

// API Route for translating Bible verses
app.post("/api/bible/translate", async (req, res) => {
  try {
    const { verses, language } = req.body;

    if (!verses || !Array.isArray(verses) || verses.length === 0) {
      return res.status(400).json({ error: "Missing or invalid verses array" });
    }

    if (!language || !["shona", "ndebele", "shona_kjv", "ndebele_kjv"].includes(language)) {
      return res.status(400).json({ error: "Invalid target language. Must be 'shona', 'ndebele', 'shona_kjv', or 'ndebele_kjv'." });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is missing. Falling back.");
      return res.status(503).json({ error: "Gemini API Key not configured on server" });
    }

    const ai = getAiClient();
    let targetLangFull = "";
    if (language === "shona_kjv") {
      targetLangFull = "Shona King James Version Style (classic, majestic, archaic Shona, using Bhaibheri Dzvene classical vocabulary)";
    } else if (language === "ndebele_kjv") {
      targetLangFull = "Ndebele King James Version Style (classic, majestic, archaic Ndebele, using Ibhanyibhili Elingcwele classical vocabulary)";
    } else if (language === "shona") {
      targetLangFull = "Shona (Bhaibheri Dzvene style)";
    } else {
      targetLangFull = "Ndebele (Ibhanyibhili Elingcwele style)";
    }

    const prompt = `You are an expert biblical scholar and native translator fluent in classical Shona and Ndebele. 
Translate the following Bible verses from English (King James Version) to proper, natural, grammatically correct and sacred ${targetLangFull} literal style. 
Do NOT do word-for-word translation and DO NOT mix any English words like "genealogy", "Jesus Christ", "David", "Abraham" with English connectors; use proper classical Shona/Ndebele names and spelling.
The sentence structure should flow perfectly in natural spelling, grammar, and vocabulary.
Keep the style formal, archaic/biblical, and beautiful.

Verses to translate:
${JSON.stringify(verses, null, 2)}`;

    // Disabled Gemini usage to prevent billing costs per user request
    const mockResponse = {
      verses: verses.map((v: any) => ({
        verse: v.verse,
        text: `[${language.toUpperCase()}] ${v.text}` // Provide a mocked response
      }))
    };

    return res.json(mockResponse);

  } catch (error: any) {
    console.error("Bible Translation Error:", error);
    return res.status(500).json({ error: error.message || "Failed to translate verses" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
