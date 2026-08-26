@echo off
REM Double-click this file to save ALL changes and upload the code to GitHub.
REM If a GitHub sign-in window pops up, just sign in and it will continue.
cd /d "%~dp0"
echo.
echo ============================================
echo   Saving and uploading Invest-Pack...
echo ============================================
echo.

REM Stage everything, then commit only if there is something new.
git add -A
git diff --cached --quiet
if errorlevel 1 (
  git commit -m "Update from %DATE% %TIME%"
) else (
  echo Nothing new to save - pushing any existing commits.
)

echo.
git push -u origin main
echo.
echo ============================================
echo   Done. If you see "main -^> main" above, it worked.
echo   You can close this window.
echo ============================================
echo.
pause
