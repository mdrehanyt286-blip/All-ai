import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, Radio, Video, VideoOff, Play, Pause, AlertCircle } from "lucide-react";

export default function LiveVoice() {
  const [isActive, setIsActive] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [status, setStatus] = useState<"Disconnected" | "Connecting" | "Connected" | "Ended">("Disconnected");
  const [interimText, setInterimText] = useState("");
  const [errorText, setErrorText] = useState("");
  const [logMessages, setLogMessages] = useState<string[]>([]);

  const wsRef = useRef<WebSocket | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const outputAudioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const videoIntervalRef = useRef<any>(null);
  const nextStartTimeRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    return () => {
      stopSession();
    };
  }, []);

  const startSession = async () => {
    try {
      setErrorText("");
      setStatus("Connecting");
      setInterimText("");
      setLogMessages(["Initiating full-duplex session connection..."]);

      // Request microphone permissions
      let micStream;
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        microphoneStreamRef.current = micStream;
      } catch (err) {
        throw new Error("Microphone permission denied or source unavailable.");
      }

      // Initialize audio contexts
      inputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;

      // Establish WebSocket
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const host = window.location.host;
      const wsUrl = `${protocol}//${host}/api/live-ws`;
      
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("Connected");
        setIsActive(true);
        setLogMessages(prev => [...prev, "WebSocket connected! Session is active."]);
        
        // Start streaming mic audio to node
        setupMicStreaming(micStream);
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.audio) {
            playAudioChunk(payload.audio);
          }
          if (payload.text) {
            setInterimText(prev => prev + " " + payload.text);
          }
          if (payload.interrupted) {
            setLogMessages(prev => [...prev, "[Model Interrupted by User]"]);
            clearAudioQueue();
          }
          if (payload.error) {
            setErrorText(payload.error);
            setLogMessages(prev => [...prev, `Session Error: ${payload.error}`]);
          }
        } catch (errRef) {
          console.error("Live Web message parse failure:", errRef);
        }
      };

      ws.onerror = (err) => {
        console.error("WebSocket error:", err);
        setErrorText("WebSocket connection error occurred.");
      };

      ws.onclose = () => {
        setLogMessages(prev => [...prev, "WebSocket connection closed."]);
        stopSession();
      };

    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "Failed to initialize live voice session.");
      setStatus("Disconnected");
    }
  };

  const setupMicStreaming = (stream: MediaStream) => {
    const ctx = inputAudioCtxRef.current;
    if (!ctx) return;

    sourceRef.current = ctx.createMediaStreamSource(stream);
    processorRef.current = ctx.createScriptProcessor(2048, 1, 1);

    sourceRef.current.connect(processorRef.current);
    processorRef.current.connect(ctx.destination);

    processorRef.current.onaudioprocess = (e) => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) return;

      const inputData = e.inputBuffer.getChannelData(0);
      const pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const val = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = val < 0 ? val * 0x8000 : val * 0x7FFF;
      }

      // Encode PCM bytes to base64
      const bytes = new Uint8Array(pcm16.buffer);
      let binary = "";
      for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);

      wsRef.current.send(JSON.stringify({ audio: base64 }));
    };
  };

  const playAudioChunk = (base64: string) => {
    const ctx = outputAudioCtxRef.current;
    if (!ctx) return;

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768.0;
    }

    const buffer = ctx.createBuffer(1, float32.length, 24000);
    buffer.copyToChannel(float32, 0);

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);

    // Schedule playback with safety threshold
    let playTime = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(playTime);
    nextStartTimeRef.current = playTime + buffer.duration;
  };

  const clearAudioQueue = () => {
    if (outputAudioCtxRef.current) {
      nextStartTimeRef.current = outputAudioCtxRef.current.currentTime;
    }
  };

  const startCamera = async () => {
    try {
      const camStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: 5 }
      });
      cameraStreamRef.current = camStream;
      if (videoRef.current) {
        videoRef.current.srcObject = camStream;
      }
      setIsCameraActive(true);

      // Canvas element for scaling image frames to JPEG
      const canvas = canvasRef.current || document.createElement("canvas");
      canvas.width = 160;
      canvas.height = 120;
      const ctx = canvas.getContext("2d");

      // Set 1 FPS interval for streaming to Gemini Live API
      videoIntervalRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN && videoRef.current && ctx) {
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL("image/jpeg", 0.5);
          const base64 = dataUrl.split(",")[1];
          wsRef.current.send(JSON.stringify({ video: base64 }));
        }
      }, 1000);

      setLogMessages(prev => [...prev, "Visual streaming active (1 FPS)"]);
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setErrorText("Could not start camera visual stream.");
    }
  };

  const stopCamera = () => {
    if (videoIntervalRef.current) {
      clearInterval(videoIntervalRef.current);
      videoIntervalRef.current = null;
    }
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach(track => track.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setLogMessages(prev => [...prev, "Visual streaming disabled"]);
  };

  const stopSession = () => {
    stopCamera();

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (microphoneStreamRef.current) {
      microphoneStreamRef.current.getTracks().forEach(track => track.stop());
      microphoneStreamRef.current = null;
    }
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
      wsRef.current = null;
    }
    
    // Close context nicely
    if (inputAudioCtxRef.current && inputAudioCtxRef.current.state !== "closed") {
      inputAudioCtxRef.current.close();
    }
    if (outputAudioCtxRef.current && outputAudioCtxRef.current.state !== "closed") {
      outputAudioCtxRef.current.close();
    }

    inputAudioCtxRef.current = null;
    outputAudioCtxRef.current = null;
    setIsActive(false);
    setStatus("Ended");
  };

  return (
    <div className="flex flex-col h-full bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-700/50 pb-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            Gemini Live Omni-Voice
          </h2>
          <p className="text-xs text-slate-400">
            Real-time, ultra-low latency voice and camera conversation.
          </p>
        </div>
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
          status === "Connected" ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" :
          status === "Connecting" ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse" :
          "bg-slate-800 text-slate-400"
        }`}>
          {status}
        </span>
      </div>

      {errorText && (
        <div className="mb-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center gap-2 text-sm">
          <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
          <span>{errorText}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-grow overflow-hidden">
        {/* Main interactive core */}
        <div className="lg:col-span-8 flex flex-col justify-between overflow-hidden">
          {/* Animated visual voice wave placeholder */}
          <div className="flex-grow flex flex-col items-center justify-center relative bg-slate-950/40 rounded-xl border border-slate-800 p-8 min-h-[250px]">
            {status === "Connected" ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center gap-1.5 h-20 mb-4 px-10">
                  <div className="w-2.5 h-6 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite_100ms]" />
                  <div className="w-2.5 h-12 bg-indigo-400 rounded-full animate-[bounce_0.8s_infinite_200ms]" />
                  <div className="w-2.5 h-16 bg-purple-400 rounded-full animate-[bounce_0.8s_infinite_300ms]" />
                  <div className="w-2.5 h-10 bg-indigo-400 rounded-full animate-[bounce_0.8s_infinite_400ms]" />
                  <div className="w-2.5 h-4 bg-indigo-500 rounded-full animate-[bounce_0.8s_infinite_500ms]" />
                </div>
                <p className="text-sm font-medium text-indigo-300">Speaking or Listening...</p>
                {interimText && (
                  <div className="mt-6 max-w-md bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-slate-300 text-sm text-center italic">
                    "{interimText}"
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-full bg-slate-800/80 flex items-center justify-center text-slate-500 mb-4 border border-slate-700">
                  <Volume2 className="w-8 h-8" />
                </div>
                <p className="text-slate-400 text-sm font-medium">Session is idle.</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Connect to toggle high-fidelity, bidirectional voice and screen modalities.
                </p>
              </div>
            )}
          </div>

          {/* Core session action panel */}
          <div className="flex flex-wrap gap-4 items-center justify-center mt-6 p-4 bg-slate-900/20 border border-slate-800 rounded-xl">
            {!isActive ? (
              <button
                onClick={startSession}
                className="px-5 py-3 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white rounded-xl font-semibold flex items-center gap-2 shadow-lg shadow-indigo-500/20 active:scale-95 transition-all text-sm cursor-pointer"
              >
                <Mic className="w-5 h-5 animate-pulse" />
                Connect Voice Partner
              </button>
            ) : (
              <>
                <button
                  onClick={stopSession}
                  className="px-5 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-semibold flex items-center gap-2 active:scale-95 transition-all text-sm cursor-pointer"
                >
                  <MicOff className="w-5 h-5" />
                  Disconnect Session
                </button>

                {isCameraActive ? (
                  <button
                    onClick={stopCamera}
                    className="px-4 py-3 bg-amber-500/10 border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <VideoOff className="w-4.5 h-4.5" />
                    Mute Screen
                  </button>
                ) : (
                  <button
                    onClick={startCamera}
                    className="px-4 py-3 bg-slate-800 border border-slate-700 text-slate-300 hover:bg-slate-700 hover:text-white rounded-xl text-sm font-semibold flex items-center gap-2 cursor-pointer"
                  >
                    <Video className="w-4.5 h-4.5" />
                    Stream Camera context
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Console and video preview side panel */}
        <div className="lg:col-span-4 flex flex-col gap-4 overflow-hidden">
          {/* Camera streaming preview frame */}
          <div className="bg-slate-950/60 rounded-xl border border-slate-800 p-2 overflow-hidden h-[160px] flex items-center justify-center relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover rounded-lg ${isCameraActive ? "block" : "hidden"}`}
            />
            {!isCameraActive && (
              <div className="text-center p-4">
                <Video className="w-6 h-6 mx-auto text-slate-600 mb-1" />
                <span className="text-[11px] text-slate-500 font-medium block">Visual sensor offline</span>
              </div>
            )}
            <canvas ref={canvasRef} className="hidden" />
          </div>

          {/* Activity terminal logs */}
          <div className="flex-grow bg-slate-950/60 rounded-xl border border-slate-800 p-4 font-mono text-[11px] flex flex-col justify-between overflow-hidden h-[200px]">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-2">
              <span className="text-slate-400 font-semibold tracking-wider uppercase text-[9px]">Workspace Log</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            </div>
            <div className="flex-grow overflow-y-auto space-y-1.5 pr-2 custom-scrollbar">
              {logMessages.map((msg, i) => (
                <div key={i} className="text-indigo-400/80">
                  <span className="text-slate-600 mr-1.5">&gt;</span>
                  {msg}
                </div>
              ))}
              {logMessages.length === 0 && (
                <div className="text-slate-600 italic">No logs compiled yet in session.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
