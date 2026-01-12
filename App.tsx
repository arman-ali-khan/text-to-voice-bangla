
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { generateSpeech } from './services/geminiService.ts';
import { VoiceName } from './types.ts';
import { decode, decodeAudioData } from './utils/audioUtils.ts';
import VoiceSelector from './components/VoiceSelector.tsx';

const DEFAULT_TEXT = `ছোটমামার সঙ্গে রাতবিরেতে বাইরে কোথাও গেলেই কী সব বিদঘুটে কাণ্ড বেধে যায়। তাই ছোটমামা সাধাসাধি করলেও সন্ধ্যার পর তাঁর সঙ্গে কোথাও যেতুম না। সে কলকাতায় যাত্রা দেখতেই হোক, কী মেলা দেখতেই হোক। অবশ্য সব সময় দোষটা যে ছোটমামারই, এমন কিন্তু নয়। কোথাও দিনদুপুরে গিয়ে কোনও কারণে ফিরতে সন্ধ্যা বা রাত্রি তো হতেই পারে। তখন কী আর করা যাবে?

তেমনই একটা রাতের বিদঘুটে কাণ্ডের কথা মনে পড়ে গেল। সেটা গোড়া থেকেই বলা যাক।

ঠাকুরদা সপ্তাহে তিনদিন দাড়ি কামাতেন। আর তাঁর দাড়ি কামাতে আসত ভোলারাম নরসুন্দর। ভোলারামকে নাপিত বললেই জিভ কেটে সে বলত
ছি-ছি! নাপিত বলতে নেই। নাপিত বললে কী হবে জানো খোকাবাবু? এই বয়সেই বড়বাবুর মতো তোমার গোঁফদাড়ি গজিয়ে যাবে। আমাকে বলবে নরসুন্দর। কেমন`;

const App: React.FC = () => {
  const [text, setText] = useState(DEFAULT_TEXT);
  const [voice, setVoice] = useState<VoiceName>('Zephyr');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const handleStop = useCallback(() => {
    if (sourceRef.current) {
      try {
        sourceRef.current.stop();
      } catch (e) {
        // Source might have already stopped
      }
      sourceRef.current = null;
    }
    setIsPlaying(false);
  }, []);

  const handleGenerate = async () => {
    if (!text.trim()) {
      setError("Please enter some text to read.");
      return;
    }

    setError(null);
    setIsLoading(true);
    handleStop();

    try {
      const base64Audio = await generateSpeech(text, voice);
      
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({
          sampleRate: 24000,
        });
      }

      const audioCtx = audioContextRef.current;
      const audioData = decode(base64Audio);
      const audioBuffer = await decodeAudioData(audioData, audioCtx, 24000, 1);

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      
      source.onended = () => {
        setIsPlaying(false);
        sourceRef.current = null;
      };

      sourceRef.current = source;
      source.start(0);
      setIsPlaying(true);
    } catch (err: any) {
      setError(err.message || "Failed to generate audio. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <header className="mb-12 text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          Bengali <span className="text-indigo-600">Storyteller</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Experience high-quality AI voices that bring your characters to life, from energetic children to wise elders.
        </p>
      </header>

      <main className="space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-1 gap-10">
          {/* Input Section */}
          <section className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-indigo-100/50 border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <label className="text-lg font-bold text-gray-800 flex items-center gap-2">
                <span>📝</span> Story Content
              </label>
              <button 
                onClick={() => setText('')}
                className="text-sm text-gray-400 hover:text-red-500 transition-colors"
              >
                Clear text
              </button>
            </div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              className="w-full h-72 p-6 text-xl bengali-font border-2 border-gray-100 rounded-3xl focus:ring-4 focus:ring-indigo-50 focus:border-indigo-300 transition-all outline-none resize-none leading-relaxed bg-gray-50/30"
              placeholder="গল্পটি এখানে লিখুন..."
              disabled={isLoading}
            />
          </section>

          {/* Voice Selection */}
          <section className="bg-white p-8 rounded-[2rem] shadow-2xl shadow-indigo-100/50 border border-gray-100">
            <label className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-6">
              <span>🎭</span> Choose a Persona
            </label>
            <VoiceSelector
              selectedVoice={voice}
              onVoiceChange={setVoice}
              disabled={isLoading}
            />
          </section>
        </div>

        {/* Global Controls */}
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50">
          <div className="flex flex-col items-center gap-4">
            {error && (
              <div className="px-6 py-3 bg-red-600 text-white rounded-2xl text-sm font-medium shadow-xl animate-bounce">
                {error}
              </div>
            )}

            <div className="bg-white/80 backdrop-blur-md p-3 rounded-full shadow-2xl border border-white/50 flex items-center gap-3">
              {!isPlaying ? (
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className={`flex items-center gap-3 px-10 py-4 rounded-full text-white font-bold text-lg shadow-lg transform transition-all active:scale-95 ${
                    isLoading
                      ? 'bg-indigo-400 cursor-not-allowed'
                      : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-200'
                  }`}
                >
                  {isLoading ? (
                    <>
                      <svg className="animate-spin h-6 w-6 text-white" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-xl">🔊</span>
                      <span>Generate Story Audio</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="flex items-center gap-3 px-10 py-4 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-lg shadow-lg shadow-rose-100 transform transition-all active:scale-95"
                >
                  <span className="text-xl">⏹️</span>
                  <span>Stop Reading</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="h-32"></div> {/* Spacer for fixed button */}
      
      <footer className="text-center text-gray-400 text-sm pb-8">
        <p>Built with Google Gemini 2.5 Flash • Multi-age Voice Support</p>
      </footer>
    </div>
  );
};

export default App;
