#!/bin/bash

# GGE BOT - Linux/macOS Installation Setup
echo "==================================================="
echo "             GGE BOT Installation Setup            "
echo "==================================================="
echo

# Step 1: Check Node.js installation
if ! command -v node &> /dev/null; then
    echo -e "\033[0;31m[ERROR] Node.js is not detected on your system!\033[0m"
    echo
    echo "Node.js is required to run the bot."
    echo "Please download and install it from:"
    echo "https://nodejs.org/en/download/current"
    echo
    # Attempt to open browser based on OS
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "https://nodejs.org/en/download/current"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        if command -v xdg-open &> /dev/null; then
            xdg-open "https://nodejs.org/en/download/current"
        fi
    fi
    exit 1
fi

echo "[1/4] Node.js detected: $(node -v)"
echo

# Step 2: Check and rename manually downloaded folders if addons-extra doesn't exist
if [ ! -d "addons-extra" ]; then
    if [ -d "ggebot-addons-extrea" ]; then
        echo "[INFO] Found manually downloaded folder 'ggebot-addons-extrea'. Renaming to 'addons-extra'..."
        mv ggebot-addons-extrea addons-extra
    elif [ -d "ggebot-addons-extrea-main" ]; then
        echo "[INFO] Found manually downloaded folder 'ggebot-addons-extrea-main'. Renaming to 'addons-extra'..."
        mv ggebot-addons-extrea-main addons-extra
    elif [ -d "ggebot-addons-extra" ]; then
        echo "[INFO] Found manually downloaded folder 'ggebot-addons-extra'. Renaming to 'addons-extra'..."
        mv ggebot-addons-extra addons-extra
    elif [ -d "ggebot-addons-extra-main" ]; then
        echo "[INFO] Found manually downloaded folder 'ggebot-addons-extra-main'. Renaming to 'addons-extra'..."
        mv ggebot-addons-extra-main addons-extra
    fi
fi

# Step 3: Check Git and download/update addons-extra
if command -v git &> /dev/null; then
    if [ ! -d "addons-extra" ]; then
        echo "[2/4] Git detected. Cloning addons-extra repository..."
        git clone https://github.com/Alshrief/ggebot-addons-extrea.git addons-extra
    else
        if [ -d "addons-extra/.git" ]; then
            echo "[2/4] Git detected. addons-extra already exists. Pulling latest updates..."
            cd addons-extra
            git pull origin main
            cd ..
        else
            echo "[2/4] Git detected. addons-extra exists (manually downloaded). Skipping pull updates."
        fi
    fi
else
    echo "[2/4] Git not detected. Skipping addons-extra clone."
fi
echo

# Step 3: Install root dependencies
echo "[3/4] Installing core dependencies (this may take a minute)..."
npm install
if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Failed to install core dependencies.\033[0m"
    exit 1
fi
echo

# Step 4: Install and build website dependencies
echo "[4/4] Installing and building dashboard website..."
cd website
npm install
if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Failed to install website dependencies.\033[0m"
    cd ..
    exit 1
fi

echo "Building dashboard..."
npm run build
if [ $? -ne 0 ]; then
    echo -e "\033[0;31m[ERROR] Failed to build website assets.\033[0m"
    cd ..
    exit 1
fi
cd ..
echo

echo "==================================================="
echo "  Installation completed successfully!"
echo "  You can now start the bot using './start_bot.sh'."
echo "==================================================="
echo
