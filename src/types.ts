export interface ChatMessage {
  id: string;
  role: "user" | "model";
  content: string;
  timestamp: Date;
  grounding?: { title: string; uri: string }[];
}

export type GroundingMode = "none" | "search" | "maps";

export type ChatModel = "gemini-3.5-flash" | "gemini-3.1-pro-preview" | "gemini-3.1-flash-lite";

export interface SystemRolePreset {
  name: string;
  instruction: string;
  description: string;
}

export const SYSTEM_ROLE_PRESETS: SystemRolePreset[] = [
  {
    name: "General Assistant",
    instruction: "You are a helpful, smart, and friendly AI workspace assistant. Answer accurately.",
    description: "Multi-functional expert assistant"
  },
  {
    name: "Software Engineer",
    instruction: "You are a senior software architect and programmer. Write highly optimal, clean, secure, and production-ready code with minimal explanation.",
    description: "Code generation and architecture"
  },
  {
    name: "Creative Essayist",
    instruction: "You are a talented novelist and essayist. Speak with rich imagery, poetic precision, and deep emotional intelligence.",
    description: "Creative writing and copy"
  },
  {
    name: "Socratic Teacher",
    instruction: "You are an educator who never gives the answer directly. Ask guided, stimulating questions to help the user arrive at their own understanding.",
    description: "Guided conceptual learning"
  }
];
