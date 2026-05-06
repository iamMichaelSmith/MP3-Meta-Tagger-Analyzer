@echo off
echo Starting MP3 Meta Tagger Analyzer...
echo.

rem Convert to short path to avoid issues with special characters like ^& in folder names
for %%I in ("%~dp0.") do set "SAFE_DIR=%%~sI"

start "Backend Server" cmd /k "%SAFE_DIR%\start_backend.bat"
start "Frontend Client" cmd /k "%SAFE_DIR%\start_frontend.bat"

echo Services started!
echo Backend: http://localhost:8001
echo Frontend: http://localhost:5173
echo.
echo Close this window anytime - the servers will keep running.
echo To stop the servers, close their individual windows.
pause
