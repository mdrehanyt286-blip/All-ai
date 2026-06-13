import React, { useState, useEffect, useRef } from "react";
import { Send, Sparkles, Brain, Search, Map, ChevronRight, User, Terminal, Loader2 } from "lucide-react";
import { ChatMessage, GroundingMode, ChatModel, SYSTEM_ROLE_PRESETS, SystemRolePreset } from "../types";

export default function OmniChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState("");
  const [selectedModel, setSelectedModel] = useState<ChatModel>("gemini-3.5-flash");
  const [groundingMode, setGroundingMode] = useState<GroundingMode>("none");
  const [enableThinking, setEnableThinking] = useState(false);
  const [customSystemInstruction, setCustomSystemInstruction] = useState("");
  const [selectedPreset, setSelectedPreset] = useState<SystemRolePreset | null>(SYSTEM_ROLE_PRESETS[0]);
  const [loading, setLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Add introductory message on mounting
    setMessages([
      {
        id: "intro",
        role: "model",
        content: "Welcome to the Omni Chatbot! I'm ready to assist you. Choose your preferred model, ground me on live search engines, or select professional roles from the settings above.",
        timestamp: new Date()
      }
    ]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handlePresetSelect = (preset: SystemRolePreset) => {
    setSelectedPreset(preset);
    setCustomSystemInstruction(preset.instruction);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: `${Date.now()}-user`,
      role: "user",
      content: inputText,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputText("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          model: selectedModel,
          systemInstruction: customSystemInstruction || selectedPreset?.instruction || "",
          enableThinking: enableThinking,
          groundingMode: groundingMode
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate chat response.");
      }

      const rawRes = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: "model",
        content: rawRes.content,
        timestamp: new Date(),
        grounding: rawRes.grounding
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (err: any) {
      console.error(err);
      setMessages(prev => [...prev, {
        id: `${Date.now()}-error`,
        role: "model",
        content: `Error: ${err.message || "Failed to call backend server API."}`,
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = () => {
    setMessages([
      {
        id: `${Date.now()}-intro`,
        role: "model",
        content: "Conversation history cleared. Ready for your next query!",
        timestamp: new Date()
      }
    ]);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 overflow-hidden">
      {/* Top Config Header */}
      <div className="bg-slate-900/60 border-b border-slate-700/50 p-4 space-y-4">
        <div className="flex flex-wrap gap-4 items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-400" />
              Omni Intelligence Chat
            </h2>
            <p className="text-xs text-slate-400">Configure parameters dynamically with instant reflection</p>
          </div>
          <button
            onClick={clearHistory}
            className="px-3 py-1 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors cursor-pointer"
          >
            Clear Thread
          </button>
        </div>

        {/* Configuration sliders/menus */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
          {/* Model picker */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-1.5">Selected Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value as ChatModel)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 rounded-lg p-2 focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="gemini-3.5-flash">Gemini 3.5 Flash (General default)</option>
              <option value="gemini-3.1-pro-preview">Gemini 3.1 Pro (Heavy thinking)</option>
              <option value="gemini-3.1-flash-lite">Gemini 3.1 Flash Lite (Low latency)</option>
            </select>
          </div>

          {/* Grounding tools switcher */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-1.5">Grounding Tools</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setGroundingMode("none")}
                className={`flex-1 p-2 border rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  groundingMode === "none"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                No ground
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode("search")}
                className={`flex-1 p-2 border rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  groundingMode === "search"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                <Search className="w-3.5 h-3.5" />
                Search
              </button>
              <button
                type="button"
                onClick={() => setGroundingMode("maps")}
                className={`flex-1 p-2 border rounded-lg font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  groundingMode === "maps"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                <Map className="w-3.5 h-3.5" />
                Maps
              </button>
            </div>
          </div>

          {/* Heavy thinking modifier */}
          <div className="flex flex-col justify-end">
            <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer p-2 bg-slate-950 border border-slate-800 rounded-lg hover:bg-slate-900/60 height-full">
              <input
                type="checkbox"
                checked={enableThinking}
                onChange={(e) => setEnableThinking(e.target.checked)}
                disabled={selectedModel !== "gemini-3.1-pro-preview"}
                className="rounded border-slate-700 bg-slate-800 text-indigo-500 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:opacity-50"
              />
              <span className={`flex items-center gap-1.5 ${selectedModel !== "gemini-3.1-pro-preview" ? "opacity-30" : ""}`}>
                <Brain className="w-4 h-4 text-purple-400" />
                Enable Thinking Mode (Pro model only)
              </span>
            </label>
          </div>
        </div>

        {/* Roles Presets banner */}
        <div>
          <span className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-1.5">System Persona Role</span>
          <div className="flex flex-wrap gap-2">
            {SYSTEM_ROLE_PRESETS.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handlePresetSelect(preset)}
                className={`px-3 py-1.5 rounded-lg border text-left text-[11px] transition-colors cursor-pointer ${
                  (selectedPreset?.name === preset.name && !customSystemInstruction) || (selectedPreset?.name === preset.name && customSystemInstruction === preset.instruction)
                    ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300"
                    : "bg-slate-950/40 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                <span className="font-bold block text-[11.5px]">{preset.name}</span>
                <span className="text-[10px] text-slate-500">{preset.description}</span>
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="Or type a custom system instruction role yourself..."
            value={customSystemInstruction}
            onChange={(e) => {
              setCustomSystemInstruction(e.target.value);
              setSelectedPreset(null);
            }}
            className="w-full bg-slate-950 border border-slate-800 text-slate-300 text-xs rounded-lg p-2.5 mt-2.5 focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
      </div>

      {/* Main Messages Thread Scrollarea */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4 custom-scrollbar min-h-[300px]">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex gap-3 max-w-[85%] ${m.role === "user" ? "ml-auto flex-row-reverse" : "mr-auto"}`}
          >
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border ${
              m.role === "user" ? "bg-indigo-500/10 border-indigo-500/20 text-indigo-400" : "bg-slate-800 border-slate-700 text-slate-300"
            }`}>
              {m.role === "user" ? <User className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
            </div>

            <div className={`rounded-2xl p-4 overflow-hidden border ${
              m.role === "user"
                ? "bg-indigo-600 text-white border-indigo-500"
                : "bg-slate-950/80 text-slate-100 border-slate-800"
            }`}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>

              {/* Grounding metadata attachments in Assistant response */}
              {m.grounding && m.grounding.length > 0 && (
                <div className="mt-3.5 pt-3 border-t border-slate-800 font-mono text-[10px]">
                  <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Grounding Sources:</span>
                  <div className="flex flex-wrap gap-2">
                    {m.grounding.map((src, i) => (
                      <a
                        key={i}
                        href={src.uri}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20 hover:text-indigo-200 transition-all flex items-center gap-1"
                      >
                        <span>{src.title}</span>
                        <ChevronRight className="w-3 h-3" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex gap-3 mr-auto max-w-[80%]">
            <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
            <div className="bg-slate-950/80 text-slate-400 border border-slate-800 rounded-2xl p-4 flex items-center gap-2">
              <span className="text-sm italic">Gemini is compiling your response ...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input Form */}
      <form onSubmit={handleSendMessage} className="bg-slate-900/60 p-4 border-t border-slate-700/50">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Ask anything, prompt calculations, or describe complex issues..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            disabled={loading}
            className="flex-grow bg-slate-950 border border-slate-800 focus:border-indigo-500 text-slate-100 text-sm rounded-xl p-3 px-4 focus:ring-1 focus:ring-indigo-500 outline-none placeholder:text-slate-500"
          />
          <button
            type="submit"
            disabled={loading || !inputText.trim()}
            className="p-3 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white rounded-xl shadow-md disabled:shadow-none hover:shadow-indigo-500/10 active:scale-95 transition-all flex items-center justify-center flex-shrink-0 cursor-pointer"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </form>
    </div>
  );
}
