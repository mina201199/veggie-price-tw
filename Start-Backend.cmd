@echo off
setlocal
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo First install Python 3.10 or newer, then run: python setup_backend.py
  pause
  exit /b 1
)
".venv\Scripts\python.exe" "start_backend.py" --lan %*
if errorlevel 1 pause
