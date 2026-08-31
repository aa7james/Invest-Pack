@echo off
REM Double-click ONCE to make the data watcher start automatically at login.
cd /d "%~dp0"
py "watcher\add_to_startup.py"
