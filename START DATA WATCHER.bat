@echo off
setlocal
REM Double-click ONCE and leave this window open. It watches for the
REM "Refresh from Bloomberg" button and updates the data when you click it.
cd /d "%~dp0"
set "SUPABASE_URL=https://knciqlbngtmsgmhnbfce.supabase.co"
echo.
echo ==================================================
echo   Bloomberg Data Watcher
echo   Leave this window OPEN. Clicking "Refresh from
echo   Bloomberg" in the dashboard will now update data.
echo ==================================================
echo.
echo   Get your SECRET key: Supabase - Settings - API Keys - Secret keys - reveal
echo.
set /p "SUPABASE_SECRET_KEY=Paste your Supabase SECRET key, then press Enter: "
echo.
echo Making sure Excel automation is available...
py -m pip install --quiet pywin32 openpyxl 2>nul
echo.
echo Watcher starting. Keep this window open...
echo (Press Ctrl+C to stop.)
echo.
py "watcher\watch_and_run.py"
echo.
echo Watcher stopped. You can close this window.
pause
endlocal
