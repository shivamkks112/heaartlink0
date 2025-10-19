import { useState, useEffect } from 'react';
import axios from 'axios';
import { Camera, User, Heart, MapPin, Calendar, Briefcase, GraduationCap, Ruler, Dumbbell, Wine, Cigarette, CheckCircle, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-dating.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const ProfilePage = ({ user, onUpdate }) => {
  const [profile, setProfile] = useState(user);
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      setProfile(response.data);
      setFormData(response.data);
    } catch (error) {
      toast.error('Failed to load profile');
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const storageRef = ref(storage, `profile_pictures/${user.id}/${Date.now()}_${file.name}`);
      await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(storageRef);

      const response = await axios.put(`${API}/profile/${user.id}`, {
        profile_picture: downloadURL
      });

      setProfile(response.data);
      setFormData(response.data);
      onUpdate(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      toast.success('Profile picture updated!');
    } catch (error) {
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setHasChanges(true);
  };

  const handleSaveChanges = async () => {
    if (!hasChanges) {
      toast.info('No changes to save');
      return;
    }

    setLoading(true);
    try {
      // Only send changed fields
      const updates = {};
      Object.keys(formData).forEach(key => {
        if (formData[key] !== profile[key]) {
          updates[key] = formData[key];
        }
      });

      const response = await axios.put(`${API}/profile/${user.id}`, updates);
      
      setProfile(response.data);
      setFormData(response.data);
      onUpdate(response.data);
      localStorage.setItem('user', JSON.stringify(response.data));
      setHasChanges(false);
      toast.success('Profile updated successfully!');
    } catch (error) {
      toast.error('Failed to update profile. Please try again.');
      console.error('Profile update error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestVerification = async () => {
    if (profile.verified) {
      toast.info('Your profile is already verified!');
      return;
    }

    if (profile.verification_status === 'pending') {
      toast.info('Your verification request is pending review');
      return;
    }

    setVerifying(true);
    try {
      const response = await axios.post(`${API}/profile/${user.id}/verify`);
      
      // Update profile with verification status
      const updatedProfile = {
        ...profile,
        verification_status: response.data.status,
        verified: response.data.status === 'verified'
      };
      
      setProfile(updatedProfile);
      setFormData(updatedProfile);
      onUpdate(updatedProfile);
      localStorage.setItem('user', JSON.stringify(updatedProfile));
      
      if (response.data.status === 'verified') {
        toast.success('🎉 Profile verified successfully! You now have a green tick.');
      } else {
        toast.info('Verification request submitted for review');
      }
    } catch (error) {
      toast.error('Failed to request verification. Please try again.');
      console.error('Verification error:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav">
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-4xl mx-auto px-4 py-8 pb-24">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header with Profile Picture */}
          <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 px-8 py-12 text-white text-center relative">
            <div className="relative inline-block">
              <div className="w-32 h-32 rounded-full border-4 border-white overflow-hidden mx-auto shadow-2xl">
                {profile.profile_picture ? (
                  <img
                    src={profile.profile_picture}
                    alt={profile.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center">
                    <User className="w-16 h-16" />
                  </div>
                )}
              </div>
              <label
                htmlFor="profile-pic-upload"
                className="absolute bottom-0 right-0 bg-white text-pink-600 p-2 rounded-full cursor-pointer hover:bg-pink-50 transition-all shadow-lg transform hover:scale-110"
              >
                {uploading ? (
                  <div className="w-5 h-5 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  <Camera className="w-5 h-5" />
                )}
              </label>
              <input
                id="profile-pic-upload"
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>
            <h2 className="text-3xl font-bold mt-4">{profile.name}</h2>
            <p className="text-white/90 mt-2">{profile.email || profile.phone}</p>
            <div className="flex items-center justify-center gap-2 mt-4">
              {profile.verified && (
                <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                  <Heart className="w-4 h-4" fill="white" />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              )}
            </div>
          </div>

          {/* Profile Information */}
          <div className="px-8 py-8 space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-500" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-600">Age</label>
                  <input
                    type="number"
                    value={formData.age || ''}
                    onChange={(e) => handleFieldChange('age', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Enter your age"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Gender</label>
                  <select
                    value={formData.gender || ''}
                    onChange={(e) => handleFieldChange('gender', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pink-500" />
                Location
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleFieldChange('city', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="City"
                />
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleFieldChange('state', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  placeholder="State"
                />
              </div>
            </div>

            {/* Bio */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">Bio</label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                rows="4"
                placeholder="Tell us about yourself..."
              />
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-3">
              {hasChanges && (
                <Button
                  onClick={() => {
                    setFormData(profile);
                    setHasChanges(false);
                  }}
                  variant="outline"
                  className="px-6 py-3 rounded-xl font-semibold"
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSaveChanges}
                disabled={loading || !hasChanges}
                className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-3 rounded-xl font-semibold hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center gap-2">
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Saving...
                  </span>
                ) : (
                  'Save Changes'
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
