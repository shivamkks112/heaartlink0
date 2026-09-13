import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { Camera, User, Heart, MapPin, Calendar, Briefcase, GraduationCap, Ruler, Dumbbell, Wine, Cigarette, CheckCircle, Shield, Sparkles, ChevronRight, Search, Share2, Gift, Settings, LogOut, Crown, Clock } from 'lucide-react';
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

// Boost Button Component
const BoostButton = ({ userId }) => {
  const [boostStatus, setBoostStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (userId) fetchBoostStatus();
  }, [userId]);

  const fetchBoostStatus = async () => {
    try {
      const res = await axios.get(`${API}/boost/${userId}/status`);
      setBoostStatus(res.data);
    } catch (e) {}
  };

  const activateBoost = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/boost/${userId}`);
      toast.success('Boost activated! 30 min tak sabse pehle dikhoge.');
      fetchBoostStatus();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Boost failed');
    }
    setLoading(false);
  };

  const remaining = boostStatus?.remaining_seconds || 0;
  const mins = Math.floor(remaining / 60);

  return (
    <button
      onClick={boostStatus?.is_active ? undefined : activateBoost}
      disabled={loading || boostStatus?.is_active}
      className={`w-full rounded-xl p-4 flex items-center justify-between transition-all group ${
        boostStatus?.is_active
          ? 'bg-gradient-to-r from-purple-100 to-indigo-100 border-2 border-purple-300'
          : boostStatus?.can_boost !== false
          ? 'bg-gradient-to-r from-purple-50 to-indigo-50 border-2 border-purple-200 hover:shadow-md'
          : 'bg-gray-50 border-2 border-gray-200 opacity-60'
      }`}
      data-testid="boost-btn"
    >
      <div className="flex items-center gap-3">
        <div className="bg-gradient-to-br from-purple-500 to-indigo-500 p-2.5 rounded-xl">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <div className="text-left">
          <h4 className="font-bold text-gray-900">
            {boostStatus?.is_active ? `Boost Active (${mins}m left)` : 'Boost Profile'}
          </h4>
          <p className="text-sm text-gray-600">
            {boostStatus?.is_active ? 'You appear first in Discover!' :
             boostStatus?.can_boost !== false ? '1 free daily — appear first for 30 min' : 'Used today. Try again tomorrow!'}
          </p>
        </div>
      </div>
      {!boostStatus?.is_active && boostStatus?.can_boost !== false && (
        <ChevronRight className="w-5 h-5 text-purple-500 group-hover:translate-x-1 transition-transform" />
      )}
    </button>
  );
};

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
  const [completeness, setCompleteness] = useState(null);

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
      fetchUserStats();
      fetchCompleteness();
    }
    // eslint-disable-next-line
  }, [user?.id]);

  const fetchCompleteness = async () => {
    if (!user?.id) return;
    try {
      const res = await axios.get(`${API}/profile/${user.id}/completeness`);
      setCompleteness(res.data);
    } catch (e) {
      console.error('Failed to fetch completeness:', e);
    }
  };

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
    navigate('/verify-selfie');
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
              className="absolute top-4 right-4 p-2.5 rounded-full transition-all active:scale-90"
              style={{ background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)' }}
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
            
            {/* No photo warning */}
            {!profile.profile_picture && (!profile.photos || profile.photos.length === 0) && (
              <div className="mt-2 bg-amber-500/20 border border-amber-400/40 backdrop-blur-sm px-4 py-2 rounded-full inline-flex items-center gap-2" data-testid="no-photo-warning">
                <span className="text-sm">Add a profile photo to build trust</span>
              </div>
            )}
            
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
              {!profile.verified && profile.selfie_verification_status === 'pending' && (
                <div className="flex items-center gap-1.5 bg-yellow-500/30 px-3 py-1.5 rounded-full">
                  <Clock className="w-4 h-4 text-yellow-200" />
                  <span className="text-sm font-medium text-yellow-100">Verification Pending</span>
                </div>
              )}
              {!profile.verified && profile.selfie_verification_status !== 'pending' && (
                <Button
                  onClick={handleRequestVerification}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-full text-sm font-medium transition-all"
                >
                  <Shield className="w-4 h-4" />
                  <span>{profile.selfie_verification_status === 'rejected' ? 'Retry Verification' : 'Get Verified'}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Profile Completeness */}
          {completeness && completeness.score < 100 && (
            <div className="px-6 py-5 border-b" style={{ background: 'var(--m3-surface-container-low)', borderColor: 'var(--m3-outline-variant)' }} data-testid="profile-completeness">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--m3-on-surface)' }}>
                  Profile Completeness
                </h3>
                <span className="text-lg font-bold" style={{ color: completeness.score >= 80 ? '#10B981' : completeness.score >= 50 ? '#F59E0B' : '#EF4444' }}>
                  {completeness.score}%
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-gray-200 overflow-hidden mb-3">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${completeness.score}%`,
                    background: completeness.score >= 80 ? 'linear-gradient(90deg, #10B981, #059669)' : completeness.score >= 50 ? 'linear-gradient(90deg, #F59E0B, #EAB308)' : 'linear-gradient(90deg, #EF4444, #F97316)',
                  }}
                />
              </div>
              {completeness.suggestions?.length > 0 && (
                <div className="space-y-1.5">
                  {completeness.suggestions.map((s, i) => (
                    <p key={i} className="text-xs flex items-center gap-1.5" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                      {s.text}
                    </p>
                  ))}
                </div>
              )}
              <p className="text-[10px] mt-2" style={{ color: 'var(--m3-on-surface-variant)' }}>Complete profile = better discovery visibility</p>
            </div>
          )}

          {/* Activity Stats Section */}
          {userStats && (
            <div className="px-6 py-6 border-b" style={{ background: 'var(--m3-surface-container-low)', borderColor: 'var(--m3-outline-variant)' }}>
              <h3 className="text-base font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--m3-on-surface)' }}>
                <Sparkles className="w-5 h-5" style={{ color: 'var(--m3-primary)' }} />
                Your Activity Stats
              </h3>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {[
                  { val: userStats.likes_sent || 0, label: 'Likes Sent', bg: 'linear-gradient(135deg, #D6336C, #E8590C)' },
                  { val: userStats.likes_received || 0, label: 'Likes Got', bg: 'linear-gradient(135deg, #E53935, #FF6D00)' },
                  { val: userStats.mutual_matches || 0, label: 'Matches', bg: 'linear-gradient(135deg, #10B981, #059669)' },
                  { val: userStats.superlikes_sent || 0, label: 'Super', bg: 'linear-gradient(135deg, #3B82F6, #06B6D4)' },
                  { val: userStats.superlikes_received || 0, label: 'Got Super', bg: 'linear-gradient(135deg, #8B5CF6, #A855F7)' },
                  { val: userStats.profile_views || 0, label: 'Views', bg: 'linear-gradient(135deg, #F59E0B, #EAB308)' },
                ].map((stat, i) => (
                  <div key={i} className="rounded-2xl p-3 text-center text-white" style={{ background: stat.bg, boxShadow: 'var(--m3-elevation-1)' }}>
                    <div className="text-xl font-bold">{stat.val}</div>
                    <div className="text-[10px] font-medium opacity-90">{stat.label}</div>
                  </div>
                ))}
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

            {/* Share Profile on WhatsApp */}
            <button
              onClick={() => navigate('/share-profile')}
              className="w-full bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-4 flex items-center justify-between hover:shadow-md transition-all group"
              data-testid="share-profile-btn"
            >
              <div className="flex items-center gap-3">
                <div className="bg-[#25D366] p-2.5 rounded-xl">
                  <Share2 className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <h4 className="font-bold text-gray-900">Share Profile</h4>
                  <p className="text-sm text-gray-600">Share on WhatsApp & get more matches</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-green-500 group-hover:translate-x-1 transition-transform" />
            </button>

            {/* Boost Profile */}
            <BoostButton userId={user?.id} />

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
