import React, { useState, useRef } from "react";
import { Music, Sparkles, RefreshCw, Volume2, Upload, Disc, Play, Pause, AlertCircle } from "lucide-react";

export default function MusicStudio() {
  const [prompt, setPrompt] = useState("");
  const [modelType, setModelType] = useState<"clip" | "pro">("clip");
  const [baseImageBase64, setBaseImageBase64] = useState("");
  const [baseImageMimeType, setBaseImageMimeType] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [audioUrl, setAudioUrl] = useState("");
  const [lyricsText, setLyricsText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1];
      setBaseImageBase64(base64Data);
      setBaseImageMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const removeBaseImage = () => {
    setBaseImageBase64("");
    setBaseImageMimeType("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const composeMusic = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() && !baseImageBase64) return;
    if (loading) return;

    setLoading(true);
    setErrorText("");
    setAudioUrl("");
    setLyricsText("");

    try {
      const response = await fetch("/api/generate-music", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          model: modelType,
          baseImageBase64,
          baseImageMimeType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to compile the audio stream.");
      }

      const res = await response.json();

      // Decode accumulated base64 audio into playable local Blob URL
      const binary = atob(res.audioBase64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const audioBlob = new Blob([bytes], { type: res.mimeType || "audio/wav" });
      const localAudioUrl = URL.createObjectURL(audioBlob);

      setAudioUrl(localAudioUrl);
      setLyricsText(res.lyrics);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An exception occurred during music compilation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
      
      {/* Settings Form */}
      <div className="w-full lg:w-[380px] space-y-6 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Music className="w-5 h-5 text-indigo-400" />
            Lyria Sound Studio
          </h2>
          <p className="text-xs text-slate-400 font-medium">Compose sound clips and full tracks using text or imagery</p>
        </div>

        {errorText && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={composeMusic} className="space-y-4">
          
          {/* Prompt options */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Musical Style & Acoustic Description</label>
            <textarea
              placeholder="e.g. A 30-second futuristic upbeat synthwave track with heavy basslines, retro neon echoes, nostalgic percussion tempo, fast pace..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Core reference base image guided audio selection module */}
          <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image Guided context</span>
              {baseImageBase64 && (
                <button
                  type="button"
                  onClick={removeBaseImage}
                  className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-widest cursor-pointer"
                >
                  Remove visual
                </button>
              )}
            </div>

            {baseImageBase64 ? (
              <div className="relative rounded-lg overflow-hidden border border-indigo-500/30 group max-h-[140px] flex items-center justify-center bg-slate-950">
                <img
                  src={`data:${baseImageMimeType};base64,${baseImageBase64}`}
                  className="rounded-lg object-contain w-full h-24"
                  alt="Baseline audio select template"
                />
                <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white text-xs font-bold">Inspirational Image Active</span>
                </div>
              </div>
            ) : (
              <label className="border border-spaced border-dashed border-slate-700/60 hover:border-indigo-500/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/20">
                <Upload className="w-5 h-5 text-slate-500 mb-1" />
                <span className="text-xs text-slate-300 font-medium">Upload baseline photo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Use photo features to inspire track vibe</span>
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

          {/* Model selection options list */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2 font-black">Composition Length Mode</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModelType("clip")}
                className={`flex-1 py-2.5 border text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  modelType === "clip"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                Clip (Lyria-3-clip up to 30s)
              </button>
              <button
                type="button"
                onClick={() => setModelType("pro")}
                className={`flex-1 py-2.5 border text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  modelType === "pro"
                    ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                    : "bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-900"
                }`}
              >
                Full (Lyria-3-pro full track)
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || (!prompt.trim() && !baseImageBase64)}
            className="w-full py-4 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all cursor-pointer mt-4"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Synthesizing Acoustics...
              </>
            ) : (
              <>
                <Volume2 className="w-5 h-5 animate-pulse" />
                Generate Audio Track
              </>
            )}
          </button>
        </form>
      </div>

      {/* Playback Canvas */}
      <div className="flex-grow flex flex-col justify-between overflow-hidden bg-slate-950/30 rounded-xl border border-slate-800 p-6 min-h-[350px]">
        <div className="flex-grow flex items-center justify-center relative">
          
          {audioUrl ? (
            <div className="flex flex-col items-center justify-center max-w-md w-full space-y-6">
              
              {/* Spinning vinyl design */}
              <div className="relative w-40 h-40 bg-slate-950 rounded-full border-4 border-slate-800 shadow-2xl flex items-center justify-center animate-[spin_8s_linear_infinite] group">
                <div className="absolute inset-0 rounded-full border border-slate-700/40 scale-75" />
                <div className="absolute inset-0 rounded-full border border-slate-700/40 scale-50" />
                <div className="w-12 h-12 bg-indigo-500 border-4 border-slate-950 rounded-full flex items-center justify-center shadow-inner">
                  <Disc className="w-6 h-6 text-slate-100" />
                </div>
              </div>

              {/* Native audio player */}
              <audio
                ref={audioPlayerRef}
                src={audioUrl}
                controls
                autoPlay
                className="w-full bg-slate-900 rounded-lg shadow-md border border-slate-800 p-1"
              />

              {/* Lyrics Panel */}
              {lyricsText && (
                <div className="w-full bg-slate-900/55 p-4 rounded-xl border border-slate-800 text-center max-h-[160px] overflow-y-auto custom-scrollbar">
                  <span className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider block mb-1">Generated Lyrics / Vocal Notes</span>
                  <p className="text-xs text-slate-300 whitespace-pre-line leading-relaxed italic">
                    "{lyricsText}"
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 mx-auto shadow-inner">
                <Music className="w-8 h-8 text-indigo-400/80" />
              </div>
              <p className="text-slate-300 text-sm font-medium">Acoustic Player is inactive</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto text-center">
                Compose style guidelines or add an inspirational workspace photo to prompt sound compilation.
              </p>
            </div>
          )}
        </div>

        {audioUrl && (
          <div className="border-t border-slate-800/80 pt-4 mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-semibold tracking-wide">Model Output: Lyria Soundwave ({modelType})</span>
            <a
              href={audioUrl}
              download="lyria-workspace-composition.wav"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all font-semibold cursor-pointer"
            >
              Download WAV track
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
