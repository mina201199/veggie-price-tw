@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul
if not errorlevel 1 (
    py -3 "%~dp0start_app.py"
    goto finished
)
where python >nul 2>nul
if not errorlevel 1 (
    python "%~dp0start_app.py"
    goto finished
)
echo Python 3.10 or newer is required. Install Python from python.org.
echo Enable "Add Python to PATH" during installation, then try again.
:finished
echo.
echo The app server has stopped or could not start. See the message above.
pause
