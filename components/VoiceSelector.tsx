
import React from 'react';
import { VoiceName } from '../types.ts';

interface VoiceSelectorProps {
  selectedVoice: VoiceName;
  onVoiceChange: (voice: VoiceName) => void;
  disabled?: boolean;
}

interface VoiceOption {
  name: VoiceName;
  label: string;
  category: 'Young' | 'Adult' | 'Senior';
  description: string;
  icon: string;
}

const VOICES: VoiceOption[] = [
  { 
    name: 'Puck', 
    label: 'Puck', 
    category: 'Young', 
    description: 'Playful, high-energy, and spirited.',
    icon: '🧒'
  },
  { 
    name: 'Zephyr', 
    label: 'Zephyr', 
    category: 'Young', 
    description: 'Warm, smooth, and friendly young adult.',
    icon: '🧑'
  },
  { 
    name: 'Kore', 
    label: 'Kore', 
    category: 'Adult', 
    description: 'Professional, clear, and articulate.',
    icon: '👩‍💼'
  },
  { 
    name: 'Fenrir', 
    label: 'Fenrir', 
    category: 'Adult', 
    description: 'Bold, strong, and commanding.',
    icon: '🧔'
  },
  { 
    name: 'Charon', 
    label: 'Charon', 
    category: 'Senior', 
    description: 'Deep, resonant, and calm elder.',
    icon: '👴'
  },
];

const VoiceSelector: React.FC<VoiceSelectorProps> = ({ selectedVoice, onVoiceChange, disabled }) => {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {VOICES.map((voice) => (
        <button
          key={voice.name}
          onClick={() => onVoiceChange(voice.name)}
          disabled={disabled}
          className={`relative p-5 rounded-2xl border-2 transition-all text-left flex flex-col gap-2 ${
            selectedVoice === voice.name
              ? 'border-indigo-600 bg-indigo-50 ring-4 ring-indigo-100'
              : 'border-gray-200 hover:border-indigo-300 bg-white'
          } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}`}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-2xl">{voice.icon}</span>
            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-md ${
              voice.category === 'Young' ? 'bg-green-100 text-green-700' :
              voice.category === 'Adult' ? 'bg-blue-100 text-blue-700' :
              'bg-purple-100 text-purple-700'
            }`}>
              {voice.category}
            </span>
          </div>
          <div>
            <span className="font-bold text-gray-900 text-lg block">{voice.label}</span>
            <span className="text-sm text-gray-500 leading-tight block mt-1">{voice.description}</span>
          </div>
        </button>
      ))}
    </div>
  );
};

export default VoiceSelector;
