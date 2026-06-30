@echo off
title GGE BOT - Installation Setup
color 0B

echo ===================================================
echo             GGE BOT Installation Setup            
echo ===================================================
echo.
echo [IMPORTANT] This script will perform a first-time installation of GGE BOT dependencies.
echo.

:: Step 1: Check Node.js installation
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

echo [1/4] Node.js detected.
echo.

:: Step 2: Check and rename manually downloaded folders if addons-extra doesn't exist
if not exist addons-extra (
    if exist ggebot-addons-extrea (
        echo [INFO] Found manually downloaded folder 'ggebot-addons-extrea'. Renaming to 'addons-extra'...
        ren ggebot-addons-extrea addons-extra
    ) else if exist ggebot-addons-extrea-main (
        echo [INFO] Found manually downloaded folder 'ggebot-addons-extrea-main'. Renaming to 'addons-extra'...
        ren ggebot-addons-extrea-main addons-extra
    ) else if exist ggebot-addons-extra (
        echo [INFO] Found manually downloaded folder 'ggebot-addons-extra'. Renaming to 'addons-extra'...
        ren ggebot-addons-extra addons-extra
    ) else if exist ggebot-addons-extra-main (
        echo [INFO] Found manually downloaded folder 'ggebot-addons-extra-main'. Renaming to 'addons-extra'...
        ren ggebot-addons-extra-main addons-extra
    )
)

:: Step 3: Check Git and download/update addons-extra
where git >nul 2>nul
if %errorlevel% equ 0 (
    if not exist addons-extra (
        echo [2/4] Git detected. Cloning addons-extra repository...
        git clone https://github.com/Alshrief/ggebot-addons-extrea.git addons-extra
    ) else (
        if exist addons-extra\.git (
            echo [2/4] Git detected. addons-extra already exists. Pulling latest updates...
            cd addons-extra
            git pull origin main
            cd ..
        ) else (
            echo [2/4] Git detected. addons-extra exists (manually downloaded). Skipping pull updates.
        )
    )
) else (
    echo [2/4] Git not detected. Skipping addons-extra clone.
)
echo.

:: Step 3: Install root dependencies
echo [3/4] Installing core dependencies (this may take a minute)...
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to install core dependencies.
    pause
    exit /b
)
echo.

:: Step 4: Install and build website dependencies
echo [4/4] Installing and building dashboard website...
cd website
call npm install
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to install website dependencies.
    cd ..
    pause
    exit /b
)
echo Building dashboard...
call npm run build
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Failed to build website assets.
    cd ..
    pause
    exit /b
)
cd ..
echo.

color 0A
echo ===================================================
echo   Installation completed successfully!
echo   You can now start the bot using "start_bot.bat".
echo ===================================================
echo.
pause
