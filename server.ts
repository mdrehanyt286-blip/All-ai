import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer } from "ws";
import { GoogleGenAI, Modality, ThinkingLevel, GenerateVideosOperation } from "@google/genai";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const server = http.createServer(app);

// Increase limits to handle large Base64 files (images, audio, videos)
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ limit: "100mb", extended: true }));

const PORT = 3000;
const apiKey = process.env.GEMINI_API_KEY;

// Shared client initialization with required AI Studio build User-Agent
const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Helper function to handle and normalize GenAI errors, particularly distinguishing quota exceptions
function handleGenAiError(error: any, res: express.Response, context: string) {
  console.error(`${context} Error:`, error);
  const errMsg = error.message || "";
  const isQuotaError = errMsg.includes("Quota exceeded") || 
                       errMsg.includes("quota") || 
                       errMsg.includes("RESOURCE_EXHAUSTED") ||
                       errMsg.includes("limit: 0") ||
                       errMsg.includes("429");
  
  if (isQuotaError) {
    return res.status(429).json({
      error: "Multimodal model quota limits have been exceeded under this free-tier AI Sandbox. Please activate billing on your API Key, or configure a Paid Dev Key inside Settings > Secrets to unlock image, video, and premium tools.",
      quotaExceeded: true
    });
  }
  
  res.status(500).json({ error: errMsg || "Internal Server Error" });
}

// JSON API endpoints
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, model, systemInstruction, enableThinking, groundingMode } = req.body;
    
    const contents = messages.map((m: any) => ({
      role: m.role === "user" ? "user" : "model",
      parts: m.parts || [{ text: m.content || "" }]
    }));

    const config: any = {};
    if (systemInstruction) {
      config.systemInstruction = systemInstruction;
    }

    // Set tools based on Grounding requirements
    if (groundingMode === "search") {
      config.tools = [{ googleSearch: {} }];
    } else if (groundingMode === "maps") {
      config.tools = [{ googleMaps: {} }];
    }

    // Thinking mode settings: Available ONLY for Gemini 3 series models
    if (enableThinking && model === "gemini-3.1-pro-preview") {
      config.thinkingConfig = { thinkingLevel: ThinkingLevel.HIGH };
      // Note: do not set maxOutputTokens as per guideline
    }

    const response = await ai.models.generateContent({
      model: model || "gemini-3.5-flash",
      contents: contents,
      config: config
    });

    // Extract grounding metadata if available
    const searchChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const searchMetadata = searchChunks ? searchChunks.map((chunk: any) => ({
      title: chunk.web?.title || chunk.web?.uri || "Search Source",
      uri: chunk.web?.uri || ""
    })) : [];

    res.json({
      role: "model",
      content: response.text || "",
      grounding: searchMetadata
    });
  } catch (error: any) {
    handleGenAiError(error, res, "Chat");
  }
});

app.post("/api/analyze-media", async (req, res) => {
  try {
    const { fileBase64, mimeType, prompt, model } = req.body;
    if (!fileBase64 || !mimeType) {
      return res.status(400).json({ error: "Missing required file or mimeType" });
    }

    const mediaPart = {
      inlineData: {
        data: fileBase64,
        mimeType: mimeType
      }
    };

    const textPart = {
      text: prompt || "Analyze this content in detail."
    };

    const response = await ai.models.generateContent({
      model: model || "gemini-3.1-pro-preview",
      contents: { parts: [mediaPart, textPart] }
    });

    res.json({ result: response.text });
  } catch (error: any) {
    handleGenAiError(error, res, "Media Analysis");
  }
});

app.post("/api/transcribe-audio", async (req, res) => {
  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: "Missing audio dataset" });
    }

    const mediaPart = {
      inlineData: {
        data: fileBase64,
        mimeType: mimeType || "audio/webm"
      }
    };

    const textPart = {
      text: "Transcribe the spoken words in this audio file precisely without editing. If there is no speech, say [No Speech Detected]."
    };

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: { parts: [mediaPart, textPart] }
    });

    res.json({ text: response.text });
  } catch (error: any) {
    handleGenAiError(error, res, "Audio Transcription");
  }
});

app.post("/api/generate-image", async (req, res) => {
  try {
    const { prompt, aspectRatio, imageSize, model, baseImageBase64, baseImageMimeType } = req.body;
    
    // Choose selected model
    const selectedModel = model || "gemini-3.1-flash-image-preview";

    // Build content parts
    const parts: any[] = [{ text: prompt }];

    // If we have an image parameter for image editing/inpaint, include it in parts
    if (baseImageBase64 && baseImageMimeType) {
      parts.unshift({
        inlineData: {
          data: baseImageBase64,
          mimeType: baseImageMimeType
        }
      });
    }

    // Config setups
    const config: any = {
      imageConfig: {
        aspectRatio: aspectRatio || "1:1",
        imageSize: imageSize || "1K"
      }
    };

    const response = await ai.models.generateContent({
      model: selectedModel,
      contents: { parts: parts },
      config: config
    });

    let foundImageBase64 = "";
    let accompanyingText = "";

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          foundImageBase64 = part.inlineData.data;
        } else if (part.text) {
          accompanyingText += part.text;
        }
      }
    }

    if (!foundImageBase64) {
      return res.status(400).json({ error: "Failed to generate image bytes. Please try another prompt." });
    }

    res.json({
      imageUrl: `data:image/png;base64,${foundImageBase64}`,
      text: accompanyingText
    });
  } catch (error: any) {
    handleGenAiError(error, res, "Image Generation");
  }
});

// Veo 3-step operations handler for video generation
app.post("/api/generate-video", async (req, res) => {
  try {
    const { prompt, aspectRatio, startingImageBase64, startingImageMimeType } = req.body;
    
    const params: any = {
      model: "veo-3.1-fast-generate-preview",
      prompt: prompt || "A slow motion video of an astronaut floating in colorful space.",
      config: {
        numberOfVideos: 1,
        resolution: "720p",
        aspectRatio: aspectRatio || "16:9"
      }
    };

    // Support starting image context
    if (startingImageBase64 && startingImageMimeType) {
      params.image = {
        imageBytes: startingImageBase64,
        mimeType: startingImageMimeType
      };
    }

    const operation = await ai.models.generateVideos(params);
    res.json({ operationName: operation.name });
  } catch (error: any) {
    handleGenAiError(error, res, "Video Generation Initiation");
  }
});

app.post("/api/video-status", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "Missing operation name" });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    res.json({ done: updated.done });
  } catch (error: any) {
    handleGenAiError(error, res, "Video Status check");
  }
});

app.post("/api/video-download", async (req, res) => {
  try {
    const { operationName } = req.body;
    if (!operationName) {
      return res.status(400).json({ error: "Missing operation name" });
    }

    const op = new GenerateVideosOperation();
    op.name = operationName;
    const updated = await ai.operations.getVideosOperation({ operation: op });
    
    const uri = updated.response?.generatedVideos?.[0]?.video?.uri;
    if (!uri) {
      return res.status(400).json({ error: "Video URI not found or pending" });
    }

    const videoRes = await fetch(uri, {
      headers: { "x-goog-api-key": apiKey } as any,
    });

    if (!videoRes.ok) {
      throw new Error(`Failed to fetch video file from storage: ${videoRes.statusText}`);
    }

    res.setHeader("Content-Type", "video/mp4");
    
    // Pump reader chunks directly to express response
    const reader = videoRes.body?.getReader();
    if (!reader) {
      throw new Error("No readable stream from video source");
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (error: any) {
    handleGenAiError(error, res, "Video Download streaming");
  }
});

// Lyria music studio stream collector
app.post("/api/generate-music", async (req, res) => {
  try {
    const { prompt, model, baseImageBase64, baseImageMimeType } = req.body;
    const selectedModel = model === "pro" ? "lyria-3-pro-preview" : "lyria-3-clip-preview";

    let contents: any = prompt || "Generate a short upbeat cyberpunk beat.";

    if (baseImageBase64 && baseImageMimeType) {
      contents = {
        parts: [
          { text: prompt || "Generate music inspired by this image." },
          { inlineData: { data: baseImageBase64, mimeType: baseImageMimeType } }
        ],
      };
    }

    const responseStream = await ai.models.generateContentStream({
      model: selectedModel,
      contents: contents,
      config: {
        responseModalities: [Modality.AUDIO]
      }
    });

    let audioBase64 = "";
    let lyrics = "";
    let detectedMimeType = "audio/wav";

    for await (const chunk of responseStream) {
      const parts = chunk.candidates?.[0]?.content?.parts;
      if (!parts) continue;
      for (const part of parts) {
        if (part.inlineData?.data) {
          if (!audioBase64 && part.inlineData.mimeType) {
            detectedMimeType = part.inlineData.mimeType;
          }
          audioBase64 += part.inlineData.data;
        }
        if (part.text && !lyrics) {
          lyrics = part.text;
        }
      }
    }

    if (!audioBase64) {
      return res.status(400).json({ error: "Failed to generate music audio track. Try another style." });
    }

    res.json({
      audioBase64: audioBase64,
      lyrics: lyrics,
      mimeType: detectedMimeType
    });
  } catch (error: any) {
    handleGenAiError(error, res, "Music Generation");
  }
});

// WebSocket router for Gemini Live API
const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (request, socket, head) => {
  const { pathname } = new URL(request.url || "", `http://${request.headers.host}`);
  
  if (pathname === "/api/live-ws") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", async (clientWs) => {
  console.log("Live API: Client connected successfully.");
  let session: any = null;

  try {
    session = await ai.live.connect({
      model: "gemini-3.1-flash-live-preview",
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Zephyr" } },
        },
        systemInstruction: "You are a helpful, extremely responsive voice partner. Keep your answers conversational, concise, and friendly.",
      },
      callbacks: {
        onmessage: (message: any) => {
          const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
          const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
          
          if (audio) {
            clientWs.send(JSON.stringify({ audio }));
          }
          if (text) {
            clientWs.send(JSON.stringify({ text }));
          }
          if (message.serverContent?.interrupted) {
            clientWs.send(JSON.stringify({ interrupted: true }));
          }
        },
        onclose: () => {
          console.log("Live API: Gemini Live session disconnected.");
        },
        onerror: (err) => {
          console.error("Live API Session Error:", err);
          clientWs.send(JSON.stringify({ error: err.message || "Session error" }));
        }
      },
    });

    clientWs.on("message", (rawMessage) => {
      try {
        const payload = JSON.parse(rawMessage.toString());
        
        // Handle incoming PCM 16kHz audio from microphone
        if (payload.audio && session) {
          session.sendRealtimeInput({
            audio: {
              data: payload.audio,
              mimeType: "audio/pcm;rate=16000",
            },
          });
        }
        
        // Handle incoming Video JPEG frame for real-time visual streaming model
        if (payload.video && session) {
          session.sendRealtimeInput({
            video: {
              data: payload.video,
              mimeType: "image/jpeg"
            }
          });
        }

        // Handle raw text input
        if (payload.text && session) {
          session.sendRealtimeInput({
            text: payload.text
          });
        }
      } catch (err) {
        console.error("Failed to parse client message:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Live API: Client disconnected.");
      if (session) {
        try {
          session.close();
        } catch (e) {
          // already closed or error closing
        }
      }
    });
  } catch (error: any) {
    console.error("Live API bootstrap failure:", error);
    clientWs.send(JSON.stringify({ error: `Connection failed: ${error.message}` }));
    clientWs.close();
  }
});

// Configure Vite integration for full-stack build/dev environment
const isProduction = process.env.NODE_ENV === "production";

async function runApplication() {
  if (!isProduction) {
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

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`🚀 Workspace engine live on http://localhost:${PORT}`);
  });
}

runApplication();
