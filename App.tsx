
import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { generateMultiSpeakerSpeech } from './services/geminiService.ts';
import { 
  getVoices, registerUser, loginUser, signOut, 
  getCurrentProfile, logGeneration, updateProfileSettings, 
  saveStory, getStories, deleteStory,
  UserProfile, SavedStory 
} from './services/supabaseService.ts';
import { VoiceName, Speaker, Segment, VoiceOption } from './types.ts';
import { decode, decodeAudioData, audioBufferToWav } from './utils/audioUtils.ts';
import VoiceSelector from './components/VoiceSelector.tsx';

const App: React.FC = () => {
  // User & Auth
  const [user, setUser] = useState<UserProfile | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authName, setAuthName] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Gemini API Key
  const [geminiKey, setGeminiKey] = useState<string>('');
  const [showKeyPrompt, setShowKeyPrompt] = useState(false);

  // Settings
  const [showSettings, setShowSettings] = useState(false);
  const [settingsName, setSettingsName] = useState('');
  const [settingsKey, setSettingsKey] = useState('');
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Studio Content
  const [availableVoices, setAvailableVoices] = useState<VoiceOption[]>([]);
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  // Player State
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);

  // Persistence
  const [savedStories, setSavedStories] = useState<SavedStory[]>([]);
  const [storyTitle, setStoryTitle] = useState('New Story');
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [editingSpeakerId, setEditingSpeakerId] = useState<string | null>(null);
  const [isCreatingSpeaker, setIsCreatingSpeaker] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        const voices = await getVoices();
        setAvailableVoices(voices);
        
        const profile = await getCurrentProfile();
        if (profile) {
          setUser(profile);
          setSettingsName(profile.full_name);
          
          const key = profile.api_key || localStorage.getItem('gemini_api_key') || '';
          setGeminiKey(key);
          if (!key) setShowKeyPrompt(true);

          if (voices.length > 0) {
            const v1 = voices.find(v => v.label === 'Thakurda') || voices[0];
            const v2 = voices.find(v => v.label === 'Khokababu') || voices[1] || voices[0];
            
            const s1 = { id: 's1', name: v1.label, voice: v1.name, personaId: v1.id };
            const s2 = { id: 's2', name: v2.label, voice: v2.name, personaId: v2.id };
            setSpeakers([s1, s2]);
            setSegments([
              { id: 'seg1', speakerId: 's1', text: 'ছোটমামার সঙ্গে রাতবিরেতে বাইরে কোথাও গেলেই কী সব বিদঘুটে কাণ্ড বেধে যায়।' },
              { id: 'seg2', speakerId: 's2', text: 'ছোটমামা সাধাসাধি করলেও সন্ধ্যার পর তাঁর সঙ্গে কোথাও যেতুম না।' }
            ]);
          }

          const stories = await getStories(profile.id);
          setSavedStories(stories);
        } else {
          setShowAuth(true);
        }
      } catch (err) {
        console.error("Initialization failed", err);
        setError("Failed to connect to database.");
      }
    };
    init();
  }, []);

  const activeSpeakerCount = useMemo(() => new Set(segments.map(s => s.speakerId)).size, [segments]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) return;
    setAuthLoading(true);
    setError(null);
    try {
      let profile;
      if (authMode === 'login') {
        profile = await loginUser(authEmail, authPassword);
      } else {
        if (!authName) throw new Error("Please enter your name.");
        profile = await registerUser(authEmail, authPassword, authName);
      }
      setUser(profile);
      setSettingsName(profile.full_name);
      setGeminiKey(profile.api_key || '');
      if (!profile.api_key) setShowKeyPrompt(true);
      const stories = await getStories(profile.id);
      setSavedStories(stories);
      setShowAuth(false);
    } catch (err: any) {
      setError(err.message || "Authentication failed.");
    } finally {
      setAuthLoading(false);
    }
  };

  const openSettings = () => {
    if (user) {
      setSettingsName(user.full_name);
      setSettingsKey(''); 
      setShowSettings(true);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSettingsSaving(true);
    setError(null);
    try {
      const updates: any = {};
      if (settingsName && settingsName !== user.full_name) {
        updates.full_name = settingsName;
      }
      if (settingsKey && settingsKey.trim() !== '') {
        updates.api_key = settingsKey.trim();
      }
      
      if (Object.keys(updates).length > 0) {
        const updated = await updateProfileSettings(user.id, updates);
        setUser(updated);
        // Ensure state and local storage reflect what was successfully saved to DB
        if (updated.api_key) {
          setGeminiKey(updated.api_key);
          localStorage.setItem('gemini_api_key', updated.api_key);
        }
      }
      
      setSettingsKey('');
      setShowSettings(false);
      setShowKeyPrompt(false);
    } catch (err: any) {
      console.error("Settings update failed:", err);
      setError(err.message || "Failed to save settings. Please ensure your database table supports 'api_key'.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleKeyPromptSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !settingsKey) return;
    try {
      const updated = await updateProfileSettings(user.id, { api_key: settingsKey.trim() });
      setUser(updated);
      if (updated.api_key) {
        setGeminiKey(updated.api_key);
        localStorage.setItem('gemini_api_key', updated.api_key);
      }
      setSettingsKey('');
      setShowKeyPrompt(false);
    } catch (err: any) {
      setError("Failed to save API key to database.");
    }
  };

  const handleSaveStory = async () => {
    if (!user) return;
    setIsSaving(true);
    try {
      const saved = await saveStory(user.id, storyTitle, { segments, speakers });
      setSavedStories([saved, ...savedStories.filter(s => s.id !== saved.id)]);
      alert("Story saved successfully!");
    } catch (err: any) {
      setError("Failed to save story.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleLoadStory = (story: SavedStory) => {
    setStoryTitle(story.title);
    setSegments(story.content.segments);
    setSpeakers(story.content.speakers);
    setAudioUrl(null);
  };

  const handleDeleteStory = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this story?")) return;
    try {
      await deleteStory(id);
      setSavedStories(savedStories.filter(s => s.id !== id));
    } catch (err) {
      setError("Failed to delete story.");
    }
  };

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setShowAuth(true);
  };

  const handleGenerate = async () => {
    if (!geminiKey) { setShowKeyPrompt(true); return; }
    if (!user) { setShowAuth(true); return; }
    if (segments.some(s => !s.text.trim())) { setError("Please fill in all dialogue boxes."); return; }
    if (activeSpeakerCount > 2) { setError("Maximum 2 characters allowed."); return; }

    setError(null);
    setIsLoading(true);
    
    try {
      const base64Audio = await generateMultiSpeakerSpeech(segments, speakers, geminiKey);
      const totalChars = segments.reduce((acc, s) => acc + s.text.length, 0);
      await logGeneration(user.id, segments, speakers, totalChars);
      setUser(prev => prev ? { ...prev, usage_chars: (prev.usage_chars || 0) + totalChars } : null);

      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64Audio), audioCtx, 24000, 1);
      
      const wavBlob = audioBufferToWav(audioBuffer);
      const url = URL.createObjectURL(wavBlob);
      
      setAudioUrl(url);
      setIsPlaying(true);
    } catch (err: any) {
      setError(err.message || "Generation failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const updateSpeakerVoice = useCallback((speakerId: string, persona: VoiceOption) => {
    setSpeakers(prev => prev.map(s => s.id === speakerId ? { 
      ...s, 
      voice: persona.name, 
      personaId: persona.id,
      name: persona.label
    } : s));
    setEditingSpeakerId(null);
    setAudioUrl(null);
  }, []);

  const handlePlayPause = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const removeSegment = (id: string) => {
    if (segments.length <= 1) return;
    setSegments(segments.filter(s => s.id !== id));
    setAudioUrl(null);
  };

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleDownload = () => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    a.download = `${storyTitle.replace(/\s+/g, '_')}_story.mp3`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="min-h-screen bg-[#050505] text-gray-100 font-sans selection:bg-indigo-500/30">
      
      {showKeyPrompt && !showAuth && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-6 bg-black/98 backdrop-blur-2xl">
          <form onSubmit={handleKeyPromptSubmit} className="bg-[#0c0c0e] w-full max-w-md rounded-[2.5rem] p-10 border border-white/10 shadow-2xl animate-slide-up">
            <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-6 text-amber-500 text-3xl">🔑</div>
            <h2 className="text-2xl font-black mb-2">Gemini Key Required</h2>
            <p className="text-gray-500 text-sm mb-8">This app uses your own Google Gemini API key. It will be stored securely in your private profile on our database.</p>
            <div className="space-y-4">
              <input required type="password" value={settingsKey} onChange={e => setSettingsKey(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-amber-500 text-gray-100 font-mono text-sm" placeholder="Paste AI Studio API Key..." />
              <button type="submit" className="w-full py-5 rounded-2xl bg-amber-600 hover:bg-amber-500 text-white font-black transition-all">SAVE KEY TO PROFILE</button>
              <p className="text-[10px] text-center text-gray-600 uppercase font-black tracking-widest">Get one at <a href="https://aistudio.google.com/api-keys" target="_blank" className="text-amber-500 underline">aistudio.google.com</a></p>
            </div>
          </form>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center p-6 bg-black/90 backdrop-blur-xl">
          <form onSubmit={handleSaveSettings} className="bg-[#0c0c0e] w-full max-w-md rounded-[2.5rem] p-10 border border-white/10 shadow-2xl">
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-2xl font-black">Settings</h2>
              <button type="button" onClick={() => setShowSettings(false)} className="text-gray-500 hover:text-white">&times;</button>
            </div>
            <div className="space-y-6">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Display Name</label>
                <input value={settingsName} onChange={e => setSettingsName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-indigo-500 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-500 tracking-widest ml-1">Gemini API Key (Update)</label>
                <input type="password" value={settingsKey} onChange={e => setSettingsKey(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-indigo-500 font-mono text-xs" placeholder="••••••••••••••••" />
              </div>
              <button type="submit" disabled={settingsSaving} className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all disabled:opacity-50">
                {settingsSaving ? 'SAVING...' : 'SAVE CHANGES'}
              </button>
              <button type="button" onClick={handleLogout} className="w-full py-4 rounded-2xl border border-rose-500/20 text-rose-500 font-bold text-sm hover:bg-rose-500/5 transition-all">SIGN OUT</button>
            </div>
          </form>
        </div>
      )}

      {showAuth && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/95 backdrop-blur-xl">
          <form onSubmit={handleAuth} className="bg-[#0c0c0e] w-full max-w-md rounded-[2.5rem] p-10 border border-white/10 shadow-2xl animate-slide-up">
            <h2 className="text-3xl font-black text-white mb-2">{authMode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
            <div className="space-y-4 mt-8">
              {authMode === 'register' && (
                <input required value={authName} onChange={e => setAuthName(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-indigo-500 font-bold" placeholder="Full Name" />
              )}
              <input required type="email" value={authEmail} onChange={e => setAuthEmail(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-indigo-500 font-bold" placeholder="Email Address" />
              <input required type="password" value={authPassword} onChange={e => setAuthPassword(e.target.value)} className="w-full px-6 py-4 rounded-2xl bg-black border border-white/5 outline-none focus:border-indigo-500 font-bold" placeholder="Password" minLength={6} />
              {error && <p className="text-rose-400 text-xs font-bold px-1">{error}</p>}
              <button type="submit" disabled={authLoading} className="w-full py-5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition-all disabled:opacity-50">
                {authLoading ? '...' : authMode === 'login' ? 'LOG IN' : 'REGISTER'}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')} className="w-full text-sm font-bold text-gray-500 hover:text-white transition-colors">
                {authMode === 'login' ? "New here? Register" : "Already registered? Login"}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="max-w-6xl mx-auto py-12 px-6 pb-48 flex flex-col lg:flex-row gap-12">
        <aside className="w-full lg:w-72 flex-shrink-0 space-y-6">
          <div className="bg-white/5 rounded-[2.5rem] p-6 border border-white/10 shadow-2xl">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-6 px-1">Studio Library</h3>
            <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
              {savedStories.map(story => (
                <button key={story.id} onClick={() => handleLoadStory(story)} className="w-full group relative text-left p-4 rounded-2xl bg-black border border-white/5 hover:border-indigo-500 transition-all flex flex-col gap-1">
                  <span className="text-xs font-black text-gray-200 truncate">{story.title}</span>
                  <span className="text-[9px] text-gray-600">{new Date(story.created_at).toLocaleDateString()}</span>
                  <button onClick={(e) => handleDeleteStory(e, story.id)} className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 text-gray-700 hover:text-rose-500 transition-all">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </button>
              ))}
              {savedStories.length === 0 && <p className="text-[10px] text-gray-600 text-center py-4">No stories saved yet.</p>}
            </div>
          </div>
        </aside>

        <div className="flex-1">
          <header className="mb-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
              <div className="flex-1">
                <input value={storyTitle} onChange={e => setStoryTitle(e.target.value)} className="text-4xl font-black bg-transparent border-none outline-none text-white w-full hover:text-indigo-400 focus:text-indigo-400 transition-all" placeholder="Story Title..." />
                <div className="flex items-center gap-4 mt-2">
                  <p className="text-gray-500 font-medium text-sm">Hi, {user?.full_name || 'Storyteller'}</p>
                  <div className="h-4 w-px bg-white/10" />
                  <span className="text-[10px] font-black text-indigo-400 uppercase tracking-wider">{user?.usage_chars || 0} Chars Synth.</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={handleSaveStory} disabled={isSaving} className="px-6 py-3 rounded-2xl bg-white text-black font-black text-xs hover:bg-indigo-500 hover:text-white transition-all">SAVE STORY</button>
                <button onClick={openSettings} className="w-12 h-12 rounded-2xl bg-gray-900 border border-white/5 flex items-center justify-center hover:border-indigo-500 transition-all text-xl shadow-lg">⚙️</button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 p-5 rounded-[2.5rem] bg-white/5 border border-white/10 shadow-2xl">
              {speakers.map(s => {
                const persona = availableVoices.find(v => v.id === s.personaId) || availableVoices[0];
                return (
                  <button key={s.id} onClick={() => setEditingSpeakerId(s.id)} className={`px-4 py-3 rounded-2xl border transition-all flex items-center gap-3 ${editingSpeakerId === s.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-gray-950 hover:border-white/10 shadow-lg'}`}>
                    <span className="text-2xl">{persona?.icon}</span>
                    <div className="text-left">
                      <span className="text-[10px] font-black uppercase text-gray-500 block leading-none">{s.name}</span>
                      <span className="text-xs font-bold text-gray-300">{persona?.label}</span>
                    </div>
                  </button>
                );
              })}
              <button onClick={() => setIsCreatingSpeaker(true)} className="w-12 h-12 rounded-2xl border-2 border-dashed border-gray-800 flex items-center justify-center text-gray-600 hover:border-indigo-500 hover:text-indigo-500 transition-all text-xl">+</button>
            </div>
          </header>

          <main className="space-y-8">
            {segments.map((seg) => {
              const speaker = speakers.find(s => s.id === seg.speakerId);
              const persona = availableVoices.find(v => v.id === speaker?.personaId) || availableVoices[0];
              return (
                <div key={seg.id} className="group relative flex gap-5 animate-slide-up">
                  <div className="flex-shrink-0 flex flex-col items-center gap-3 pt-2">
                    <button onClick={() => {
                      const idx = speakers.findIndex(s => s.id === seg.speakerId);
                      const next = speakers[(idx + 1) % speakers.length];
                      setSegments(segments.map(s => s.id === seg.id ? { ...s, speakerId: next.id } : s));
                    }} className="w-14 h-14 rounded-[1.25rem] bg-gray-900 border border-white/5 flex items-center justify-center text-3xl hover:border-indigo-500 transition-all shadow-xl">
                      {persona?.icon || '👤'}
                    </button>
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-600 text-center max-w-[60px] truncate">{speaker?.name}</span>
                  </div>
                  <div className="flex-1 bg-gray-900/30 rounded-[2rem] border border-white/5 p-6 hover:border-indigo-500/20 transition-all relative">
                    <textarea value={seg.text} onChange={(e) => setSegments(segments.map(s => s.id === seg.id ? { ...s, text: e.target.value } : s))} className="w-full bg-transparent border-none outline-none text-xl bengali-font resize-none leading-relaxed text-gray-200 min-h-[80px]" placeholder="Bengali dialogue..." />
                    <button onClick={() => removeSegment(seg.id)} className="absolute top-6 right-6 p-2 rounded-lg bg-black border border-white/5 text-gray-700 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </div>
                </div>
              );
            })}
            <button onClick={() => setSegments([...segments, { id: Date.now().toString(), speakerId: speakers[0].id, text: '' }])} className="w-full py-8 rounded-[2rem] border-2 border-dashed border-gray-800 text-gray-600 hover:text-indigo-400 hover:border-indigo-500 transition-all font-black flex items-center justify-center gap-3 group">
              <span className="text-2xl group-hover:scale-125 transition-transform">+</span> <span>NEW DIALOGUE LINE</span>
            </button>
          </main>
        </div>
      </div>

      {isCreatingSpeaker && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-[#0c0c0e] w-full max-w-2xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl flex flex-col">
            <div className="flex justify-between mb-8">
              <h2 className="text-2xl font-black">Add Persona</h2>
              <button onClick={() => setIsCreatingSpeaker(false)} className="text-gray-500 hover:text-white">&times;</button>
            </div>
            <VoiceSelector apiKey={geminiKey} voices={availableVoices} onPersonaSelect={(p) => {
              setSpeakers([...speakers, { id: Date.now().toString(), name: p.label, voice: p.name, personaId: p.id }]);
              setIsCreatingSpeaker(false);
            }} />
          </div>
        </div>
      )}

      {editingSpeakerId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/95 backdrop-blur-md">
          <div className="bg-[#0c0c0e] w-full max-w-2xl rounded-[2.5rem] p-8 border border-white/10 shadow-2xl flex flex-col">
             <div className="flex justify-between mb-8">
              <h2 className="text-2xl font-black">Switch Voice</h2>
              <button onClick={() => setEditingSpeakerId(null)} className="text-gray-500 hover:text-white">&times;</button>
            </div>
            <VoiceSelector apiKey={geminiKey} voices={availableVoices} selectedPersonaId={speakers.find(s => s.id === editingSpeakerId)?.personaId} onPersonaSelect={(p) => updateSpeakerVoice(editingSpeakerId, p)} />
          </div>
        </div>
      )}

      {/* Advanced Music Player UI */}
      <div className="fixed bottom-0 left-0 right-0 z-50 p-6 pointer-events-none">
        <div className="max-w-5xl mx-auto bg-[#0a0a0c]/90 backdrop-blur-3xl border border-white/10 rounded-[3rem] p-6 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.8)] pointer-events-auto ring-1 ring-white/5">
          {audioUrl && (
            <audio 
              ref={audioRef} 
              src={audioUrl} 
              autoPlay={isPlaying} 
              onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
              onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
              onEnded={() => setIsPlaying(false)} 
            />
          )}
          
          <div className="flex items-center gap-8">
            <div className="flex-shrink-0">
              <button 
                onClick={handlePlayPause} 
                disabled={!audioUrl && !isLoading}
                className={`w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all shadow-xl active:scale-90 ${isLoading ? 'bg-amber-500' : audioUrl ? 'bg-white text-black hover:bg-indigo-500 hover:text-white' : 'bg-gray-800 text-gray-600'}`}
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                ) : isPlaying ? (
                  <svg className="w-7 h-7" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6zm8 0h4v16h-4z"/></svg>
                ) : (
                  <svg className="w-7 h-7 ml-1" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                )}
              </button>
            </div>

            <div className="flex-1 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-black uppercase text-indigo-400 tracking-widest truncate">
                      {isLoading ? 'Synthesizing...' : error ? 'Synthesize Failed' : audioUrl ? 'Story Masterpiece' : 'Ready to start'}
                    </span>
                    <h4 className="text-sm font-black text-white truncate">{storyTitle}</h4>
                  </div>
                  <div className={`wave-container ml-4 hidden sm:flex ${isPlaying ? 'wave-active' : ''}`}>
                    {[...Array(12)].map((_, i) => <div key={i} className="wave-bar" />)}
                  </div>
                </div>
                <div className="text-[10px] font-mono text-gray-500 font-bold tabular-nums ml-4">
                  {formatTime(currentTime)} / {formatTime(duration)}
                </div>
              </div>
              
              <div className="relative group">
                <input 
                  type="range" 
                  min="0" 
                  max={duration || 0} 
                  step="0.01"
                  value={currentTime} 
                  onChange={handleTimeChange}
                  disabled={!audioUrl}
                  className="w-full h-1.5 rounded-full outline-none disabled:opacity-30 transition-all"
                />
              </div>
              
              {error && (
                <div className="text-[10px] text-rose-400 font-bold bg-rose-500/5 px-2 py-1 rounded-md border border-rose-500/10 max-h-12 overflow-y-auto custom-scrollbar">
                  {error}
                </div>
              )}
            </div>

            <div className="flex items-center gap-6">
              <div className="hidden lg:flex items-center gap-3">
                <svg className="w-4 h-4 text-gray-500" fill="currentColor" viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                <input 
                  type="range" 
                  min="0" 
                  max="1" 
                  step="0.1" 
                  value={volume} 
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setVolume(val);
                    if (audioRef.current) audioRef.current.volume = val;
                  }}
                  className="w-20 h-1"
                />
              </div>

              {!audioUrl ? (
                <button 
                  onClick={handleGenerate} 
                  disabled={isLoading}
                  className="px-8 py-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20 disabled:opacity-50 transition-all whitespace-nowrap"
                >
                  Generate Story
                </button>
              ) : (
                <div className="flex items-center gap-3">
                  <button 
                    onClick={handleDownload}
                    className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                    title="Download MP3"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a2 2 0 002 2h12a2 2 0 002-2v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                  </button>
                  <button 
                    onClick={() => { setAudioUrl(null); setDuration(0); setCurrentTime(0); setError(null); }}
                    className="w-12 h-12 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                    title="Clear"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;
