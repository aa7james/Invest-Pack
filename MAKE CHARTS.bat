@echo off
REM Double-click to create all 50 investment-pack charts in Supabase.
REM (Uses the public key only - no secret needed.)
cd /d "%~dp0"
echo.
echo ============================================
echo   Building the investment pack charts...
echo ============================================
echo.
py "supabase\make_charts.py"
echo.
echo ============================================
echo   Done. You can close this window.
echo ============================================
echo.
pause
