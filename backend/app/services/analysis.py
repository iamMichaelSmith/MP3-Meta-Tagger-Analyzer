import librosa
import numpy as np
from transformers import ClapModel, ClapProcessor
import torch
import warnings
import os
from typing import Dict, List, Tuple, Optional, Any
from app.models.schemas import Track, AnalysisResult

try:
    import acoustid
except Exception:
    acoustid = None

try:
    import essentia.standard as es
except Exception:
    es = None

class AnalysisService:
    _clap_model = None
    _clap_processor = None

    @staticmethod
    def _env_flag(name: str, default: bool) -> bool:
        raw = os.getenv(name)
        if raw is None:
            return default
        return raw.strip().lower() in {"1", "true", "yes", "on"}

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
    def _run_acoustid_lookup(filepath: str) -> Dict[str, Any]:
        """
        Fingerprint and optionally identify a track using AcoustID.
        Returns structured metadata for downstream scoring and UI display.
        """
        result: Dict[str, Any] = {
            "enabled": acoustid is not None,
            "status": "skipped",
            "api_key_configured": False,
            "fingerprint_generated": False,
            "best_score": 0.0,
            "matches": []
        }

        if acoustid is None:
            result["status"] = "dependency_missing"
            result["error"] = "pyacoustid not installed"
            return result

        api_key = os.getenv("ACOUSTID_API_KEY", "").strip()
        result["api_key_configured"] = bool(api_key)

        try:
            fingerprint_duration, fingerprint = acoustid.fingerprint_file(filepath)
            result["fingerprint_generated"] = True
            result["fingerprint_duration"] = round(float(fingerprint_duration), 2)
        except Exception as e:
            result["status"] = "fingerprint_failed"
            result["error"] = str(e)
            return result

        # If API key is not set, keep local fingerprinting-only status.
        if not api_key:
            result["status"] = "fingerprinted_only"
            return result

        try:
            lookup_response = acoustid.lookup(
                api_key,
                fingerprint,
                fingerprint_duration,
                meta=["recordings", "releasegroups"]
            )

            parsed_matches = list(acoustid.parse_lookup_result(lookup_response))
            top_matches: List[Dict[str, Any]] = []

            for score, recording_id, title, artist in parsed_matches[:5]:
                top_matches.append(
                    {
                        "score": round(float(score), 4),
                        "recording_id": recording_id,
                        "title": title or "",
                        "artist": artist or ""
                    }
                )

            result["matches"] = top_matches
            result["best_score"] = top_matches[0]["score"] if top_matches else 0.0

            # AcoustID track id (cluster id) from raw lookup if available.
            raw_results = lookup_response.get("results", []) if isinstance(lookup_response, dict) else []
            if raw_results:
                result["acoustid_id"] = raw_results[0].get("id", "")

            result["status"] = "matched" if top_matches else "no_match"
            return result
        except Exception as e:
            result["status"] = "lookup_failed"
            result["error"] = str(e)
            return result

    @staticmethod
    def _pool_get(pool: Any, key: str, default: Any = None) -> Any:
        try:
            return pool[key]
        except Exception:
            return default

    @staticmethod
    def _to_float(value: Any, default: float = 0.0) -> float:
        try:
            if value is None:
                return default
            return float(value)
        except Exception:
            return default

    @staticmethod
    def _run_essentia_analysis(filepath: str) -> Dict[str, Any]:
        """
        Run Essentia MusicExtractor and return robust rhythm/tonal descriptors.
        """
        result: Dict[str, Any] = {
            "enabled": es is not None,
            "status": "skipped"
        }

        if es is None:
            result["status"] = "dependency_missing"
            result["error"] = "essentia is not installed"
            return result

        try:
            features, _ = es.MusicExtractor(
                lowlevelStats=["mean", "stdev"],
                rhythmStats=["mean", "stdev"],
                tonalStats=["mean", "stdev"]
            )(filepath)

            bpm = AnalysisService._to_float(AnalysisService._pool_get(features, "rhythm.bpm"))
            key = AnalysisService._pool_get(features, "tonal.key_edma.key", "") or ""
            scale = AnalysisService._pool_get(features, "tonal.key_edma.scale", "") or ""
            key_strength = AnalysisService._to_float(AnalysisService._pool_get(features, "tonal.key_edma.strength"), 0.0)
            danceability_raw = AnalysisService._to_float(AnalysisService._pool_get(features, "rhythm.danceability"), 0.0)
            loudness_ebu128 = AnalysisService._to_float(
                AnalysisService._pool_get(features, "lowlevel.loudness_ebu128.integrated"),
                0.0
            )
            bpm_peak_weight = AnalysisService._to_float(
                AnalysisService._pool_get(features, "rhythm.bpm_histogram_first_peak_weight"),
                0.0
            )

            # Essentia danceability is usually in ~0..3 range. Normalize to 0..1.
            danceability_norm = max(0.0, min(danceability_raw / 3.0, 1.0))

            result.update(
                {
                    "status": "ok",
                    "bpm": round(bpm, 3),
                    "bpm_peak_weight": round(bpm_peak_weight, 4),
                    "key": key,
                    "scale": scale,
                    "key_strength": round(key_strength, 4),
                    "danceability_raw": round(danceability_raw, 4),
                    "danceability_norm": round(danceability_norm, 4),
                    "loudness_ebu128": round(loudness_ebu128, 4),
                }
            )
            return result
        except Exception as e:
            result["status"] = "error"
            result["error"] = str(e)
            return result

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

            # Optional analyzers can be toggled with env vars:
            # ENABLE_ACOUSTID=false (default), ENABLE_ESSENTIA=false (default), ENABLE_CLAP=true (default)
            use_acoustid = AnalysisService._env_flag("ENABLE_ACOUSTID", False)
            use_essentia = AnalysisService._env_flag("ENABLE_ESSENTIA", False)
            use_clap = AnalysisService._env_flag("ENABLE_CLAP", True)

            # --- 1A. AUDIO IDENTITY CONFIDENCE (Chromaprint + AcoustID) ---
            if use_acoustid:
                acoustid_result = AnalysisService._run_acoustid_lookup(track.filepath)
            else:
                acoustid_result = {
                    "enabled": False,
                    "status": "disabled",
                    "api_key_configured": False,
                    "fingerprint_generated": False,
                    "best_score": 0.0,
                    "matches": []
                }

            # --- 1B. ESSENTIA FEATURE EXTRACTION ---
            if use_essentia:
                essentia_result = AnalysisService._run_essentia_analysis(track.filepath)
            else:
                essentia_result = {
                    "enabled": False,
                    "status": "disabled"
                }
            
            # BPM & Key
            onset_env = librosa.onset.onset_strength(y=y, sr=sr)
            tempo, _ = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
            bpm = float(np.atleast_1d(tempo)[0])
            
            chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
            key_idx = np.argmax(np.mean(chroma, axis=1))
            keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
            detected_key = keys[key_idx]
            detected_scale = "Major"
            bpm_confidence = 0.9

            # Prefer Essentia rhythm/tonal descriptors when available; fuse with librosa tempo.
            if essentia_result.get("status") == "ok":
                essentia_bpm = AnalysisService._to_float(essentia_result.get("bpm"), 0.0)
                if essentia_bpm > 0:
                    bpm_gap = abs(essentia_bpm - bpm)
                    bpm_agreement = max(0.0, 1.0 - min(bpm_gap / 30.0, 1.0))
                    bpm = (0.65 * essentia_bpm) + (0.35 * bpm)
                    bpm_confidence = max(0.55, min(0.99, 0.55 + 0.40 * bpm_agreement))

                if essentia_result.get("key"):
                    detected_key = str(essentia_result["key"])
                if essentia_result.get("scale"):
                    detected_scale = str(essentia_result["scale"]).capitalize()
            
            # Spectral/Dynamics (Librosa - Keep basic stats but replace Energy/Dance for final output)
            spectral_centroid = librosa.feature.spectral_centroid(y=y, sr=sr)[0]
            brightness = float(np.mean(spectral_centroid))
            
            # --- 2. CLAP ZERO-SHOT CLASSIFICATION ---
            clap_genres = []
            clap_moods = []
            clap_instruments = {}
            
            # Cap CLAP input duration so long tracks do not stall inference.
            clap_max_seconds = int(os.getenv("CLAP_MAX_SECONDS", "60"))
            max_samples = sr * max(15, clap_max_seconds)
            y_for_clap = y[:max_samples]

            model, processor = AnalysisService.get_clap_model() if use_clap else (None, None)
            
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
                    inputs = processor(text=all_texts, audio=y_for_clap, return_tensors="pt", sampling_rate=sr, padding=True)
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
                    inputs_m = processor(text=mood_texts, audio=y_for_clap, return_tensors="pt", sampling_rate=sr, padding=True)
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
                    inputs_i = processor(text=inst_texts, audio=y_for_clap, return_tensors="pt", sampling_rate=sr, padding=True)
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
                    inputs_met = processor(text=metric_prompts, audio=y_for_clap, return_tensors="pt", sampling_rate=sr, padding=True)
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

            # Fuse CLAP danceability with normalized Essentia danceability when available.
            if essentia_result.get("status") == "ok" and essentia_result.get("danceability_norm") is not None:
                essentia_dance = AnalysisService._to_float(essentia_result.get("danceability_norm"), final_dance)
                final_dance = (0.6 * final_dance) + (0.4 * essentia_dance)
                final_dance = max(0.0, min(final_dance, 1.0))

            # 3. CONSTRUCT RESULT
            # User requested removal of valence, brightness, warmth, tension.
            model_tags = {
                "energy": round(final_energy * 10, 1), 
                "danceability": round(final_dance, 2),
                "instruments": clap_instruments,
                "ai_moods": {m: 0.9 for m in clap_moods},
                "acoustid": acoustid_result,
                "essentia": essentia_result
            }

            analysis = AnalysisResult(
                bpm=bpm,
                bpm_confidence=round(float(bpm_confidence), 3),
                key_key=detected_key,
                key_scale=detected_scale,
                energy=min(final_energy * 10, 10.0),
                danceability=min(final_dance, 1.0),
                loudness=AnalysisService._to_float(essentia_result.get("loudness_ebu128"), 0.0),
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
    

