@echo off
REM Double-click this file to upload the code to GitHub.
REM If a GitHub sign-in window pops up, just sign in and it will continue.
cd /d "%~dp0"
echo.
echo ============================================
echo   Uploading Invest-Pack to GitHub...
echo ============================================
echo.
git push -u origin main
echo.
echo ============================================
echo   Done. If you see "main -^> main" above, it worked.
echo   You can close this window.
echo ============================================
echo.
pause
