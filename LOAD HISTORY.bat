@echo off
setlocal
REM Double-click to load all Excel history into Supabase (one-time).
cd /d "%~dp0"
set "SUPABASE_URL=https://knciqlbngtmsgmhnbfce.supabase.co"
echo.
echo ============================================
echo   Load Bloomberg history into Supabase
echo ============================================
echo.
echo   Get your SECRET key from:
echo   Supabase - Settings - API Keys - "Secret keys" - reveal - copy
echo.
set /p "SUPABASE_SECRET_KEY=Paste your Supabase SECRET key, then press Enter: "
echo.
echo Loading... (this takes a couple of minutes)
echo.
py "watcher\load_history.py"
echo.
echo ============================================
echo   Finished. You can close this window.
echo ============================================
echo.
pause
endlocal
