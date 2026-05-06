@echo off
title Backend Server - MP3 Meta Tagger

rem Convert to short path to avoid issues with ^& in folder names
for %%I in ("%~dp0.") do set "SAFE_DIR=%%~sI"

pushd "%SAFE_DIR%\backend"
echo Starting backend server...
echo Working directory: %CD%
echo.
echo Cleaning up existing listeners on port 8001...
for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":8001 .*LISTENING"') do (
    taskkill /PID %%P /F >nul 2>&1
)
echo.
"%SAFE_DIR%\backend\venv\Scripts\uvicorn.exe" app.main:app --port 8001
echo.
echo Backend server stopped. Press any key to close.
pause >nul
