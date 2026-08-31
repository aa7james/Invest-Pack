@echo off
setlocal enabledelayedexpansion
REM Double-click to run the data watcher now (leave the window open).
REM It syncs when you save the Bloomberg Excel or click "Refresh from Bloomberg".
cd /d "%~dp0"

if not exist "watcher\.env" (
  echo.
  echo   First-time setup — I just need your Supabase SECRET key once.
  echo   Get it: Supabase - Settings - API Keys - Secret keys - reveal
  echo.
  set /p "KEY=Paste your Supabase SECRET key, then press Enter: "
  > "watcher\.env" echo SUPABASE_URL=https://knciqlbngtmsgmhnbfce.supabase.co
  >> "watcher\.env" echo SUPABASE_SECRET_KEY=!KEY!
  echo   Saved. You won't be asked again.
)

echo.
echo Making sure openpyxl is installed...
py -m pip install --quiet openpyxl 2>nul
echo.
echo ==================================================
echo   Invest-Pack Data Watcher — leave this open.
echo   (Press Ctrl+C to stop.)
echo ==================================================
echo.
py "watcher\watch_and_run.py"
echo.
echo Watcher stopped. You can close this window.
pause
endlocal
