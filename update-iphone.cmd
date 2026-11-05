@echo off
chcp 65001 >nul
title Family Pocket - update iPhone (build + TestFlight)
cd /d "%~dp0"
echo.
echo ===== Family Pocket: new version to TestFlight (build + upload, about 10-15 minutes) =====
echo.

rem --- App Store Connect API key (the .p8 file stays on this computer) ---
set "EXPO_ASC_KEY_ID=NC6Z34ZZXM"
set "EXPO_ASC_ISSUER_ID=64236e9c-ffb7-43de-9c13-799cea194767"
set "EXPO_APPLE_TEAM_ID=2K94XDPAHM"
set "EXPO_APPLE_TEAM_TYPE=INDIVIDUAL"
set "EXPO_ASC_API_KEY_PATH="
for %%D in ("%USERPROFILE%\Downloads" "%USERPROFILE%\OneDrive\Downloads" "%USERPROFILE%\Desktop" "%~dp0" "%USERPROFILE%\Documents\tsaad-iski") do (
  if exist "%%~D\AuthKey_NC6Z34ZZXM.p8" set "EXPO_ASC_API_KEY_PATH=%%~D\AuthKey_NC6Z34ZZXM.p8"
)
if "%EXPO_ASC_API_KEY_PATH%"=="" (
  echo Could not find AuthKey_NC6Z34ZZXM.p8 in Downloads. Move it to the Downloads folder and run again.
  goto :fail
)
echo Using API key: %EXPO_ASC_API_KEY_PATH%

if not exist node_modules (
  echo.
  echo [1/5] Installing project packages ...
  call npm install --no-audit --no-fund
  if errorlevel 1 goto :fail
)

set EAS_NO_VCS=1
set "EAS_PROJECT_ROOT=%~dp0."
echo.
echo [2/5] Checking Expo login ...
call npx --yes eas-cli@latest whoami
if errorlevel 1 call npx --yes eas-cli@latest login
if errorlevel 1 goto :fail

findstr /c:"projectId" app.json >nul
if errorlevel 1 (
  echo.
  echo [3/5] Creating the Expo project - first time only ...
  call npx --yes eas-cli@latest init --non-interactive --force
  if errorlevel 1 goto :fail
)

echo.
echo [4/5] Building in the cloud and WAITING until it finishes (about 5-10 minutes). Do not close this window.
echo.
call npx --yes eas-cli@latest build -p ios --profile production --non-interactive
if errorlevel 1 goto :fail

findstr /c:"REPLACE_ASC_APP_ID" eas.json >nul
if not errorlevel 1 (
  echo.
  echo Build is ready. First time only: Claude still needs to create the app in App Store Connect.
  echo Tell Claude "build done", then run this file again - it will rebuild and upload.
  pause
  exit /b 0
)

echo.
echo [5/5] Uploading the new build to TestFlight ...
copy /y "%EXPO_ASC_API_KEY_PATH%" "%~dp0asc-key.p8" >nul
call npx --yes eas-cli@latest submit -p ios --profile production --latest --non-interactive > "%~dp0submit-log.txt" 2>&1
set "RC=%errorlevel%"
type "%~dp0submit-log.txt"
if not "%RC%"=="0" goto :fail

echo.
echo DONE! Apple processes it for 10-30 minutes, then it shows up in TestFlight. Tell Claude "uploaded".
pause
exit /b 0

:fail
echo.
echo Something failed. Take a screenshot of this window and send it to Claude.
pause
exit /b 1
