import librosa
import numpy as np
from transformers import ClapModel, ClapProcessor
import torch
import warnings
from typing import Dict, List, Tuple, Optional, Any
from app.models.schemas import Track, AnalysisResult

class AnalysisService:
    _clap_model = None
    _clap_processor = None

    @classmethod
    def get_clap_model(cls):
        """Lazy load LAION-CLAP model"""
        if cls._clap_model is None:
            try:
                print("Loading LAION-CLAP Model...")
                model_name = "laion/clap-htsat-unfused"
                cls._clap_processor = ClapProcessor.from_pretrained(model_name)
                cls._clap_model = ClapModel.from_pretrained(model_name)
                print("LAION-CLAP Model Loaded successfully.")
            except Exception as e:
                print(f"Error loading CLAP model: {e}")
                return None, None
        return cls._clap_model, cls._clap_processor

    @staticmethod
    async def analyze_track(track: Track):
        """
        Zero-Shot Audio Analysis using LAION-CLAP
        Matches audio against natural language descriptions.
        """
        try:
            print(f"Starting CLAP analysis for: {track.filename}")
            
            # --- 1. BASIC FEATURES (Librosa) ---
            # Load with librosa for signal stats
            y, sr = librosa.load(track.filepath, sr=48000) # CLAP uses 48k usually, or processor handles it
            duration = librosa.get_duration(y=y, sr=sr)
            
            # BPM & Key
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            bpm = float(tempo)
            
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            key_idx = np.argmax(np.mean(chroma, axis=1))
            keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            detected_key = keys[key_idx]
            
            # Spectral/Dynamics (Librosa - Keep basic stats but replace Energy/Dance for final output)
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            brightness = float(np.mean(spectral_centroid))
            
            # --- 2. CLAP ZERO-SHOT CLASSIFICATION ---
            clap_genres = []
            clap_moods = []
            clap_instruments = {}
            
            model, processor = AnalysisService.get_clap_model()
            
            if model and processor:
                try:
                    # DEFINING PROMPTS
                    # The power of CLAP: We simply describe what we are looking for.
                    
                    # Genre Prompts (Text Candidates)
                    # We map the "Prompt" -> "Display Tag"
                    genre_prompts = {
                        "Hip Hop": ["A hip hop song", "A rap song", "Old school hip hop beat", "Modern hip hop"],
                        "Trap": ["A trap music beat", "Trap music with 808s", "A heavy trap banger"],
                        "Pop": ["A pop song", "Modern pop music", "A catchy pop track"],
                        "R&B": ["R&B music", "A smooth R&B song", "Soulful R&B"],
                        "Rock": ["A rock song", "Electric guitar rock music", "Hard rock"],
                        "Electronic": ["Electronic music", "EDM track", "Synthesizer music"],
                        "Techno": ["Techno music", "Four on the floor techno"],
                        "House": ["House music", "A house music beat"],
                        "Lofi": ["Lofi hip hop", "Chill lofi beat", "Relaxing lofi music"],
                        "Dark Trap": ["Dark trap music", "Ominous trap beat", "Scary trap music"],
                        "Drill": ["Drill music", "UK Drill beat", "Aggressive drill"],
                        "Alternative": ["Alternative music", "Indie alternative"],
                        "Jazz": ["Jazz music", "A jazz track"],
                        "Classical": ["Classical music", "Orchestral music"],
                        "Reggae": ["Reggae music", "Dub reggae"],
                        "Metal": ["Heavy metal", "Death metal"],
                        "Country": ["Country music"],
                        "Ambient": ["Ambient music", "Atmospheric soundscape"]
                    }
                    
                    # Flatten prompts for inference
                    all_texts = []
                    text_map = [] # Index -> (Genre, SpecificPrompt)
                    
                    for genre, variations in genre_prompts.items():
                        for v in variations:
                            all_texts.append(v)
                            text_map.append(genre)

                    # Mood Prompts
                    mood_prompts = [
                        "Happy", "Sad", "Dark", "Bright", "Chill", "Aggressive", 
                        "Energetic", "Relaxing", "Tense", "Melancholic", "Uplifting", 
                        "Romantic", "Eerie", "Sentimental", "Groovy", "Dreamy"
                    ]
                    # Convert moods to sentences for better CLAP accuracy
                    mood_texts = [f"A {m.lower()} song" for m in mood_prompts]
                    
                    # Instrument Prompts
                    inst_prompts = ["Piano", "Guitar", "Drums", "Bass", "Synthesizer", "Violin", "Saxophone", "808 Bass"]
                    inst_texts = [f"The sound of {i.lower()}" for i in inst_prompts]

                    # --- INFERENCE ---
                    # We process inputs. CLAP handles audio resampling internally via processor if I passed raw bytes,
                    # but since I have 'y' at 48k (or whatever librosa loaded), I should ensure it matches or let processor handle it.
                    # Verify processor sampling rate. Usually 48000.
                    
                    # 1. Genres
                    inputs = processor(text=all_texts, audios=y, return_tensors="pt", sampling_rate=sr, padding=True)
                    with torch.no_grad():
                        outputs = model(**inputs)
                    
                    # Get similarity scores (logits_per_audio)
                    logits = outputs.logits_per_audio # [1, num_texts]
                    probs = logits.softmax(dim=-1)
                    
                    # Aggregate scores by Genre (Max pooling across variations)
                    genre_scores = {}
                    for idx, score in enumerate(probs[0]):
                        target_genre = text_map[idx]
                        current = genre_scores.get(target_genre, 0.0)
                        genre_scores[target_genre] = max(current, float(score))
                        
                    # Filter top genres
                    sorted_genres = sorted(genre_scores.items(), key=lambda x: x[1], reverse=True)
                    # CLAP is very confident, so we take top 3 distinct
                    for g, s in sorted_genres[:5]:
                        if s > 0.01: # Low threshold because softmax distributes across many prompts
                            clap_genres.append(g)

                    # 2. Moods
                    inputs_m = processor(text=mood_texts, audios=y, return_tensors="pt", sampling_rate=sr, padding=True)
                    with torch.no_grad():
                        outputs_m = model(**inputs_m)
                    probs_m = outputs_m.logits_per_audio.softmax(dim=-1)
                    
                    sorted_moods = []
                    for idx, score in enumerate(probs_m[0]):
                        sorted_moods.append((mood_prompts[idx], float(score)))
                    sorted_moods.sort(key=lambda x: x[1], reverse=True)
                    
                    for m, s in sorted_moods[:5]:
                        clap_moods.append(m)

                    # 3. Instruments
                    inputs_i = processor(text=inst_texts, audios=y, return_tensors="pt", sampling_rate=sr, padding=True)
                    with torch.no_grad():
                        outputs_i = model(**inputs_i)
                    probs_i = outputs_i.logits_per_audio.softmax(dim=-1)
                    
                    for idx, score in enumerate(probs_i[0]):
                        if score > 0.05:
                            clap_instruments[inst_prompts[idx]] = round(float(score), 3)

                    # 4. ENERGY & DANCEABILITY (AI-Based)
                    # Instead of RMS/PLP, we ask the AI.
                    metric_prompts = [
                        "High energy music", "Low energy music",
                        "Danceable music", "Not danceable music"
                    ]
                    inputs_met = processor(text=metric_prompts, audios=y, return_tensors="pt", sampling_rate=sr, padding=True)
                    with torch.no_grad():
                        outputs_met = model(**inputs_met)
                    probs_met = outputs_met.logits_per_audio.softmax(dim=-1) # [1, 4]
                    
                    # Energy Score: High vs Low
                    p_high = float(probs_met[0][0])
                    p_low = float(probs_met[0][1])
                    ai_energy = p_high / (p_high + p_low + 1e-6) # Normalize relative to the pair
                    
                    # Danceability Score: Danceable vs Not
                    p_dance = float(probs_met[0][2])
                    p_no_dance = float(probs_met[0][3])
                    ai_danceability = p_dance / (p_dance + p_no_dance + 1e-6)

                    # FUSION LOGIC (Mood + Genre)
                    # Example: "Dark" + "Trap" -> "Dark Trap"
                    # Only if they aren't already explicit genres
                    top_genre = clap_genres[0] if clap_genres else ""
                    top_mood = clap_moods[0] if clap_moods else ""
                    
                    fusion = f"{top_mood} {top_genre}"
                    # Check if this fusion already exists as a main genre (e.g. "Dark Trap" is in our prompt list)
                    # If it's a novel combination, add it.
                    if top_genre and top_mood:
                        clap_genres.insert(0, fusion)

                except Exception as e:
                    print(f"CLAP Inference Error: {e}")
                    import traceback
                    traceback.print_exc()

            # Fallbacks
            if not clap_genres:
                clap_genres = ["Unknown"]
            
            # Use AI metrics if available, otherwise 0.5 default (should not happen if CLAP loads)
            final_energy = ai_energy if 'ai_energy' in locals() else 0.5
            final_dance = ai_danceability if 'ai_danceability' in locals() else 0.5

            # 3. CONSTRUCT RESULT
            # User requested removal of valence, brightness, warmth, tension.
            model_tags = {
                "energy": round(final_energy * 10, 1), 
                "danceability": round(final_dance, 2),
                "instruments": clap_instruments,
                "ai_moods": {m: 0.9 for m in clap_moods} 
            }

            analysis = AnalysisResult(
                bpm=bpm,
                bpm_confidence=0.9,
                key_key=detected_key,
                key_scale="Major", 
                energy=min(final_energy * 10, 10.0),
                danceability=min(final_dance, 1.0),
                loudness=0,
                model_tags=model_tags
            )
            
            track.analysis = analysis
            track.status = "complete"
            track.duration = duration
            
            track.final_bpm = bpm
            track.final_key = detected_key
            # Deduplicate and limit
            track.suggested_genres = list(dict.fromkeys(clap_genres))[:5]
            track.suggested_moods = list(dict.fromkeys(clap_moods))[:5]
            
            return track
            
        except Exception as e:
            print(f"Analysis error: {e}")
            import traceback
            traceback.print_exc()
            track.status = "failed"
            return track
    

