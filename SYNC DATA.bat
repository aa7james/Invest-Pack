@echo off
setlocal
REM Double-click to sync ONLY changed/new data from the Excel into Supabase.
cd /d "%~dp0"
set "SUPABASE_URL=https://knciqlbngtmsgmhnbfce.supabase.co"
echo.
echo ============================================
echo   Sync changed data into Supabase
echo   (uploads only what changed - fast)
echo ============================================
echo.
echo   Get your SECRET key: Supabase - Settings - API Keys - Secret keys - reveal
echo.
set /p "SUPABASE_SECRET_KEY=Paste your Supabase SECRET key, then press Enter: "
echo.
echo Comparing Excel to database...
echo.
py "watcher\sync_history.py"
echo.
echo ============================================
echo   Finished. You can close this window.
echo ============================================
echo.
pause
endlocal
