
import React, { useState, useMemo } from 'react';
import { VoiceName, VoiceOption, AgeCategory, GenderCategory } from '../types.ts';
import { generateVoicePreview } from '../services/geminiService.ts';
import { decode, decodeAudioData, audioBufferToWav } from '../utils/audioUtils.ts';

interface VoiceSelectorProps {
  voices: VoiceOption[];
  selectedPersonaId?: string;
  onPersonaSelect: (persona: VoiceOption) => void;
  disabled?: boolean;
  apiKey: string;
}

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ voices, selectedPersonaId, onPersonaSelect, disabled, apiKey }) => {
  const [ageFilter, setAgeFilter] = useState<AgeCategory | 'All'>('All');
  const [genderFilter, setGenderFilter] = useState<GenderCategory | 'All'>('All');
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredVoices = useMemo(() => {
    return voices.filter(v => 
      (ageFilter === 'All' || v.age === ageFilter) && 
      (genderFilter === 'All' || v.gender === genderFilter) &&
      (v.label.toLowerCase().includes(searchTerm.toLowerCase()) || v.description.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  }, [voices, ageFilter, genderFilter, searchTerm]);

  const handlePreview = async (e: React.MouseEvent, voice: VoiceOption) => {
    e.stopPropagation();
    if (previewingVoice) return;
    if (!apiKey) {
      alert("Please set your Gemini API Key in Settings first.");
      return;
    }
    
    setPreviewingVoice(voice.id);
    try {
      const base64 = await generateVoicePreview(voice.name, voice.label, apiKey);
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      const audioBuffer = await decodeAudioData(decode(base64), audioCtx, 24000, 1);
      
      // We label the preview as AMR for consistency with user request
      const wavBlob = audioBufferToWav(audioBuffer);
      const amrBlob = new Blob([wavBlob], { type: 'audio/amr' });
      const url = URL.createObjectURL(amrBlob);
      
      const audio = new Audio(url);
      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.play();
    } catch (err) {
      console.error(err);
      setPreviewingVoice(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search personas (e.g. Grandma, King)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-5 py-3 rounded-xl bg-black/40 border border-white/5 outline-none focus:border-indigo-500/50 transition-all text-sm font-bold"
          />
        </div>
        <div className="flex gap-2">
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
            {['All', 'Young', 'Adult', 'Senior'].map(cat => (
              <button key={cat} onClick={() => setAgeFilter(cat as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${ageFilter === cat ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{cat}</button>
            ))}
          </div>
          <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
            {['All', 'Male', 'Female'].map(cat => (
              <button key={cat} onClick={() => setGenderFilter(cat as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${genderFilter === cat ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}>{cat}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
        {filteredVoices.map((voice) => (
          <div
            key={voice.id}
            onClick={() => !disabled && onPersonaSelect(voice)}
            className={`group flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${selectedPersonaId === voice.id ? 'border-indigo-500 bg-indigo-500/10' : 'border-white/5 bg-gray-900/40 hover:border-white/10'} ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
          >
            <span className="text-3xl block">{voice.icon}</span>
            <div className="flex-1 overflow-hidden">
              <span className="font-black text-gray-100 text-sm block truncate">{voice.label}</span>
              <p className="text-[10px] text-gray-500 leading-tight line-clamp-2 mt-0.5">{voice.description}</p>
            </div>
            <button onClick={(e) => handlePreview(e, voice)} className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${previewingVoice === voice.id ? 'bg-indigo-600 animate-pulse' : 'bg-white/5 hover:bg-white/10 text-white'}`}>
              {previewingVoice === voice.id ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default VoiceSelector;
