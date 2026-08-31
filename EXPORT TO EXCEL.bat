@echo off
REM Double-click to export all the dashboard data to an Excel file
REM (saved in this folder as "Invest-Pack Data Export <date>.xlsx").
cd /d "%~dp0"
echo.
echo Exporting Supabase data to Excel...
echo.
py -m pip install --quiet openpyxl 2>nul
py "supabase\export_pack.py"
echo.
pause
