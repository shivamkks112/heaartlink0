
HeartLink PWA & Play packaging files (BRIGHT DIAGONAL GRADIENT ICONS)
Files included:
- manifest.json
- icons/icon-192.png
- icons/icon-512.png
- screenshots/*.png
- .well-known/assetlinks.json
- privacy.html
- README.txt

Upload instructions for Emergent:
1. Login to Emergent dashboard -> open your app project.
2. Go to Files / Public folder and upload the contents of this ZIP into the root of your site.
   - Create a folder named ".well-known" (include the dot) and upload assetlinks.json inside it.
   - Place manifest.json at site root.
   - Place icons in /icons and screenshots in /screenshots (or at root if your site serves them).
   - Upload privacy.html and link it from your app or Play Console listing.
3. Deploy/publish the site.
4. Verify these URLs open:
   - https://heartlink.co.in/manifest.json
   - https://heartlink.co.in/icons/icon-192.png
   - https://heartlink.co.in/.well-known/assetlinks.json
   - https://heartlink.co.in/privacy.html
5. Go to https://pwabuilder.com, paste https://heartlink.co.in and run Analyze -> Package for Google Play.

Notes:
- Replace placeholder screenshots with real app screenshots for better Play listing.
- If PWABuilder still errors, clear cache or try in incognito and retry packaging.
