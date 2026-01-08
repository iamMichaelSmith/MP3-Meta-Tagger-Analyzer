import os
import json
import shutil
from pathlib import Path
from typing import List, Optional
from fastapi import UploadFile
from app.models.schemas import Track, AnalysisResult

# Define paths
BASE_DIR = Path(__file__).resolve().parent.parent.parent
UPLOAD_DIR = BASE_DIR / "data" / "uploads"
RESULTS_DIR = BASE_DIR / "data" / "results"

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

class StorageService:
    @staticmethod
    async def save_upload(file: UploadFile) -> Track:
        # Create track object to generate ID
        # Initialize with dummy filepath, will update after save
        track = Track(filename=file.filename, filepath="")
        
        # Define paths
        file_ext = os.path.splitext(file.filename)[1]
        safe_filename = f"{track.id}{file_ext}"
        file_path = UPLOAD_DIR / safe_filename
        
        # Save file
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        track.filepath = str(file_path)
        track.status = "queued"
        
        # Save initial JSON record
        StorageService.save_track(track)
        
        return track

    @staticmethod
    def save_track(track: Track):
        json_path = RESULTS_DIR / f"{track.id}.json"
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(track.model_dump_json(indent=2))

    @staticmethod
    def get_track(track_id: str) -> Optional[Track]:
        json_path = RESULTS_DIR / f"{track_id}.json"
        if not json_path.exists():
            return None
        try:
            with open(json_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return Track(**data)
        except Exception:
            return None

    @staticmethod
    def list_tracks() -> List[Track]:
        tracks = []
        for file in os.listdir(RESULTS_DIR):
            if file.endswith(".json"):
                track_id = file.replace(".json", "")
                track = StorageService.get_track(track_id)
                if track:
                    tracks.append(track)
        # Sort by upload date desc
        tracks.sort(key=lambda x: x.upload_date, reverse=True)
        return tracks

    @staticmethod
    def update_track_status(track_id: str, status: str):
        track = StorageService.get_track(track_id)
        if track:
            track.status = status
            StorageService.save_track(track)
