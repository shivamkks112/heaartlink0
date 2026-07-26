import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera, User, Heart, MapPin, Calendar, Briefcase, GraduationCap, Ruler, Dumbbell, Wine, Cigarette, CheckCircle, Shield, Sparkles, ChevronRight, Search, Share2, Gift, Settings, LogOut, Crown } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/firebase/config';
import { INDIAN_STATES, CITIES_BY_STATE, POPULAR_CITIES } from '@/data/indianCities';

import { BACKEND_URL, API } from '@/config/api';

const ProfilePage = ({ user, onUpdate }) => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(user || {});
  const [formData, setFormData] = useState({});
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  // Check if user is premium
  const isPremium = user?.is_premium || user?.isPremium;

  // Get cities based on selected state
  const availableCities = useMemo(() => {
    if (formData.state && CITIES_BY_STATE[formData.state]) {
      return CITIES_BY_STATE[formData.state];
    }
    return POPULAR_CITIES;
  }, [formData.state]);

  // Filter cities based on search
  const filteredCities = useMemo(() => {
    if (!citySearch) return availableCities.slice(0, 20);
    return availableCities.filter(city => 
      city.toLowerCase().includes(citySearch.toLowerCase())
    ).slice(0, 20);
  }, [citySearch, availableCities]);

  // User Stats State
  const [userStats, setUserStats] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      fetchUserStats();
    }
    // eslint-disable-next-line
  }, [user?.id]);

  const fetchUserStats = async () => {
    if (!user?.id) return;
    try {
      const response = await axios.get(`${API}/profile/${user.id}/stats`);
      setUserStats(response.data);
    } catch (error) {
      console.error('Failed to fetch user stats:', error);
    }
  };

  const formatLastSeen = (lastActive) => {
    if (!lastActive) return 'recently';
    
    const now = new Date();
    const lastSeenDate = new Date(lastActive);
    const diffMs = now - lastSeenDate;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return 'recently';
  };

  const fetchProfile = async () => {
    if (!user?.id) {
      console.error('No user ID available');
      setFetchError(true);
      return;
    }
    
    try {
      setFetchError(false);
      const response = await axios.get(`${API}/profile/${user.id}`);
      setProfile(response.data);
      setFormData(response.data);
    } catch (error) {
      console.error('Profile fetch error:', error.response?.data || error.message);
      setFetchError(true);
      toast.error('Failed to load profile. Please refresh.');
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
    // Prevent changing locked fields
    if (field === 'name' || field === 'gender') {
      toast.error('Yeh field change nahi ho sakta');
      return;
    }
    
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

    // Validation for ALL required fields
    if (!formData.age || formData.age < 18 || formData.age > 100) {
      toast.error('Please enter valid age (18-100)');
      return;
    }
    
    if (!formData.looking_for) {
      toast.error('Please select who you are looking for');
      return;
    }
    
    if (!formData.city || formData.city.trim().length < 2) {
      toast.error('Please enter your city');
      return;
    }
    
    if (!formData.state || formData.state.trim().length < 2) {
      toast.error('Please enter your state');
      return;
    }

    if (!formData.bio || formData.bio.trim().length < 10) {
      toast.error('Please write a bio (at least 10 characters)');
      return;
    }

    if (!formData.relationship_status) {
      toast.error('Please select your relationship status');
      return;
    }

    setLoading(true);
    try {
      // Only send changed fields (excluding locked fields)
      const updates = {};
      const lockedFields = ['name', 'gender', 'id', 'email', 'phone'];
      
      Object.keys(formData).forEach(key => {
        if (!lockedFields.includes(key) && formData[key] !== profile[key]) {
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
        toast.success('🎉 ' + response.data.message);
      } else {
        toast.error('❌ ' + response.data.message);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.detail || 'Failed to request verification. Please try again.';
      toast.error(errorMsg);
      console.error('Verification error:', error);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-4xl mx-auto px-4 py-4 m3-animate-in">
        <div className="rounded-[28px] overflow-hidden" style={{ background: 'var(--m3-surface-container-lowest)', boxShadow: 'var(--m3-elevation-2)' }}>
          {/* Header with Profile Picture */}
          <div className="px-8 py-10 text-white text-center relative" style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)' }}>
            {/* Settings Gear Icon */}
            <button
              onClick={() => navigate('/settings')}
              className="absolute top-4 right-4 bg-white/20 backdrop-blur-sm p-2.5 rounded-full hover:bg-white/30 transition-all"
              data-testid="profile-settings-btn"
            >
              <Settings className="w-5 h-5 text-white" />
            </button>
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
            
            {/* Online Status / Last Seen */}
            <div className="flex items-center justify-center gap-2 mt-3">
              {profile.is_online ? (
                <div className="flex items-center gap-2 bg-green-500/30 backdrop-blur-sm px-4 py-2 rounded-full border border-green-300/50">
                  <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse shadow-lg"></div>
                  <span className="text-sm font-semibold">Online Now</span>
                </div>
              ) : profile.last_active ? (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                  <span className="text-sm">Last seen {formatLastSeen(profile.last_active)}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full">
                  <div className="w-2.5 h-2.5 bg-gray-400 rounded-full"></div>
                  <span className="text-sm">Offline</span>
                </div>
              )}
            </div>
            
            <div className="flex items-center justify-center gap-2 mt-4 flex-wrap">
              {profile.verified && (
                <div className="flex items-center gap-1 bg-white/20 px-3 py-1 rounded-full">
                  <CheckCircle className="w-4 h-4" fill="white" />
                  <span className="text-sm font-medium">Verified</span>
                </div>
              )}
              {!profile.verified && (
                <Button
                  onClick={handleRequestVerification}
                  disabled={verifying}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-medium transition-all"
                >
                  {verifying ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Verifying...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>{profile.verification_status === 'pending' ? 'Retry Verification' : 'Get Verified'}</span>
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Activity Stats Section */}
          {userStats && (
            <div className="px-8 py-6 bg-gradient-to-r from-gray-50 to-white border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-pink-500" />
                Your Activity Stats
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {/* Likes Sent */}
                <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.likes_sent || 0}</div>
                  <div className="text-xs opacity-90">Likes Sent</div>
                </div>
                
                {/* Likes Received */}
                <div className="bg-gradient-to-br from-red-500 to-orange-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.likes_received || 0}</div>
                  <div className="text-xs opacity-90">Likes Got</div>
                </div>
                
                {/* Mutual Matches */}
                <div className="bg-gradient-to-br from-green-500 to-emerald-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.mutual_matches || 0}</div>
                  <div className="text-xs opacity-90">Matches</div>
                </div>
                
                {/* Superlikes Sent */}
                <div className="bg-gradient-to-br from-blue-500 to-cyan-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.superlikes_sent || 0}</div>
                  <div className="text-xs opacity-90">Super ⭐</div>
                </div>
                
                {/* Superlikes Received */}
                <div className="bg-gradient-to-br from-purple-500 to-violet-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.superlikes_received || 0}</div>
                  <div className="text-xs opacity-90">Got Super</div>
                </div>
                
                {/* Profile Views */}
                <div className="bg-gradient-to-br from-amber-500 to-yellow-500 rounded-xl p-3 text-center text-white shadow-lg">
                  <div className="text-2xl font-bold">{userStats.profile_views || 0}</div>
                  <div className="text-xs opacity-90">Views</div>
                </div>
              </div>
            </div>
          )}

          {/* Profile Information */}
          <div className="px-8 py-8 space-y-6">
            {/* Basic Info */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-pink-500" />
                Basic Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Name - LOCKED */}
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    Name <span className="text-xs text-gray-400 ml-1">🔒</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    placeholder="Name"
                  />
                  <p className="text-xs text-gray-400 mt-1">Name change nahi ho sakta</p>
                </div>
                
                {/* Age - Required */}
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Age <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={formData.age || ''}
                    onChange={(e) => handleFieldChange('age', parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    placeholder="Enter your age"
                    min="18"
                    max="100"
                    required
                  />
                </div>
                
                {/* Gender - LOCKED */}
                <div>
                  <label className="text-sm font-medium text-gray-600 flex items-center gap-1">
                    Gender <span className="text-xs text-gray-400 ml-1">🔒</span>
                  </label>
                  <input
                    type="text"
                    value={formData.gender ? formData.gender.charAt(0).toUpperCase() + formData.gender.slice(1) : ''}
                    disabled
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg bg-gray-100 text-gray-600 cursor-not-allowed"
                    placeholder="Gender"
                  />
                  <p className="text-xs text-gray-400 mt-1">Gender change nahi ho sakta</p>
                </div>
                
                {/* Looking For - Required */}
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    Looking For <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.looking_for || ''}
                    onChange={(e) => handleFieldChange('looking_for', e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select preference</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Location - Required */}
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-pink-500" />
                Location <span className="text-red-500 text-sm">*</span>
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* State Dropdown */}
                <div>
                  <label className="text-sm font-medium text-gray-600">
                    State <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={formData.state || ''}
                    onChange={(e) => {
                      handleFieldChange('state', e.target.value);
                      handleFieldChange('city', ''); // Reset city when state changes
                      setCitySearch('');
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent bg-white"
                    required
                  >
                    <option value="">Select State</option>
                    {INDIAN_STATES.map(state => (
                      <option key={state} value={state}>{state}</option>
                    ))}
                  </select>
                </div>
                
                {/* City Dropdown with Search */}
                <div className="relative">
                  <label className="text-sm font-medium text-gray-600">
                    City <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={citySearch || formData.city || ''}
                      onChange={(e) => {
                        setCitySearch(e.target.value);
                        setShowCityDropdown(true);
                      }}
                      onFocus={() => setShowCityDropdown(true)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent pr-10"
                      placeholder={formData.state ? "Search city..." : "Select state first"}
                      required
                    />
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  
                  {/* City Dropdown */}
                  {showCityDropdown && (
                    <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredCities.length > 0 ? (
                        filteredCities.map(city => (
                          <button
                            key={city}
                            type="button"
                            onClick={() => {
                              handleFieldChange('city', city);
                              setCitySearch('');
                              setShowCityDropdown(false);
                            }}
                            className="w-full px-4 py-2 text-left hover:bg-pink-50 transition-colors border-b border-gray-100 last:border-b-0"
                          >
                            {city}
                          </button>
                        ))
                      ) : (
                        <div className="px-4 py-2 text-gray-500 text-sm">
                          {formData.state ? "No cities found" : "Please select a state first"}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Bio - Required */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Bio <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.bio || ''}
                onChange={(e) => handleFieldChange('bio', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                rows="4"
                placeholder="Tell us about yourself..."
                required
              />
              <div className="mt-2 text-sm text-gray-500">
                <p className="font-medium text-gray-600 mb-1">💡 Bio Ideas:</p>
                <ul className="list-disc list-inside space-y-1 text-xs">
                  <li>What do you do for fun on weekends?</li>
                  <li>Your favorite travel destination</li>
                  <li>What makes you laugh?</li>
                  <li>Your dream date idea</li>
                  <li>A fun fact about yourself</li>
                </ul>
              </div>
            </div>

            {/* Relationship Status - Required */}
            <div>
              <label className="text-sm font-medium text-gray-600 mb-2 block">
                Relationship Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.relationship_status || ''}
                onChange={(e) => handleFieldChange('relationship_status', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                required
              >
                <option value="">Select your status</option>
                <option value="Single">Single</option>
                <option value="Divorced">Divorced</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Complicated">It&apos;s Complicated</option>
              </select>
            </div>

            {/* Enhance Profile Link */}
            <button
              onClick={() => navigate('/enhance-profile')}
              className="w-full bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all group"
              data-testid="enhance-profile-btn"
            >
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-purple-500 to-pink-500 p-2.5 rounded-xl">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-900">Enhance Your Profile</h4>
                  <p className="text-sm text-gray-600">Add values, lifestyle, voice & video intro</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Invite Friends */}
            <button
              onClick={() => navigate('/referral')}
              className="w-full bg-gradient-to-r from-orange-50 to-pink-50 border-2 border-orange-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all group"
              data-testid="invite-friends-btn"
            >
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-r from-orange-500 to-pink-500 p-2.5 rounded-xl">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-900">Invite Friends</h4>
                  <p className="text-sm text-gray-600">Refer 3 friends & earn 10 FREE Superlikes</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-orange-500 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Display Trust Badge */}
            {profile.trust_badge_level && (
              <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-200">
                <Shield className={`w-6 h-6 ${
                  profile.trust_badge_level === 'high' ? 'text-green-600' :
                  profile.trust_badge_level === 'medium' ? 'text-yellow-600' : 'text-gray-500'
                }`} />
                <div>
                  <p className="font-semibold text-gray-900">Trust Level: {(profile.trust_badge_level || 'low').toUpperCase()}</p>
                  <p className="text-xs text-gray-500">Complete your profile to increase trust</p>
                </div>
              </div>
            )}

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

        {/* Quick Links */}
        <div className="mt-6 space-y-3">
          <button
            onClick={() => navigate('/settings')}
            className="w-full flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
            data-testid="quick-link-settings"
          >
            <div className="flex items-center gap-3">
              <div className="bg-gray-100 p-2.5 rounded-xl">
                <Settings className="w-5 h-5 text-gray-700" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Settings</p>
                <p className="text-xs text-gray-500">Chat privacy, blocked users, account</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          <button
            onClick={() => navigate('/privacy')}
            className="w-full flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
            data-testid="quick-link-privacy"
          >
            <div className="flex items-center gap-3">
              <div className="bg-pink-100 p-2.5 rounded-xl">
                <Shield className="w-5 h-5 text-pink-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Privacy & Safety</p>
                <p className="text-xs text-gray-500">Profile hide, incognito, gender lock</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* Admin Panel - only for admin users */}
          {user?.is_admin && (
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
              data-testid="quick-link-admin"
            >
              <div className="flex items-center gap-3">
                <div className="bg-purple-100 p-2.5 rounded-xl">
                  <Crown className="w-5 h-5 text-purple-600" />
                </div>
                <div className="text-left">
                  <p className="font-semibold text-gray-900">Admin Panel</p>
                  <p className="text-xs text-gray-500">Manage users, approvals, notifications</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-gray-400" />
            </button>
          )}

          {/* Logout */}
          <button
            onClick={() => {
              localStorage.clear();
              window.location.href = '/auth';
            }}
            className="w-full flex items-center justify-between bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all"
            data-testid="quick-link-logout"
          >
            <div className="flex items-center gap-3">
              <div className="bg-red-100 p-2.5 rounded-xl">
                <LogOut className="w-5 h-5 text-red-600" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-red-600">Logout</p>
                <p className="text-xs text-gray-500">Sign out of your account</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
