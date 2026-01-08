from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field
from uuid import UUID, uuid4
from datetime import datetime

class AnalysisResult(BaseModel):
    # Essentia fields
    bpm: float = 0.0
    bpm_confidence: float = 0.0
    key_key: str = ""  # e.g. "C"
    key_scale: str = "" # e.g. "major"
    loudness: float = 0.0
    energy: float = 0.0
    danceability: float = 0.0
    
    # Musicnn / Raw tags
    model_tags: Dict[str, Any] = {} # e.g. {"rock": 0.9, "happy": 0.5, "instruments": {...}}

class UserEdits(BaseModel):
    bpm: Optional[float] = None
    key: Optional[str] = None
    genres: List[str] = []
    moods: List[str] = []
    styles: List[str] = []
    notes: str = ""

class Track(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid4()))
    filename: str
    filepath: str
    upload_date: datetime = Field(default_factory=datetime.now)
    duration: float = 0.0
    status: str = "queued" # queued, analyzing, complete, failed, error
    
    analysis: Optional[AnalysisResult] = None
    
    # Mapped tags (The suggested generic ones)
    suggested_genres: List[str] = []
    suggested_moods: List[str] = []
    
    # Final User edits (Source of truth for export)
    edits: UserEdits = Field(default_factory=UserEdits)
    
    # Cached display values (merged/mapped)
    final_bpm: float = 0.0
    final_key: str = ""
    
class TrackListResponse(BaseModel):
    tracks: List[Track]

class TrackExport(BaseModel):
    filename: str
    bpm: float
    key: str
    genres: str
    moods: str
    styles: str
    description: str # Keywords/Notes
