import React, { useState } from "react";
import { MessageSquare, Radio, Image, Film, Music, FileSearch, Sparkles, LogOut, Code, User, Compass, HelpCircle } from "lucide-react";

import OmniChat from "./components/OmniChat";
import LiveVoice from "./components/LiveVoice";
import ImageStudio from "./components/ImageStudio";
import VideoStudio from "./components/VideoStudio";
import MusicStudio from "./components/MusicStudio";
import MediaAnalyzer from "./components/MediaAnalyzer";

type ToolSuite = "chat" | "voice" | "image" | "video" | "music" | "analyzer";

export default function App() {
  const [activeSuite, setActiveSuite] = useState<ToolSuite>("chat");

  const SUITES_METADATA = [
    {
      id: "chat",
      name: "Omni Intelligence Chat",
      desc: "Robust LLM with Grounding toolsets",
      icon: MessageSquare,
      color: "text-indigo-400"
    },
    {
      id: "voice",
      name: "Live Omni-Voice",
      desc: "Bidirectional voice conversation",
      icon: Radio,
      color: "text-rose-400"
    },
    {
      id: "image",
      name: "Image Generation Studio",
      desc: "Configurable aspect ratios & sizes",
      icon: Image,
      color: "text-emerald-400"
    },
    {
      id: "video",
      name: "Veo Video Animator",
      desc: "Cinematic Veo generations",
      icon: Film,
      color: "text-amber-400"
    },
    {
      id: "music",
      name: "Lyria Sound Studio",
      desc: "Custom music clips & pro tracks",
      icon: Music,
      color: "text-purple-400"
    },
    {
      id: "analyzer",
      name: "Vocal, Photo & Video Analyzer",
      desc: "Image, video, and audio transcriber",
      icon: FileSearch,
      color: "text-sky-400"
    }
  ];

  const renderActiveSuite = () => {
    switch (activeSuite) {
      case "chat":
        return <OmniChat />;
      case "voice":
        return <LiveVoice />;
      case "image":
        return <ImageStudio />;
      case "video":
        return <VideoStudio />;
      case "music":
        return <MusicStudio />;
      case "analyzer":
        return <MediaAnalyzer />;
      default:
        return <OmniChat />;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30 selection:text-indigo-200">
      {/* Top Banner Header */}
      <header className="h-16 border-b border-slate-800/80 px-6 flex items-center justify-between col-span-12 bg-slate-950/60 backdrop-blur-md z-30 sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-rose-500 flex items-center justify-center shadow-lg shadow-indigo-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight flex items-center gap-2">
              Unified Omni AI Workspace
              <span className="text-[10px] bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-1.5 py-0.5 rounded-full font-bold">PRO</span>
            </h1>
            <p className="text-[10.5px] text-slate-400 font-medium tracking-wide">Multi-Modal Production Desk</p>
          </div>
        </div>

        {/* User context information */}
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex flex-col items-end text-right">
            <span className="text-xs font-bold text-slate-200">rehanvipmd@gmail.com</span>
            <span className="text-[10px] text-slate-500 font-mono">Workspace Engineer</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 text-xs font-bold shadow-md">
            R
          </div>
        </div>
      </header>

      {/* Main workspace layout */}
      <div className="flex-grow flex flex-col md:flex-row overflow-hidden relative">
        
        {/* Left Drawer / Dock Sidebar */}
        <aside className="w-full md:w-[280px] bg-slate-950 border-r border-slate-900/60 p-4 space-y-5 flex flex-col justify-between flex-shrink-0 z-20">
          <div className="space-y-4">
            <span className="block text-slate-500 uppercase tracking-widest text-[9.5px] font-bold pl-2">Tools Directory</span>
            <div className="grid grid-cols-1 gap-1">
              {SUITES_METADATA.map((suite) => {
                const IconComponent = suite.icon;
                const isActive = activeSuite === suite.id;
                return (
                  <button
                    key={suite.id}
                    onClick={() => setActiveSuite(suite.id as ToolSuite)}
                    className={`w-full p-3 rounded-xl flex items-start gap-3 text-left transition-all cursor-pointer ${
                      isActive
                        ? "bg-slate-900 border border-slate-800 shadow-md scale-[1.01]"
                        : "border border-transparent hover:bg-slate-900/40 text-slate-400 hover:text-slate-200"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center border border-slate-850/80 flex-shrink-0 ${isActive ? "border-slate-700" : ""}`}>
                      <IconComponent className={`w-4.5 h-4.5 ${isActive ? suite.color : "text-slate-500"}`} />
                    </div>
                    <div className="overflow-hidden">
                      <span className={`text-xs font-bold block ${isActive ? "text-white" : "text-slate-400 group-hover:text-slate-200"}`}>
                        {suite.name}
                      </span>
                      <span className="text-[10.5px] text-slate-500 tracking-tight block truncate">
                        {suite.desc}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SidebarFooter details */}
          <div className="hidden md:block bg-slate-950/40 border border-slate-900/85 p-3 rounded-xl space-y-1">
            <span className="text-[9px] uppercase font-bold tracking-widest text-slate-600 block">Workspace Status</span>
            <div className="flex items-center gap-1.5 text-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[10.5px] text-slate-400 font-medium">All APIs active and ready</span>
            </div>
          </div>
        </aside>

        {/* Right Active subcomponent dashboard panel */}
        <main className="flex-grow p-4 md:p-6 overflow-y-auto flex flex-col justify-stretch z-10 custom-scrollbar bg-slate-950/20">
          {renderActiveSuite()}
        </main>
      </div>
    </div>
  );
}
