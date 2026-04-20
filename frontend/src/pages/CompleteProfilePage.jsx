import { useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { User, MapPin, Calendar, Heart, ArrowRight, Search, Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { INDIAN_STATES, CITIES_BY_STATE, POPULAR_CITIES } from '@/data/indianCities';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env?.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const CompleteProfilePage = ({ onLogin }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { phone, firebase_uid } = location.state || {};
  const [loading, setLoading] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [selectedState, setSelectedState] = useState('');
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  
  const [profileData, setProfileData] = useState({
    name: '',
    age: '',
    gender: 'Male',
    looking_for: 'Female',
    relationship_status: 'Single',
    location: '',
    bio: '',
    interests: ''
  });

  // Handle profile picture selection
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
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
    
    setProfilePicture(file);
    setProfilePicturePreview(URL.createObjectURL(file));
  };

  // Upload photo to Firebase
  const uploadProfilePicture = async (userId) => {
    if (!profilePicture) return null;
    
    try {
      setUploadingPhoto(true);
      const storage = getStorage();
      const storageRef = ref(storage, `profile_pictures/${userId}/${Date.now()}_${profilePicture.name}`);
      await uploadBytes(storageRef, profilePicture);
      const downloadURL = await getDownloadURL(storageRef);
      return downloadURL;
    } catch (error) {
      console.error('Photo upload error:', error);
      throw error;
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Get cities based on selected state
  const availableCities = useMemo(() => {
    if (selectedState && CITIES_BY_STATE[selectedState]) {
      return CITIES_BY_STATE[selectedState];
    }
    return POPULAR_CITIES;
  }, [selectedState]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (!citySearch) return availableCities.slice(0, 15);
    return availableCities.filter(city => 
      city.toLowerCase().includes(citySearch.toLowerCase())
    ).slice(0, 15);
  }, [citySearch, availableCities]);

  // Redirect if no phone data
  if (!phone || !firebase_uid) {
    navigate('/auth');
    return null;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!profileData.name || !profileData.age || !profileData.location) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Profile picture is mandatory
    if (!profilePicture) {
      toast.error('Profile photo is required! Please upload your photo.');
      return;
    }

    if (parseInt(profileData.age) < 18) {
      toast.error('You must be 18 or older to use HeartLink');
      return;
    }

    // Block social media handles in name/bio
    const blockedWords = /telegram|whatsapp|instagram|insta|snapchat|snap|facebook|fb|twitter|discord|signal|skype|t\.me|wa\.me|@\w+/i;
    if (blockedWords.test(profileData.name) || blockedWords.test(profileData.bio)) {
      toast.error('Name ya Bio mein social media handles allowed nahi hai');
      return;
    }
    
    if (/\d/.test(profileData.name)) {
      toast.error('Name mein numbers allowed nahi hain');
      return;
    }
    
    if (profileData.bio && /\d{5,}/.test(profileData.bio)) {
      toast.error('Bio mein phone number ya numeric values allowed nahi hain');
      return;
    }

    setLoading(true);
    try {
      // Upload profile picture FIRST (before creating user)
      toast.loading('Uploading photo...');
      setUploadingPhoto(true);
      
      const tempId = `temp_${Date.now()}`;
      let photoURL = null;
      try {
        const storageRef = ref(storage, `profile_pictures/${tempId}/${Date.now()}_${profilePicture.name}`);
        await uploadBytes(storageRef, profilePicture);
        photoURL = await getDownloadURL(storageRef);
      } catch (uploadError) {
        console.error('Photo upload error:', uploadError);
        toast.dismiss();
        toast.error('Failed to upload photo. Please try again.');
        setUploadingPhoto(false);
        setLoading(false);
        return;
      }
      setUploadingPhoto(false);
      toast.dismiss();
      
      // Now create user with photo URL included
      const submitData = {
        phone,
        firebase_uid,
        name: profileData.name,
        age: parseInt(profileData.age),
        gender: profileData.gender,
        looking_for: profileData.looking_for,
        relationship_status: profileData.relationship_status,
        location: profileData.location,
        bio: profileData.bio,
        interests: profileData.interests ? profileData.interests.split(',').map(i => i.trim()) : [],
        photos: [photoURL]
      };

      const response = await axios.post(`${API}/auth/phone-signup`, submitData);
      const userData = response.data.user;
      
      // Photo already uploaded and included in signup, just update profile_picture field
      if (photoURL) {
        try {
          await axios.patch(`${API}/user/${userData.id}`, {
            profile_picture: photoURL
          });
          userData.profile_picture = photoURL;
        } catch (patchErr) {
          console.error('Profile picture patch error:', patchErr);
        }
      }
      
      localStorage.setItem('user', JSON.stringify(userData));
      await onLogin(userData);
      
      toast.dismiss();
      toast.success(`Welcome to HeartLink, ${userData.name}!`);
      navigate('/discover');
    } catch (error) {
      console.error('Profile completion error:', error);
      const errorMessage = error.response?.data?.detail || 'Failed to complete profile';
      toast.dismiss();
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-orange-100 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full mb-4 shadow-lg">
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Complete Your Profile</h1>
          <p className="text-gray-600 mt-2">Tell us a bit about yourself</p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Profile Photo Upload - MANDATORY */}
            <div className="text-center mb-6">
              <Label className="text-gray-700 font-semibold block mb-3">Profile Photo * (Required)</Label>
              <div className="flex justify-center">
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="relative cursor-pointer group"
                >
                  {profilePicturePreview ? (
                    <div className="relative">
                      <img 
                        src={profilePicturePreview} 
                        alt="Profile Preview"
                        className="w-32 h-32 rounded-full object-cover border-4 border-pink-500 shadow-lg"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProfilePicture(null);
                          setProfilePicturePreview('');
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute bottom-0 right-0 bg-green-500 text-white rounded-full p-1.5 shadow-lg">
                        <Camera className="w-4 h-4" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-32 h-32 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 border-4 border-dashed border-pink-300 flex flex-col items-center justify-center group-hover:border-pink-500 transition-colors">
                      <Camera className="w-8 h-8 text-pink-400 mb-1" />
                      <span className="text-xs text-pink-500 font-medium">Add Photo</span>
                    </div>
                  )}
                </div>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <p className="text-xs text-gray-500 mt-2">
                {profilePicture ? '✅ Photo selected' : 'Tap to upload your photo'}
              </p>
            </div>

            <div>
              <Label className="text-gray-700 font-semibold">Name *</Label>
              <div className="relative mt-2">
                <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Your full name"
                  value={profileData.name}
                  onChange={(e) => setProfileData({...profileData, name: e.target.value})}
                  className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 font-semibold">Age *</Label>
                <div className="relative mt-2">
                  <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    type="number"
                    placeholder="Age"
                    min="18"
                    max="100"
                    value={profileData.age}
                    onChange={(e) => setProfileData({...profileData, age: e.target.value})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">State *</Label>
                <select
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setProfileData({...profileData, location: ''});
                    setCitySearch('');
                  }}
                  className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                  required
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(state => (
                    <option key={state} value={state}>{state}</option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <Label className="text-gray-700 font-semibold">City *</Label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <Input
                    type="text"
                    placeholder={selectedState ? "Search city..." : "Select state first"}
                    value={citySearch || profileData.location}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setShowCityDropdown(true);
                    }}
                    onFocus={() => setShowCityDropdown(true)}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
                {showCityDropdown && filteredCities.length > 0 && (
                  <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {filteredCities.map(city => (
                      <button
                        key={city}
                        type="button"
                        onClick={() => {
                          setProfileData({...profileData, location: city});
                          setCitySearch('');
                          setShowCityDropdown(false);
                        }}
                        className="w-full px-4 py-2 text-left hover:bg-pink-50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        {city}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-700 font-semibold">I am</Label>
                <select
                  value={profileData.gender}
                  onChange={(e) => setProfileData({...profileData, gender: e.target.value})}
                  className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Non-binary">Non-binary</option>
                </select>
              </div>
              <div>
                <Label className="text-gray-700 font-semibold">Looking for</Label>
                <select
                  value={profileData.looking_for}
                  onChange={(e) => setProfileData({...profileData, looking_for: e.target.value})}
                  className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Both">Both</option>
                </select>
              </div>
            </div>

            <div>
              <Label className="text-gray-700 font-semibold">Relationship Status</Label>
              <select
                value={profileData.relationship_status}
                onChange={(e) => setProfileData({...profileData, relationship_status: e.target.value})}
                className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
              >
                <option value="Single">Single</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Complicated">It's Complicated</option>
              </select>
            </div>

            <div>
              <Label className="text-gray-700 font-semibold">Bio (Optional)</Label>
              <textarea
                placeholder="Tell us about yourself..."
                value={profileData.bio}
                onChange={(e) => setProfileData({...profileData, bio: e.target.value})}
                className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 resize-none h-24"
                maxLength={300}
              />
            </div>

            <div>
              <Label className="text-gray-700 font-semibold">Interests (Optional)</Label>
              <Input
                type="text"
                placeholder="music, travel, cooking (comma separated)"
                value={profileData.interests}
                onChange={(e) => setProfileData({...profileData, interests: e.target.value})}
                className="mt-2 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all mt-6"
            >
              {loading ? (
                'Creating Profile...'
              ) : (
                <span className="flex items-center justify-center gap-2">
                  Complete Profile <ArrowRight className="w-5 h-5" />
                </span>
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CompleteProfilePage;
