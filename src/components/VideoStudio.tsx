import React, { useState, useEffect, useRef } from "react";
import { Film, Upload, Sparkles, RefreshCw, Eye, Download, Info, CheckCircle2, Play, AlertCircle } from "lucide-react";

export default function VideoStudio() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("16:9");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [operationName, setOperationName] = useState("");
  const [loadingStep, setLoadingStep] = useState(0);

  const [startingImageBase64, setStartingImageBase64] = useState("");
  const [startingImageMimeType, setStartingImageMimeType] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimerRef = useRef<any>(null);

  const REASSURING_LOADING_MESSAGES = [
    "Establishing neural link with Veo cluster...",
    "Sending visual weights of your text & baseline features...",
    "Rendering dynamic keyframes over temporary matrix tracks (this can take up to a minute)...",
    "Injecting fluid physics and motion vectors into model blocks...",
    "Interpolating frames and polishing color gradients...",
    "Finalizing raw output stream & preparing local download payload..."
  ];

  useEffect(() => {
    let interval: any;
    if (loading) {
      interval = setInterval(() => {
        setLoadingStep((prev) => (prev + 1) % REASSURING_LOADING_MESSAGES.length);
      }, 7000);
    }
    return () => {
      if (interval) clearInterval(interval);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [loading]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1];
      setStartingImageBase64(base64Data);
      setStartingImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const removeStartingImage = () => {
    setStartingImageBase64("");
    setStartingImageMimeType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const startVideoGeneration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !startingImageBase64) return;
    if (loading) return;

    setLoading(true);
    setLoadingStep(0);
    setErrorText("");
    setVideoUrl("");
    setOperationName("");

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          startingImageBase64,
          startingImageMimeType
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to submit video instructions.");
      }

      const res = await response.json();
      setOperationName(res.operationName);
      
      // Start polling status
      pollVideoStatus(res.operationName);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An exception occurred launching generation.");
      setLoading(false);
    }
  };

  const pollVideoStatus = (opName: string) => {
    if (pollTimerRef.current) clearInterval(pollTimerRef.current);

    pollTimerRef.current = setInterval(async () => {
      try {
        const response = await fetch("/api/video-status", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ operationName: opName })
        });

        if (!response.ok) {
          throw new Error("Could not fetch remote operations log");
        }

        const data = await response.json();
        
        if (data.done) {
          clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
          
          // Complete! Download the raw file
          await downloadGeneratedVideo(opName);
        }
      } catch (err: any) {
        console.error("Polling check failed:", err);
        // Soft error, let it retry or fail after timeout
      }
    }, 7000);
  };

  const downloadGeneratedVideo = async (opName: string) => {
    try {
      setLoadingStep(REASSURING_LOADING_MESSAGES.length - 1); // Final step message

      const response = await fetch("/api/video-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ operationName: opName })
      });

      if (!response.ok) {
        throw new Error("Video file retrieval failed or returned incomplete streams.");
      }

      const videoBlob = await response.blob();
      const localUrl = URL.createObjectURL(videoBlob);
      setVideoUrl(localUrl);
    } catch (err: any) {
      console.error(err);
      setErrorText(`Video rendering finished, but package download failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
      
      {/* Parameters Panel */}
      <div className="w-full lg:w-[380px] space-y-6 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-indigo-400" />
            Veo Video Animator
          </h2>
          <p className="text-xs text-slate-400">Generate studio-quality animations from text or baseline photos</p>
        </div>

        {errorText && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={startVideoGeneration} className="space-y-4">
          {/* Prompt input */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Video Scenic Description</label>
            <textarea
              placeholder="e.g. A photorealistic hyper-lapse of high velocity nebulae flowing in vibrant cyberpunk colors, slow motion floating stardust, extreme detail..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Core reference base image animator module */}
          <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image animation (V2V)</span>
              {startingImageBase64 && (
                <button
                  type="button"
                  onClick={removeStartingImage}
                  className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-widest cursor-pointer"
                >
                  Unload image
                </button>
              )}
            </div>

            {startingImageBase64 ? (
              <div className="relative rounded-lg overflow-hidden border border-indigo-500/30 group max-h-[140px] flex items-center justify-center bg-slate-950">
                <img
                  src={`data:${startingImageMimeType};base64,${startingImageBase64}`}
                  className="rounded-lg object-contain w-full h-24"
                  alt="Baseline animation video starting"
                />
                <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                  <span className="text-white text-xs font-bold font-sans">Active Starting Frame</span>
                  <span className="text-[10.5px] text-slate-300 mt-0.5">Veo will animate this picture</span>
                </div>
              </div>
            ) : (
              <label className="border border-spaced border-dashed border-slate-700/60 hover:border-indigo-500/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/20">
                <Upload className="w-5 h-5 text-slate-500 mb-1" />
                <span className="text-xs text-slate-300 font-medium">Animate a starting photo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Attach image frame to dictate start layout</span>
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
          </div>

          {/* Model information banner */}
          <div className="bg-slate-950/60 border border-slate-850 p-3 rounded-lg flex items-start gap-2 text-slate-400">
            <Info className="w-4 h-4 text-indigo-400 mt-0.5 flex-shrink-0" />
            <div className="text-[10.5px]">
              <span className="text-slate-300 font-semibold block">Model Config: Veo 3.1 Fast</span>
              Generates beautiful cinematic video clips. Operates as an asynchronous task with full progression monitoring.
            </div>
          </div>

          {/* Aspect ratios switches */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Video Layout Orientation</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAspectRatio("16:9")}
                className={`flex-1 py-2.5 border text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  aspectRatio === "16:9"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                16:9 (Landscape)
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio("9:16")}
                className={`flex-1 py-2.5 border text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  aspectRatio === "9:16"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                9:16 (Portrait)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (!prompt.trim() && !startingImageBase64)}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all cursor-pointer mt-4"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Processing Operation...
              </>
            ) : (
              <>
                <Film className="w-5 h-5 animate-pulse" />
                Render Veo Video
              </>
            )}
          </button>
        </form>
      </div>

      {/* Screen Preview Canvas */}
      <div className="flex-grow flex flex-col justify-between overflow-hidden bg-slate-950/30 rounded-xl border border-slate-800 p-6 min-h-[350px]">
        <div className="flex-grow flex items-center justify-center relative">
          
          {loading ? (
            <div className="text-center p-8 space-y-4 max-w-sm">
              <div className="relative w-16 h-16 mx-auto flex items-center justify-center bg-indigo-500/10 rounded-2xl border border-indigo-500/30">
                <RefreshCw className="w-8 h-8 text-indigo-400 animate-spin" />
              </div>
              <p className="text-sm font-semibold text-indigo-300">Veo is computing frame paths</p>
              <div className="text-xs text-slate-400 italic bg-slate-900/60 p-4 rounded-xl border border-slate-850 shadow-inner leading-relaxed">
                "{REASSURING_LOADING_MESSAGES[loadingStep]}"
              </div>
            </div>
          ) : videoUrl ? (
            <div className="flex flex-col items-center justify-center max-w-[500px] h-full space-y-4">
              <div className="rounded-lg overflow-hidden border border-slate-800 shadow-2xl bg-black max-w-full">
                <video
                  src={videoUrl}
                  controls
                  autoPlay
                  loop
                  playsInline
                  className="rounded-lg object-contain max-h-[380px] w-full"
                />
              </div>
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs py-1 px-3 bg-emerald-500/10 rounded-full border border-emerald-500/20">
                <CheckCircle2 className="w-4 h-4" />
                Video sequence prepared successfully!
              </div>
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 mx-auto shadow-inner">
                <Film className="w-8 h-8 text-indigo-400/80-glow" />
              </div>
              <p className="text-slate-300 text-sm font-medium">Video Sandbox is empty</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Trigger text rendering, or upload an image template to start video creation.
              </p>
            </div>
          )}
        </div>

        {videoUrl && (
          <div className="border-t border-slate-800/80 pt-4 mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold tracking-wide">Model Output: Aspects {aspectRatio}</span>
            <a
              href={videoUrl}
              download="veo-workspace-sequence.mp4"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all font-bold flex items-center gap-1 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download MP4
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
