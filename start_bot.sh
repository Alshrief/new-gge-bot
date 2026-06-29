#!/bin/bash

# GGE BOT - Linux/macOS Startup
echo "==================================================="
echo "               GGE BOT Starting...                  "
echo "==================================================="
echo

# Check Node.js installation
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

echo "Starting main application..."
node main.js
if [ $? -ne 0 ]; then
    echo
    echo -e "\033[0;31m[ERROR] Bot exited with an error or was stopped.\033[0m"
    exit 1
fi
