@echo off
chcp 65001 >nul
title family-pocket - Android test build (APK)
cd /d "%~dp0"
echo.
echo ===== family-pocket: Android test version (APK you can install directly, about 10-15 minutes) =====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Installing Node.js ...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;C:\Program Files\nodejs"
)

echo [1/3] Getting the latest code ...
git pull -q 2>nul

if not exist node_modules (
  echo [2/3] Installing project packages ...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)

if not exist "%~dp0google-services.json" (
  echo NOTE: google-services.json is missing - the app will work, but family push notifications will not on Android.
  echo       Ask Claude to set up Firebase, then run this again.
  echo.
)
set EAS_NO_VCS=1
call npx --yes eas-cli@latest whoami >nul 2>nul
if errorlevel 1 call npx --yes eas-cli@latest login
if errorlevel 1 goto :fail

echo.
echo [3/3] Building in the cloud. The FIRST time EAS asks to create an Android keystore - answer Y (yes).
echo.
call npx --yes eas-cli@latest build -p android --profile preview
if errorlevel 1 goto :fail

echo.
echo DONE! Above there is a link / QR code. Open it on an Android phone and install the APK.
echo (Android may ask to allow installing from this source - allow it.)
pause
exit /b 0

:fail
echo.
echo Something failed. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
