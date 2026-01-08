@echo off
echo Starting MP3 Meta Tagger Analyzer...

cd backend
start "Backend Server" cmd /k "venv\Scripts\activate && uvicorn app.main:app --reload --port 8000"
cd ..

cd ui
start "Frontend Client" cmd /k "npm run dev"
cd ..

echo Services started!
echo Backend: http://localhost:8000
echo Frontend: http://localhost:5173
pause
