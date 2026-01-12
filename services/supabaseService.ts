
import { createClient } from '@supabase/supabase-js';
import { VoiceOption, Segment, Speaker } from '../types.ts';

const supabaseUrl = "https://adhvgsiutvnbtkjbcvao.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkaHZnc2l1dHZuYnRramJjdmFvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjgyMjkyMjksImV4cCI6MjA4MzgwNTIyOX0.4U4T6KJBh-X9tFlM-9rUsqCvaa_E3Ko-U_YBMAgNcVc";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  usage_chars: number;
  api_key?: string; // Stored in DB
}

export interface SavedStory {
  id: string;
  title: string;
  content: {
    segments: Segment[];
    speakers: Speaker[];
  };
  created_at: string;
}

export const getVoices = async (): Promise<VoiceOption[]> => {
  const { data, error } = await supabase
    .from('voices')
    .select('*')
    .order('label', { ascending: true });
  
  if (error) throw error;
  return data as VoiceOption[];
};

export const registerUser = async (email: string, password: string, fullName: string): Promise<UserProfile> => {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });

  if (error) throw error;
  if (!data.user) throw new Error("Signup failed");

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;
  return profile as UserProfile;
};

export const loginUser = async (email: string, password: string): Promise<UserProfile> => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) throw error;
  if (!data.user) throw new Error("Login failed");

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', data.user.id)
    .single();

  if (profileError) throw profileError;
  return profile as UserProfile;
};

export const updateProfileSettings = async (userId: string, updates: { full_name?: string; api_key?: string }): Promise<UserProfile> => {
  // Ensure we are updating the current user's profile
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);

  if (error) {
    console.error("Supabase Update Error:", error);
    throw error;
  }
  
  // Always perform a fresh fetch to get the updated row, 
  // bypassing potential RLS restrictions on 'update ... select' returns
  const { data: refetched, error: fetchError } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (fetchError) {
    console.error("Supabase Fetch Error after update:", fetchError);
    throw fetchError;
  }

  return refetched as UserProfile;
};

export const saveStory = async (userId: string, title: string, content: { segments: Segment[]; speakers: Speaker[] }) => {
  const { data, error } = await supabase
    .from('stories')
    .insert({ profile_id: userId, title, content })
    .select()
    .single();
  
  if (error) throw error;
  return data as SavedStory;
};

export const getStories = async (userId: string): Promise<SavedStory[]> => {
  const { data, error } = await supabase
    .from('stories')
    .select('*')
    .eq('profile_id', userId)
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data as SavedStory[];
};

export const deleteStory = async (storyId: string) => {
  const { error } = await supabase
    .from('stories')
    .delete()
    .eq('id', storyId);
  if (error) throw error;
};

export const signOut = async () => {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
};

export const getCurrentProfile = async (): Promise<UserProfile | null> => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) return null;
  return data as UserProfile;
};

export const logGeneration = async (profileId: string, segments: Segment[], speakers: Speaker[], totalChars: number) => {
  const { error: genError } = await supabase
    .from('generations')
    .insert({
      profile_id: profileId,
      prompt_data: { segments, speakers }
    });
  
  if (genError) console.error("Failed to log generation:", genError);

  const { data: profile } = await supabase
    .from('profiles')
    .select('usage_chars')
    .eq('id', profileId)
    .single();
    
  if (profile) {
    await supabase
      .from('profiles')
      .update({ usage_chars: (profile.usage_chars || 0) + totalChars })
      .eq('id', profileId);
  }
};
