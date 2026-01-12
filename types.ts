
export type VoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export type AgeCategory = 'Young' | 'Adult' | 'Senior';
export type GenderCategory = 'Male' | 'Female' | 'Neutral';

export interface VoiceOption {
  id: string; // Unique persona ID
  name: VoiceName; // Underlying Gemini voice engine
  label: string; // Display name for the persona
  age: AgeCategory;
  gender: GenderCategory;
  description: string;
  icon: string;
}

export interface Speaker {
  id: string;
  name: string;
  voice: VoiceName;
  personaId?: string; // Track which specific persona was chosen
}

export interface Segment {
  id: string;
  speakerId: string;
  text: string;
}

export interface AudioState {
  isPlaying: boolean;
  isLoading: boolean;
  error: string | null;
}
