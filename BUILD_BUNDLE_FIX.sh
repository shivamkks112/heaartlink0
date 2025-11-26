#!/bin/bash

echo "🔧 HeartLink Bundle Size Fix Script"
echo "===================================="

cd /app/frontend/android

echo ""
echo "Step 1: Cleaning project..."
./gradlew clean

echo ""
echo "Step 2: Removing Gradle caches..."
rm -rf .gradle
rm -rf app/.gradle
rm -rf app/build
rm -rf ~/.gradle/caches

echo ""
echo "Step 3: Syncing Capacitor..."
cd /app/frontend
npx cap sync android

echo ""
echo "Step 4: Building Release Bundle..."
cd /app/frontend/android
./gradlew bundleRelease --refresh-dependencies --no-daemon --info 2>&1 | tee build.log

echo ""
echo "Step 5: Checking bundle size..."
if [ -f "app/build/outputs/bundle/release/app-release.aab" ]; then
    SIZE=$(du -h app/build/outputs/bundle/release/app-release.aab | cut -f1)
    echo "✅ Bundle created: $SIZE"
    echo "📍 Location: android/app/build/outputs/bundle/release/app-release.aab"
    
    if [[ "$SIZE" == *"M"* ]]; then
        SIZE_NUM=$(echo $SIZE | sed 's/M//')
        if (( $(echo "$SIZE_NUM < 10" | bc -l) )); then
            echo "⚠️  WARNING: Bundle size is only $SIZE"
            echo "Expected: 20-25 MB"
            echo "Issue: Firebase dependencies may not be included"
        else
            echo "✅ Bundle size looks good!"
        fi
    fi
else
    echo "❌ Bundle creation failed!"
    echo "Check build.log for errors"
fi

echo ""
echo "Done! Check the bundle size above."
