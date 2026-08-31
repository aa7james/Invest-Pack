@echo off
REM Double-click to export just the last 45 days to Excel (fast).
cd /d "%~dp0"
echo.
echo Exporting the last 45 days...
echo.
py -m pip install --quiet openpyxl 2>nul
py "supabase\export_pack.py" --days 45
echo.
pause
