// Shrinks phone camera photos (often 5-12MB) to a ~200-400KB JPEG before upload.
export const compressImage = (file, maxSide = 1280, quality = 0.85) => new Promise((resolve) => {
  if (!file || !file.type?.startsWith('image/')) return resolve(file);
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.onload = () => {
    const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    canvas.toBlob((blob) => {
      if (!blob) return resolve(file);
      resolve(new File([blob], (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }));
    }, 'image/jpeg', quality);
  };
  img.onerror = () => { URL.revokeObjectURL(url); resolve(file); };
  img.src = url;
});
