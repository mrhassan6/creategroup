@echo off
title WhatsApp GC Agent Launcher
echo ====================================================
echo       WhatsApp Group Creation Agent Launcher
echo ====================================================
set "PATH=C:\Program Files\nodejs;%PATH%"

echo Starting Backend Server (Port 3001)...
start /B "GC Agent Server" cmd /c "cd server && npm start"

timeout /t 2 /nobreak >nul

echo Starting Client UI (Port 5173)...
start /B "GC Agent Client" cmd /c "cd client && npm run dev"

echo.
echo Both services are now running in this single window!
echo Open your browser or phone at: http://localhost:5173
echo ====================================================
echo Keep this window open. Close it to stop the server.
pause
