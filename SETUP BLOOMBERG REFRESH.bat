@echo off
setlocal enabledelayedexpansion
REM Run this ONCE on the Bloomberg PC. It sets up the "Refresh from Bloomberg"
REM button: saves your key, installs the Python bits, and schedules the watcher
REM to check every 1 minute (via Windows Task Scheduler, no window).
cd /d "%~dp0"

echo.
echo ==================================================
echo   Invest-Pack — Bloomberg Refresh setup
echo ==================================================
echo.

if not exist "watcher\.env" (
  echo   Paste your Supabase SECRET key ^(Settings - API Keys - Secret keys - reveal^).
  echo.
  set /p "KEY=SECRET key: "
  > "watcher\.env" echo SUPABASE_URL=https://knciqlbngtmsgmhnbfce.supabase.co
  >> "watcher\.env" echo SUPABASE_KEY=!KEY!
  echo   Saved to watcher\.env ^(stays on this PC^).
) else (
  echo   watcher\.env already exists — leaving it as is.
)

echo.
echo   Installing Python packages ^(supabase, python-dotenv^)...
py -m pip install --quiet supabase python-dotenv
echo   NOTE: blpapi must already be installed ^(it is, since Fixed Income runs here^).

for /f "delims=" %%i in ('py -c "import sys,os;print(os.path.join(os.path.dirname(sys.executable),'pythonw.exe'))"') do set "PYW=%%i"
set "SCRIPT=%~dp0watcher\watch_and_run.py"

echo.
echo   Scheduling the watcher to run every 1 minute...
schtasks /create /tn "InvestPackRefresh" /tr "\"!PYW!\" \"!SCRIPT!\"" /sc minute /mo 1 /f
echo.
echo ==================================================
echo   Done. Clicking "Refresh from Bloomberg" in the
echo   dashboard will now update the data within ~1-2 min.
echo   ^(To remove: schtasks /delete /tn InvestPackRefresh /f^)
echo ==================================================
echo.
pause
endlocal
