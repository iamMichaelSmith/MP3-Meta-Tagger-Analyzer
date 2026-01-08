from fastapi import APIRouter, UploadFile, File, HTTPException, BackgroundTasks
from typing import List
from app.models.schemas import Track, TrackListResponse, UserEdits
from app.services.storage import StorageService
# We will import analysis service later
# from app.services.analysis import AnalysisService

router = APIRouter()

@router.post("/upload", response_model=Track)
async def upload_file(background_tasks: BackgroundTasks, file: UploadFile = File(...)):
    # Validate extension
    if not file.filename.lower().endswith('.mp3'):
        raise HTTPException(status_code=400, detail="Only MP3 files are allowed")
    
    track = await StorageService.save_upload(file)
    
    # Trigger analysis in background
    background_tasks.add_task(run_analysis_task, track.id)
    
    return track

async def run_analysis_task(track_id: str):
    try:
        print(f"[ANALYSIS] Starting analysis for track {track_id}")
        from app.services.analysis import AnalysisService
        track = StorageService.get_track(track_id)
        if track:
            track.status = "analyzing"
            StorageService.save_track(track)
            print(f"[ANALYSIS] Track status set to 'analyzing'")
            
            # Run analysis
            await AnalysisService.analyze_track(track)
            print(f"[ANALYSIS] Analysis complete for {track.filename}")
            StorageService.save_track(track)
            print(f"[ANALYSIS] Track saved with status: {track.status}")
        else:
            print(f"[ANALYSIS ERROR] Track {track_id} not found")
    except Exception as e:
        print(f"[ANALYSIS ERROR] Failed to analyze track {track_id}: {e}")
        import traceback
        traceback.print_exc()



@router.get("/tracks", response_model=TrackListResponse)
def get_tracks():
    tracks = StorageService.list_tracks()
    return {"tracks": tracks}

@router.get("/tracks/{track_id}", response_model=Track)
def get_track(track_id: str):
    track = StorageService.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    return track

@router.put("/tracks/{track_id}/edits", response_model=Track)
def update_edits(track_id: str, edits: UserEdits):
    track = StorageService.get_track(track_id)
    if not track:
        raise HTTPException(status_code=404, detail="Track not found")
    
    track.edits = edits
    
    # Update final display values based on edits or raw analysis?
    # Logic: final = edit if present else analysis
    if edits.bpm:
        track.final_bpm = edits.bpm
    if edits.key:
        track.final_key = edits.key
        
    StorageService.save_track(track)
    return track

@router.get("/export/csv")
def export_csv(track_ids: str):
    import csv
    import io
    from fastapi.responses import StreamingResponse
    
    ids = track_ids.split(',')
    
    # Create CSV in memory
    output = io.StringIO()
    writer = csv.writer(output)
    
    # Headers
    writer.writerow(['Filename', 'BPM', 'Key', 'Genres', 'Moods', 'Styles', 'Notes'])
    
    for tid in ids:
        track = StorageService.get_track(tid)
        if track:
            # Determine values (User edits > Analysis > Default)
            bpm = track.final_bpm or (track.edits.bpm if track.edits else 0)
            key = track.final_key or (track.edits.key if track.edits else "")
            
            genres = (track.edits.genres if track.edits and track.edits.genres else track.suggested_genres) or []
            moods = (track.edits.moods if track.edits and track.edits.moods else track.suggested_moods) or []
            styles = (track.edits.styles if track.edits and track.edits.styles else track.suggested_styles) or []
            notes = track.edits.notes if track.edits else ""
            
            writer.writerow([
                track.filename,
                round(bpm),
                key,
                ", ".join(genres),
                ", ".join(moods),
                ", ".join(styles),
                notes
            ])
            
    output.seek(0)
    
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=export.csv"
    return response

