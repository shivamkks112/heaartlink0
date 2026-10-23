import { useState, useRef } from 'react';
import { Camera, Upload, Heart, X, Plus, Image as ImageIcon, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import axios from 'axios';
import { API } from '@/config/api';
import { useNavigate } from 'react-router-dom';
import { compressImage } from '@/utils/compressImage';
import { storage, ref, uploadBytes, getDownloadURL } from '@/firebase/config';

const MAX_PHOTOS = 3;

const MandatoryPhotoPage = ({ user, onComplete }) => {
  const [photos, setPhotos] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);
  const navigate = useNavigate();

  const isDark = document.documentElement.classList.contains('dark');

  const handleSelect = async (e) => {
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!picked.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (picked.size > 25 * 1024 * 1024) { toast.error('Image should be less than 25MB'); return; }
    const file = await compressImage(picked);
    if (photos.length >= MAX_PHOTOS) { toast.error(`Maximum ${MAX_PHOTOS} photos allowed`); return; }
    setPhotos(prev => [...prev, file]);
    setPreviews(prev => [...prev, URL.createObjectURL(file)]);
    e.target.value = '';
  };

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
    setPreviews(prev => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  };

  const handleUpload = async () => {
    if (photos.length === 0) return;
    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const photo of photos) {
        const formData = new FormData();
        formData.append('file', photo);
        formData.append('user_id', user.id);
        
        // Upload to Firebase Storage (same as Profile page); base64 only as last resort
        try {
          const storageRef = ref(storage, `profile_pictures/${user.id}/${Date.now()}_${photo.name}`);
          await uploadBytes(storageRef, photo);
          uploadedUrls.push(await getDownloadURL(storageRef));
        } catch {
          // Fallback: convert to base64 data URL
          const reader = new FileReader();
          const dataUrl = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(photo);
          });
          uploadedUrls.push(dataUrl);
        }
      }

      // Update profile
      const existingPhotos = user.photos || [];
      const allPhotos = [...uploadedUrls, ...existingPhotos].slice(0, MAX_PHOTOS);
      
      await axios.put(`${API}/profile/${user.id}`, {
        profile_picture: uploadedUrls[0],
        photos: allPhotos,
      });

      const updated = { ...user, profile_picture: uploadedUrls[0], photos: allPhotos, profile_incomplete: false };
      localStorage.setItem('user', JSON.stringify(updated));
      toast.success(`${uploadedUrls.length} photo${uploadedUrls.length > 1 ? 's' : ''} uploaded!`);
      onComplete(updated);
      navigate('/discover');
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleSkip = () => {
    toast.info('You can add photos later from your Profile');
    navigate('/discover');
  };

  return (
    <div className="min-h-screen flex flex-col" style={{ background: isDark ? 'var(--m3-surface, #1A1113)' : 'var(--m3-surface, #FFF0F3)' }}>
      <Toaster position="top-center" />
      <input type="file" accept="image/*" ref={fileRef} onChange={handleSelect} className="hidden" />

      {/* Header */}
      <div className="text-center px-6" style={{ paddingTop: 'calc(var(--safe-top, 20px) + 24px)' }}>
        <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)' }}>
          <Camera className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>
          Let's add your profile photo
        </h1>
        <p className="text-sm mb-1" style={{ color: 'var(--m3-on-surface-variant)' }}>
          You can add up to {MAX_PHOTOS} photos
        </p>
        <p className="text-xs" style={{ color: 'var(--m3-outline)' }}>
          Profiles with a real photo are easier to trust
        </p>
      </div>

      {/* Photo Grid */}
      <div className="flex-1 px-6 py-6">
        <div className="grid grid-cols-3 gap-3 max-w-sm mx-auto">
          {[0, 1, 2].map((index) => (
            <div key={index} className="relative aspect-[3/4] rounded-2xl overflow-hidden"
              style={{ 
                background: previews[index] ? 'none' : isDark ? 'var(--m3-surface-container-highest)' : 'var(--m3-surface-container)',
                border: previews[index] ? 'none' : `2px dashed ${index === 0 && photos.length === 0 ? '#ec4899' : 'var(--m3-outline-variant)'}`
              }}
            >
              {previews[index] ? (
                <>
                  <img src={previews[index]} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  <button
                    onClick={() => removePhoto(index)}
                    className="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                    data-testid={`remove-photo-${index}`}
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  <div className="absolute bottom-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {index === 0 ? 'Primary' : `${index + 1} of ${MAX_PHOTOS}`}
                  </div>
                </>
              ) : (
                <button
                  onClick={() => photos.length < MAX_PHOTOS && fileRef.current?.click()}
                  className="w-full h-full flex flex-col items-center justify-center gap-2"
                  disabled={photos.length >= MAX_PHOTOS}
                  data-testid={`add-photo-${index}`}
                >
                  {index === 0 && photos.length === 0 ? (
                    <>
                      <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, rgba(236,72,153,0.15), rgba(249,115,22,0.15))' }}>
                        <Camera className="w-6 h-6" style={{ color: '#ec4899' }} />
                      </div>
                      <span className="text-xs font-medium" style={{ color: '#ec4899' }}>Add Photo</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-6 h-6" style={{ color: 'var(--m3-outline-variant)' }} />
                      <span className="text-[10px]" style={{ color: 'var(--m3-outline)' }}>{index + 1} of {MAX_PHOTOS}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Counter */}
        <p className="text-center text-xs mt-4" style={{ color: 'var(--m3-on-surface-variant)' }}>
          {photos.length} of {MAX_PHOTOS} photos added
        </p>
      </div>

      {/* Bottom Actions */}
      <div className="px-6 pb-6 space-y-3" style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 16px), 24px)' }}>
        {photos.length > 0 && (
          <button
            onClick={handleUpload}
            disabled={uploading}
            className="w-full py-4 rounded-full font-semibold text-white text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
            data-testid="upload-photos-btn"
          >
            {uploading ? (
              <span className="animate-pulse">Uploading...</span>
            ) : (
              <>
                <Upload className="w-5 h-5" />
                Upload {photos.length} Photo{photos.length > 1 ? 's' : ''} & Continue
              </>
            )}
          </button>
        )}

        {photos.length === 0 && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-4 rounded-full font-semibold text-white text-base active:scale-[0.98] transition-all flex items-center justify-center gap-2"
            style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)', boxShadow: '0 4px 16px rgba(236,72,153,0.3)' }}
            data-testid="choose-photo-btn"
          >
            <Camera className="w-5 h-5" />
            Choose Your Photo
          </button>
        )}

        <button
          onClick={handleSkip}
          className="w-full py-3 rounded-full font-medium text-sm flex items-center justify-center gap-1"
          style={{ color: 'var(--m3-outline)' }}
          data-testid="skip-photos-btn"
        >
          Skip for now <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default MandatoryPhotoPage;
