import React, { useState, useRef, useEffect } from "react";
import { Mic, MicOff, Upload, FileText, Check, Sparkles, RefreshCw, Eye, AlertCircle, FileVideo, FileImage } from "lucide-react";

export default function MediaAnalyzer() {
  const [activeTab, setActiveTab] = useState<"transcribe" | "analyze">("transcribe");

  // Audio transcription states
  const [recording, setRecording] = useState(false);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcriptionResult, setTranscriptionResult] = useState("");
  const [timeElapsed, setTimeElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  // Media inspection states
  const [inspectLoading, setInspectLoading] = useState(false);
  const [inspectResult, setInspectResult] = useState("");
  const [inspectPrompt, setInspectPrompt] = useState("");
  const [inspectBase64, setInspectBase64] = useState("");
  const [inspectMimeType, setInspectMimeType] = useState("");
  const [errorText, setErrorText] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Transcription recorders Core Flow
  const startRecording = async () => {
    try {
      setErrorText("");
      setTranscriptionResult("");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          transcribeAudioBytes(base64, "audio/webm");
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks inside stream
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setTimeElapsed(0);
      
      timerRef.current = setInterval(() => {
        setTimeElapsed(prev => prev + 1);
      }, 1000);
    } catch (err: any) {
      console.error(err);
      setErrorText("Could not request microphone access rights.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
  };

  const transcribeAudioBytes = async (fileBase64: string, mimeType: string) => {
    setTranscriptionLoading(true);
    setTranscriptionResult("");
    try {
      const response = await fetch("/api/transcribe-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileBase64, mimeType })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to process audio bytes.");
      }

      const res = await response.json();
      setTranscriptionResult(res.text || "[No speech detected / unparseable acoustics]");
    } catch (err: any) {
      console.error(err);
      setErrorText(`Transcription failed: ${err.message}`);
    } finally {
      setTranscriptionLoading(false);
    }
  };

  // Inspect media Flow
  const handleInspectFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorText("");
    const reader = new FileReader();
    reader.onload = () => {
      const base64Str = (reader.result as string).split(",")[1];
      setInspectBase64(base64Str);
      setInspectMimeType(file.type);
    };
    reader.readAsDataURL(file);
  };

  const removeInspectFile = () => {
    setInspectBase64("");
    setInspectMimeType("");
    setInspectResult("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const inspectMediaContent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectBase64 || inspectLoading) return;

    setInspectLoading(true);
    setInspectResult("");
    setErrorText("");

    try {
      const response = await fetch("/api/analyze-media", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileBase64: inspectBase64,
          mimeType: inspectMimeType,
          prompt: inspectPrompt || "Analyze this multi-modal file in absolute detail.",
          model: "gemini-3.1-pro-preview" // High quality inspector Pro
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Analysis failed.");
      }

      const res = await response.json();
      setInspectResult(res.result);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An exception occurred inspecting media files.");
    } finally {
      setInspectLoading(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
      
      {/* Tab Switcher Headers */}
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Vocal, Photo & Video Analyzer
          </h2>
          <p className="text-xs text-slate-400 font-medium">Transcribe audio records, or inspect photos and videos with Gemini Pro</p>
        </div>

        <div className="flex bg-slate-950 p-1 rounded-lg border border-slate-800">
          <button
            onClick={() => setActiveTab("transcribe")}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "transcribe"
                ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Vocal Transcriber
          </button>
          <button
            onClick={() => setActiveTab("analyze")}
            className={`px-4 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              activeTab === "analyze"
                ? "bg-indigo-500/15 text-indigo-300 shadow-sm"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            Omni inspector (Pro)
          </button>
        </div>
      </div>

      {errorText && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      <div className="flex-grow overflow-hidden">
        {activeTab === "transcribe" ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
            {/* Left Recording panel */}
            <div className="lg:col-span-4 flex flex-col justify-between bg-slate-950/40 border border-slate-800 p-6 rounded-xl min-h-[220px]">
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Audio Transcription Suite</span>
                
                <h3 className="text-sm font-semibold text-slate-300 mt-4 leading-relaxed">
                  Record short audio statements using your native system microphone
                </h3>
                <p className="text-xs text-slate-500 mt-1">Uses Gemini 3.5 Flash for rapid, verbatim textual reflection.</p>
              </div>

              <div className="flex flex-col items-center gap-4 py-4">
                {recording ? (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={stopRecording}
                      className="w-16 h-16 rounded-full bg-rose-500 hover:bg-rose-600 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 active:scale-95 transition-all animate-pulse cursor-pointer"
                    >
                      <MicOff className="w-7 h-7" />
                    </button>
                    <span className="text-xs font-mono font-bold text-rose-400">
                      Recording ({formatTime(timeElapsed)})
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={startRecording}
                      disabled={transcriptionLoading}
                      className="w-16 h-16 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 disabled:shadow-none active:scale-95 transition-all cursor-pointer"
                    >
                      <Mic className="w-7 h-7" />
                    </button>
                    <span className="text-xs font-semibold text-slate-400">
                      Click to tap mic record
                    </span>
                  </div>
                )}
              </div>

              <div className="text-[11px] text-slate-500 border-t border-slate-850 pt-3 text-center">
                Audio streams are converted into base64 packages in real-time.
              </div>
            </div>

            {/* Right outcome panel */}
            <div className="lg:col-span-8 flex flex-col justify-between bg-slate-950/20 border border-slate-800 p-6 rounded-xl overflow-hidden min-h-[250px]">
              <div className="flex-grow flex flex-col overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-3">Live Verbatim Outcome</span>
                
                <div className="flex-grow bg-slate-950/80 rounded-lg border border-slate-800 p-4 font-mono text-sm overflow-y-auto text-slate-350 custom-scrollbar max-h-[300px]">
                  {transcriptionLoading ? (
                    <div className="flex items-center gap-2 text-indigo-400 italic">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gemini is transcribing acoustic tracks...
                    </div>
                  ) : transcriptionResult ? (
                    <p className="whitespace-pre-wrap text-slate-200">{transcriptionResult}</p>
                  ) : (
                    <span className="text-slate-600 italic">No spoken words transcribed yet in session.</span>
                  )}
                </div>
              </div>

              {transcriptionResult && (
                <div className="border-t border-slate-850 mt-4 pt-3 flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1 text-emerald-400 font-bold">
                    <Check className="w-4 h-4" /> Completed transcription
                  </span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(transcriptionResult);
                    }}
                    className="text-indigo-400 hover:text-indigo-300 font-bold uppercase tracking-wider text-[10px]"
                  >
                    Copy details
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full overflow-hidden">
            {/* Left Analyzer settings */}
            <div className="lg:col-span-4 flex flex-col justify-between overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar">
              <form onSubmit={inspectMediaContent} className="space-y-4">
                
                {/* Media Uploader config */}
                <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Select files</span>
                    {inspectBase64 && (
                      <button
                        type="button"
                        onClick={removeInspectFile}
                        className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-widest cursor-pointer"
                      >
                        Wipe File
                      </button>
                    )}
                  </div>

                  {inspectBase64 ? (
                    <div className="relative rounded-lg overflow-hidden border border-indigo-500/35 p-2 bg-slate-950 flex flex-col items-center justify-center h-28 space-y-2">
                      {inspectMimeType.startsWith("image/") ? (
                        <FileImage className="w-10 h-10 text-indigo-400" />
                      ) : (
                        <FileVideo className="w-10 h-10 text-indigo-400" />
                      )}
                      <span className="text-slate-350 text-xs font-semibold truncate max-w-[150px]">
                        Active Inspection Target
                      </span>
                    </div>
                  ) : (
                    <label className="border border-spaced border-dashed border-slate-700/60 hover:border-indigo-500/50 rounded-lg p-5 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/20 hover:bg-slate-950/40">
                      <Upload className="w-6 h-6 text-slate-500 mb-1.5" />
                      <span className="text-xs text-slate-300 font-semibold text-center">Drag & drop photo / video file</span>
                      <span className="text-[9.5px] text-slate-500 mt-1 italic text-center">Supports JPG, PNG, WEBP, MP4, WEBM</span>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        ref={fileInputRef}
                        onChange={handleInspectFileUpload}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>

                {/* Inspect instruction list */}
                <div>
                  <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-1.5Packed">Inspector Query Prompt</label>
                  <textarea
                    placeholder="Describe what Gemini Pro should investigate, parse or analyze in this file..."
                    value={inspectPrompt}
                    onChange={(e) => setInspectPrompt(e.target.value)}
                    className="w-full h-24 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
                  />
                </div>

                <button
                  type="submit"
                  disabled={inspectLoading || !inspectBase64}
                  className="w-full py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 active:scale-[0.98] transition-all cursor-pointer"
                >
                  {inspectLoading ? (
                    <>
                      <RefreshCw className="w-4.5 h-4.5 animate-spin" />
                      Extracting Weights...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4.5 h-4.5" />
                      Examine with Gemini Pro
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Right outcomes analysis board */}
            <div className="lg:col-span-8 flex flex-col justify-between bg-slate-950/20 border border-slate-800 p-6 rounded-xl overflow-hidden min-h-[250px]">
              <div className="flex-grow flex flex-col overflow-hidden">
                <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500 block mb-3">Model Analysis Insights</span>
                
                <div className="flex-grow bg-slate-950/80 rounded-lg border border-slate-800 p-5 overflow-y-auto text-slate-300 text-sm leading-relaxed custom-scrollbar max-h-[300px]">
                  {inspectLoading ? (
                    <div className="flex items-center gap-2 text-indigo-400 italic">
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gemini is scanning reference weights...
                    </div>
                  ) : inspectResult ? (
                    <p className="whitespace-pre-wrap">{inspectResult}</p>
                  ) : (
                    <span className="text-slate-600 italic">Upload image/video and submit inspection query.</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
