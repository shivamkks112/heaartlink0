import { useState } from 'react';
import axios from 'axios';
import { User, Mail, Phone, MapPin, Hash, Award, Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ProfilePage = ({ user, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user.name || '',
    bio: user.bio || '',
    location: user.location || '',
    interests: user.interests ? user.interests.join(', ') : ''
  });

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size should be less than 5MB');
      return;
    }

    setUploadingPhoto(true);

    try {
      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64String = reader.result;
        
        // Upload to backend
        const formData = new URLSearchParams();
        formData.append('image_data', base64String);

        const response = await axios.post(
          `${API}/profile/${user.id}/profile-picture`,
          formData,
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
          }
        );

        // Update local user state
        const updatedUser = { ...user, profile_picture: base64String };
        onUpdate(updatedUser);
        toast.success('Profile picture updated!');
      };

      reader.readAsDataURL(file);
    } catch (error) {
      toast.error('Failed to upload profile picture');
      console.error('Upload error:', error);
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleDeletePhoto = async () => {
    if (!window.confirm('Delete profile picture?')) return;

    setUploadingPhoto(true);
    try {
      await axios.delete(`${API}/profile/${user.id}/profile-picture`);
      const updatedUser = { ...user, profile_picture: null };
      onUpdate(updatedUser);
      toast.success('Profile picture deleted');
    } catch (error) {
      toast.error('Failed to delete profile picture');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const updates = {
        ...profileData,
        interests: profileData.interests.split(',').map(i => i.trim()).filter(i => i)
      };
      const response = await axios.put(`${API}/profile/${user.id}`, updates);
      onUpdate(response.data);
      toast.success('Profile updated successfully!');
      setEditing(false);
    } catch (error) {
      toast.error('Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleVerification = async () => {
    setLoading(true);
    try {
      const response = await axios.post(`${API}/profile/${user.id}/verify`);
      toast.success(response.data.message);
      if (response.data.status === 'verified') {
        const updatedUser = { ...user, verified: true, verification_status: 'verified' };
        onUpdate(updatedUser);
      }
    } catch (error) {
      toast.error('Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden">
          {/* Header with Profile Picture */}
          <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 px-8 py-12 text-white text-center relative">
            <div className="relative inline-block mb-4">
              <div className="w-32 h-32 mx-auto bg-white rounded-full flex items-center justify-center shadow-xl overflow-hidden">
                {user.profile_picture ? (
                  <img 
                    src={user.profile_picture} 
                    alt={user.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-gray-400" />
                )}
              </div>
              
              {/* Upload/Delete buttons */}
              <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 flex gap-2">
                <label 
                  htmlFor="profile-picture-upload"
                  className="bg-white text-pink-600 p-2 rounded-full shadow-lg cursor-pointer hover:bg-gray-50 transition-all"
                  data-testid="upload-photo-btn"
                >
                  {uploadingPhoto ? (
                    <div className="w-5 h-5 border-2 border-pink-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </label>
                <input
                  id="profile-picture-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploadingPhoto}
                />
                
                {user.profile_picture && (
                  <button
                    onClick={handleDeletePhoto}
                    disabled={uploadingPhoto}
                    className="bg-white text-red-600 p-2 rounded-full shadow-lg hover:bg-gray-50 transition-all"
                    data-testid="delete-photo-btn"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            
            <h1 className="text-3xl font-bold mb-2">{user.name}, {user.age}</h1>
            <div className="flex items-center justify-center gap-2">
              {user.verified ? (
                <span className="bg-blue-500 px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Verified Profile
                </span>
              ) : (
                <Button
                  data-testid="verify-profile-btn"
                  onClick={handleVerification}
                  disabled={loading}
                  className="bg-white text-pink-600 hover:bg-gray-100 px-6 py-2 rounded-full font-semibold"
                >
                  {loading ? 'Verifying...' : 'Get Verified'}
                </Button>
              )}
            </div>
          </div>

          {/* Profile Info */}
          <div className="p-8">
            {!editing ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">About</h3>
                  <p className="text-gray-600">{user.bio || 'No bio added yet'}</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Location
                  </h3>
                  <p className="text-gray-600">{user.location}</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2 flex items-center gap-2">
                    <Mail className="w-5 h-5" />
                    Contact
                  </h3>
                  <p className="text-gray-600">{user.email || 'Not provided'}</p>
                  {user.phone && <p className="text-gray-600">{user.phone}</p>}
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-3 flex items-center gap-2">
                    <Hash className="w-5 h-5" />
                    Interests
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {user.interests && user.interests.length > 0 ? (
                      user.interests.map((interest, idx) => (
                        <span
                          key={idx}
                          className="bg-gradient-to-r from-pink-100 to-orange-100 text-gray-800 px-4 py-2 rounded-full text-sm font-medium"
                        >
                          {interest}
                        </span>
                      ))
                    ) : (
                      <p className="text-gray-500">No interests added</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-700 mb-2">Preferences</h3>
                  <p className="text-gray-600">
                    Looking for: {user.looking_for} • Gender: {user.gender}
                  </p>
                </div>

                <Button
                  data-testid="edit-profile-btn"
                  onClick={() => setEditing(true)}
                  className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg"
                >
                  Edit Profile
                </Button>
              </div>
            ) : (
              <form onSubmit={handleUpdate} className="space-y-6">
                <div>
                  <Label htmlFor="edit-name" className="text-gray-700 font-semibold">Name</Label>
                  <Input
                    id="edit-name"
                    data-testid="edit-name-input"
                    value={profileData.name}
                    onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                    className="mt-2 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-bio" className="text-gray-700 font-semibold">Bio</Label>
                  <textarea
                    id="edit-bio"
                    data-testid="edit-bio-input"
                    value={profileData.bio}
                    onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                    className="w-full mt-2 py-3 px-4 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none h-32 resize-none"
                    placeholder="Tell us about yourself..."
                  />
                </div>

                <div>
                  <Label htmlFor="edit-location" className="text-gray-700 font-semibold">Location</Label>
                  <Input
                    id="edit-location"
                    data-testid="edit-location-input"
                    value={profileData.location}
                    onChange={(e) => setProfileData({...profileData, location: e.target.value})}
                    className="mt-2 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-interests" className="text-gray-700 font-semibold">Interests (comma-separated)</Label>
                  <Input
                    id="edit-interests"
                    data-testid="edit-interests-input"
                    value={profileData.interests}
                    onChange={(e) => setProfileData({...profileData, interests: e.target.value})}
                    className="mt-2 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    placeholder="Music, Travel, Food"
                  />
                </div>

                <div className="flex gap-4">
                  <Button
                    data-testid="save-profile-btn"
                    type="submit"
                    disabled={loading}
                    className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold"
                  >
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                  <Button
                    data-testid="cancel-edit-btn"
                    type="button"
                    onClick={() => setEditing(false)}
                    className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 py-6 rounded-xl font-semibold"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
