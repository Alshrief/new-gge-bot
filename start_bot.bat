@echo off
title GGE BOT - Startup
color 0B

echo ===================================================
echo               GGE BOT Starting...                  
echo ===================================================
echo.

:: Check Node.js installation
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not detected on your system!
    echo.
    echo Node.js is required to run the bot.
    echo Press any key to open the official Node.js download page...
    pause >nul
    start "" "https://nodejs.org/en/download/current"
    exit /b
)

echo Starting main application...
node main.js
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Bot exited with an error or was stopped.
    pause
)
