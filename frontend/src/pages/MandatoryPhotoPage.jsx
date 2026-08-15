import { useState, useRef } from 'react';
import { Camera, Upload, Heart } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import axios from 'axios';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { API } from '@/config/api';

const MandatoryPhotoPage = ({ user, onComplete }) => {
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const isDark = document.documentElement.classList.contains('dark');
  const bg = isDark ? '#1A1113' : '#FFF0F3';

  const handleSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Image should be less than 5MB'); return; }
    setPhoto(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!photo || !user?.id) return;
    setUploading(true);
    try {
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${user.id}/${Date.now()}_${photo.name}`);
      await uploadBytes(storageRef, photo);
      const url = await getDownloadURL(storageRef);

      // Update backend
      await axios.patch(`${API}/user/${user.id}`, {
        profile_picture: url,
        photos: [url, ...(user.photos || [])],
      });

      // Update local user
      const updated = { ...user, profile_picture: url, profile_incomplete: false };
      localStorage.setItem('user', JSON.stringify(updated));
      toast.success('Photo uploaded successfully!');
      onComplete(updated);
    } catch (err) {
      console.error('Upload failed:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <Toaster position="top-center" />
      <div className="w-full max-w-sm text-center m3-animate-in">
        {/* Logo */}
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-[20px] mb-6"
          style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }}>
          <Camera className="w-8 h-8 text-white" />
        </div>

        <h1 className="text-2xl font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>
          Add Your Profile Photo
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--m3-on-surface-variant)' }}>
          Profiles with photos get 10x more matches
        </p>

        {/* Photo area */}
        <div className="mb-6">
          {preview ? (
            <div className="relative w-40 h-40 mx-auto rounded-full overflow-hidden"
              style={{ boxShadow: '0 4px 20px rgba(214,51,108,0.3)', border: '3px solid var(--m3-primary)' }}>
              <img src={preview} alt="Preview" className="w-full h-full object-cover" />
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="w-40 h-40 mx-auto rounded-full flex flex-col items-center justify-center transition-all active:scale-95"
              style={{ background: 'var(--m3-surface-container-high)', border: '2px dashed var(--m3-outline-variant)' }}
              data-testid="photo-upload-area"
            >
              <Upload className="w-8 h-8 mb-2" style={{ color: 'var(--m3-outline)' }} />
              <span className="text-xs font-medium" style={{ color: 'var(--m3-on-surface-variant)' }}>Tap to upload</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} data-testid="photo-file-input" />
        </div>

        {/* Buttons */}
        {preview ? (
          <div className="space-y-3">
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="w-full py-3.5 rounded-full text-white font-semibold text-base transition-all active:scale-[0.97] disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 4px 16px rgba(214,51,108,0.35)' }}
              data-testid="continue-btn"
            >
              {uploading ? 'Uploading...' : 'Continue'}
            </button>
            <button
              onClick={() => { setPhoto(null); setPreview(''); }}
              className="text-sm font-medium"
              style={{ color: 'var(--m3-on-surface-variant)' }}
            >
              Change Photo
            </button>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full py-3.5 rounded-full text-white font-semibold text-base transition-all active:scale-[0.97]"
            style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 4px 16px rgba(214,51,108,0.35)' }}
            data-testid="upload-photo-btn"
          >
            Upload Profile Photo
          </button>
        )}

        <p className="text-[11px] mt-6" style={{ color: 'var(--m3-outline)' }}>
          Profile photo is required to use HeartLink
        </p>
      </div>
    </div>
  );
};

export default MandatoryPhotoPage;
