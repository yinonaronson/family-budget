@echo off
chcp 65001 >nul
title family-pocket - Google Play build (AAB)
cd /d "%~dp0"
echo.
echo ===== family-pocket: Google Play version (.aab, about 10-15 minutes) =====
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo Installing Node.js ...
  winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
  set "PATH=%PATH%;C:\Program Files\nodejs"
)

git pull -q 2>nul
if not exist node_modules (
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
echo Building in the cloud. If EAS asks to create an Android keystore - answer Y (yes).
echo.
call npx --yes eas-cli@latest build -p android --profile production
if errorlevel 1 goto :fail

if exist "%~dp0play-service-account.json" (
  echo.
  echo Uploading to Google Play - internal testing ...
  call npx --yes eas-cli@latest submit -p android --profile production --latest --non-interactive
  if errorlevel 1 goto :fail
  echo DONE! The new version is in Google Play Console - Testing - Internal testing.
) else (
  echo.
  echo DONE! Download the .aab from the link above.
  echo The first upload to Google Play is manual: tell Claude "the aab is ready" and we will upload it together.
)
pause
exit /b 0

:fail
echo.
echo Something failed. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
