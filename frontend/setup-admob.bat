@echo off
echo ========================================
echo HeartLink AdMob Setup Script
echo ========================================
echo.

echo Step 1: Installing AdMob plugin...
call npm install @capacitor-community/admob
if %errorlevel% neq 0 (
    echo ERROR: Failed to install AdMob plugin
    pause
    exit /b 1
)
echo SUCCESS: AdMob plugin installed
echo.

echo Step 2: Building React app...
call npm run build
if %errorlevel% neq 0 (
    echo ERROR: Build failed
    pause
    exit /b 1
)
echo SUCCESS: React app built
echo.

echo Step 3: Syncing with Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo ERROR: Capacitor sync failed
    pause
    exit /b 1
)
echo SUCCESS: Android synced
echo.

echo Step 4: Opening Android Studio...
call npx cap open android
echo.

echo ========================================
echo Setup Complete!
echo ========================================
echo.
echo Next steps in Android Studio:
echo 1. File - Sync Project with Gradle Files
echo 2. Build - Clean Project
echo 3. Build - Rebuild Project
echo 4. Build - Build APK
echo.
pause
