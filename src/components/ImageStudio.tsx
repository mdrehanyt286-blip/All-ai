import React, { useState, useRef } from "react";
import { Image, Wand2, RefreshCw, Upload, Sparkles, Sliders, Play, Trash, AlertCircle } from "lucide-react";

export default function ImageStudio() {
  const [prompt, setPrompt] = useState("");
  const [aspectRatio, setAspectRatio] = useState("1:1");
  const [imageSize, setImageSize] = useState("1K");
  const [selectedModel, setSelectedModel] = useState("gemini-3.1-flash-image-preview");
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState("");
  const [generatedImageUrl, setGeneratedImageUrl] = useState("");
  const [generatedText, setGeneratedText] = useState("");

  const [baseImageBase64, setBaseImageBase64] = useState("");
  const [baseImageMimeType, setBaseImageMimeType] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const ASPECT_RATIO_PRESETS = ["1:1", "2:3", "3:2", "3:4", "4:3", "9:16", "16:9", "21:9"];
  const QUALITY_SIZES = ["1K", "2K", "4K"];

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

  const generateImage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setErrorText("");
    setGeneratedImageUrl("");
    setGeneratedText("");

    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          aspectRatio,
          imageSize,
          model: selectedModel,
          baseImageBase64,
          baseImageMimeType
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate your requested image.");
      }

      const res = await response.json();
      setGeneratedImageUrl(res.imageUrl);
      setGeneratedText(res.text);
    } catch (err: any) {
      console.error(err);
      setErrorText(err.message || "An error occurred during image construction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row h-full gap-6 bg-slate-900/40 backdrop-blur-md rounded-2xl border border-slate-700/50 p-6 overflow-hidden">
      {/* Control panel options form */}
      <div className="w-full lg:w-[380px] space-y-6 overflow-y-auto pr-1 flex-shrink-0 custom-scrollbar">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Image className="w-5 h-5 text-indigo-400" />
            Image Generation Studio
          </h2>
          <p className="text-xs text-slate-400">Assemble prompts, adjust layout values, and edit photos</p>
        </div>

        {errorText && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-lg flex items-center gap-2 text-sm">
            <AlertCircle className="w-4.5 h-4.5 flex-shrink-0" />
            <span>{errorText}</span>
          </div>
        )}

        <form onSubmit={generateImage} className="space-y-4">
          {/* Prompt panel */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Creative Prompt</label>
            <textarea
              placeholder="e.g. A gorgeous, cinematic portrait of a robotic astronaut holding deep red roses on Mars with solar flares in background, hyperrealistic 8k..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full h-24 bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-lg p-3 focus:ring-1 focus:ring-indigo-500 outline-none resize-none placeholder:text-slate-600"
            />
          </div>

          {/* Core reference base image editing module */}
          <div className="bg-slate-950/40 p-4 border border-slate-800 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Image-to-Image / Inpainting</span>
              {baseImageBase64 && (
                <button
                  type="button"
                  onClick={removeBaseImage}
                  className="text-rose-400 hover:text-rose-300 text-[10px] uppercase font-bold tracking-widest cursor-pointer"
                >
                  Remove Base
                </button>
              )}
            </div>

            {baseImageBase64 ? (
              <div className="relative rounded-lg overflow-hidden border border-indigo-500/30 group max-h-[120px] flex items-center justify-center bg-slate-950">
                <img
                  src={`data:${baseImageMimeType};base64,${baseImageBase64}`}
                  className="rounded-lg object-contain w-full h-24"
                  alt="Base reference upload template"
                />
                <div className="absolute inset-0 bg-slate-950/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                  <span className="text-white text-xs font-semibold">Active Reference</span>
                </div>
              </div>
            ) : (
              <label className="border border-spaced border-dashed border-slate-700/60 hover:border-indigo-500/50 rounded-lg p-4 flex flex-col items-center justify-center cursor-pointer transition-colors bg-slate-950/20">
                <Upload className="w-5 h-5 text-slate-500 mb-1" />
                <span className="text-xs text-slate-300 font-medium">Upload baseline photo</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Use prompt to edit, change, or add elements</span>
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

          {/* Model picker */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2 font-black">Image Engine</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-lg p-2.5 focus:ring-1 focus:ring-indigo-500 outline-none font-medium"
            >
              <option value="gemini-3.1-flash-image-preview">Gemini 3.1 Flash Image (Multi-Aspect baseline)</option>
              <option value="gemini-3-pro-image-preview">Gemini 3 Pro Image (Studio details & Sizes)</option>
              <option value="gemini-2.5-flash-image">Gemini 2.5 Flash Image (General use)</option>
            </select>
          </div>

          {/* Aspect ratios list */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Aspect Ratios</label>
            <div className="grid grid-cols-4 gap-1.5">
              {ASPECT_RATIO_PRESETS.map((ratio) => (
                <button
                  type="button"
                  key={ratio}
                  onClick={() => setAspectRatio(ratio)}
                  className={`p-1.5 border text-xs font-semibold rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    aspectRatio === ratio
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                      : "bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-900"
                  }`}
                >
                  {ratio}
                </button>
              ))}
            </div>
          </div>

          {/* Custom dimensions/sizes */}
          <div>
            <label className="block text-slate-400 uppercase font-bold tracking-wider text-[10px] mb-2">Engine Canvas Resolution</label>
            <div className="grid grid-cols-3 gap-2">
              {QUALITY_SIZES.map((size) => (
                <button
                  type="button"
                  key={size}
                  onClick={() => setImageSize(size)}
                  className={`p-1.5 border text-xs font-semibold rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                    imageSize === size
                      ? "bg-indigo-500/15 border-indigo-500 text-indigo-300"
                      : "bg-slate-950 border-slate-800/80 text-slate-400 hover:bg-slate-900"
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full py-3.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 disabled:from-slate-800 disabled:to-slate-800 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/10 hover:shadow-indigo-500/20 active:scale-[0.98] transition-all cursor-pointer mt-4"
          >
            {loading ? (
              <>
                <RefreshCw className="w-5 h-5 animate-spin" />
                Sculpting Pixels...
              </>
            ) : (
              <>
                <Wand2 className="w-5 h-5" />
                Generate Core Artwork
              </>
            )}
          </button>
        </form>
      </div>

      {/* Preview Output Monitor Frame */}
      <div className="flex-grow flex flex-col justify-between overflow-hidden bg-slate-950/30 rounded-xl border border-slate-800 p-6 min-h-[350px]">
        <div className="flex-grow flex items-center justify-center relative">
          {generatedImageUrl ? (
            <div className="flex flex-col items-center justify-center max-w-full h-full space-y-4">
              <div className="relative max-h-[75%] rounded-lg overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center bg-slate-950">
                <img
                  src={generatedImageUrl}
                  alt="AI Generated studio art"
                  className="rounded-lg object-contain block max-h-[420px] transition-all"
                />
              </div>
              {generatedText && (
                <p className="text-xs text-slate-400 max-w-md text-center italic bg-slate-900/60 p-3 rounded-lg border border-slate-850">
                  {generatedText}
                </p>
              )}
            </div>
          ) : (
            <div className="text-center p-8">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-center text-slate-500 mb-4 mx-auto shadow-inner">
                <Sparkles className="w-8 h-8 text-indigo-400/80" />
              </div>
              <p className="text-slate-300 text-sm font-medium">Image sandbox is vacant</p>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Arrange a creative prompt or upload an image to edit/inpaint on the left controller panel.
              </p>
            </div>
          )}
        </div>

        {generatedImageUrl && (
          <div className="border-t border-slate-800/80 pt-4 mt-4 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Output: Aspect {aspectRatio} ({imageSize})</span>
            <a
              href={generatedImageUrl}
              download="workspace-masterpiece.png"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/20 transition-all font-semibold cursor-pointer"
            >
              Download PNG
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
