import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, ArrowRight, Shield, Camera, Upload, X, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { getStorage, ref, uploadBytes, getDownloadURL } from '@/firebase/config';

import { BACKEND_URL, API } from '@/config/api';
import { INDIAN_STATES, CITIES_BY_STATE, POPULAR_CITIES } from '@/data/indianCities';
import { trackEvent, getStoredInstallId } from '@/utils/installTracker';

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  // Pre-fill referral code from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const refCode = urlParams.get('ref') || '';
  
  const [loginData, setLoginData] = useState({
    email_or_phone: '',
    password: ''
  });
  
  const [signupData, setSignupData] = useState({
    email: '',
    phone: '',
    password: '',
    name: '',
    age: '',
    gender: '',
    looking_for: '',
    relationship_status: 'Single',
    bio: '',
    location: '',
    interests: '',
    ageVerified: false,
    referral_code: refCode
  });

  // Profile picture state for signup
  const [profilePicture, setProfilePicture] = useState(null);
  const [profilePicturePreview, setProfilePicturePreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const fileInputRef = useRef(null);
  const [selectedState, setSelectedState] = useState('');
  const [citySearch, setCitySearch] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showLoginPwd, setShowLoginPwd] = useState(false);
  const [showSignupPwd, setShowSignupPwd] = useState(false);

  // Handle profile picture selection
  const handlePhotoSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    
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

  // Countdown timer for OTP resend
  // Phone number formatting for signup

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!loginData.email_or_phone || !loginData.password) {
      toast.error('Please enter both email/phone and password');
      return;
    }
    
    setLoading(true);
    console.log('🔐 Starting login process...');
    
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      const userData = response.data.user;
      
      if (!userData || !userData.id) {
        throw new Error('Invalid response from server');
      }
      
      // Store auth token for admin API access
      if (response.data.access_token) {
        localStorage.setItem('heartlink_token', response.data.access_token);
      }
      
      localStorage.setItem('user', JSON.stringify(userData));
      await onLogin(userData);
      toast.success(`Welcome back, ${userData.name}!`);
      
      // Track login event
      trackEvent('login', { user_id: userData.id });
      
      setTimeout(() => {
        navigate('/discover');
      }, 100);
    } catch (error) {
      console.error('❌ Login error:', error);
      const errorMessage = error.response?.data?.detail || 'Login failed. Please check your credentials.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Email is compulsory
    if (!signupData.email || !signupData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    // Phone is compulsory
    if (!signupData.phone || signupData.phone.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    
    if (!signupData.password || signupData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (!signupData.name || !signupData.age || !signupData.location) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    if (!signupData.gender) {
      toast.error('Please select your gender');
      return;
    }
    
    // Age must be 18+
    if (parseInt(signupData.age) < 18) {
      toast.error('You must be 18 years or older to use HeartLink');
      return;
    }
    
    // Age verification checkbox required
    if (!signupData.ageVerified) {
      toast.error('Please confirm that you are 18 years or older');
      return;
    }
    
    // Block social media handles in name/bio
    const blockedWords = /telegram|whatsapp|instagram|insta|snapchat|snap|facebook|fb|twitter|discord|signal|skype|t\.me|wa\.me|@\w+/i;
    if (blockedWords.test(signupData.name) || blockedWords.test(signupData.bio)) {
      toast.error('Name ya Bio mein social media handles (Telegram, WhatsApp, Instagram etc.) allowed nahi hai');
      return;
    }
    
    // Block numbers in name
    if (/\d/.test(signupData.name)) {
      toast.error('Name mein numbers allowed nahi hain');
      return;
    }
    
    // Block phone numbers in bio (5+ digits)
    if (signupData.bio && /\d{5,}/.test(signupData.bio)) {
      toast.error('Bio mein phone number ya numeric values allowed nahi hain');
      return;
    }
    
    setLoading(true);
    
    // Track signup started
    trackEvent('signup_started');
    
    try {
      // Upload photo if provided
      let photoURL = null;
      if (profilePicture) {
        toast.loading('Uploading photo...');
        const tempUserId = `temp_${Date.now()}`;
        photoURL = await uploadProfilePicture(tempUserId);
        toast.dismiss();
      }

      const submitData = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests ? signupData.interests.split(',').map(i => i.trim()) : [],
        photos: photoURL ? [photoURL] : [],
        profile_picture: photoURL || '',
        installation_id: getStoredInstallId()
      };
      
      const response = await axios.post(`${API}/auth/signup`, submitData);
      const userData = response.data.user;
      
      // Track signup completed
      trackEvent('signup_completed', { user_id: userData.id });
      
      // Store auth token for admin API access
      if (response.data.access_token) {
        localStorage.setItem('heartlink_token', response.data.access_token);
      }
      
      localStorage.setItem('user', JSON.stringify(userData));
      await onLogin(userData);
      toast.dismiss();
      toast.success(`Welcome to HeartLink, ${userData.name}! Your profile is pending approval.`);
      
      // Apply referral code if provided
      if (signupData.referral_code && signupData.referral_code.trim()) {
        try {
          await axios.post(`${API}/referral/apply`, {
            referral_code: signupData.referral_code.trim().toUpperCase(),
            user_id: userData.id
          });
          toast.success('Referral applied! You got 2 FREE Superlikes!');
        } catch (refErr) {
          console.error('Referral apply error:', refErr);
        }
      }
      
      setTimeout(() => {
        navigate('/mandatory-photo');  // Go to photo upload step after signup
      }, 100);
    } catch (error) {
      console.error('Signup error:', error);
      toast.dismiss();
      const errorMessage = error.response?.data?.detail || 'Signup failed. Please try again.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--m3-surface-container-low)' }}>
      <Toaster position="top-center" richColors />
      
      <div className="w-full max-w-md m3-animate-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] mb-4 m3-gradient-primary" style={{ boxShadow: '0 8px 32px rgba(214,51,108,0.3)' }}>
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="text-3xl font-bold m3-gradient-text">
            HeartLink
          </h1>
          <p className="text-sm text-[#524346] mt-1">Find your perfect match</p>
        </div>

        <div className="rounded-[28px] p-6 sm:p-8" style={{ background: 'var(--m3-surface-container-lowest)', boxShadow: 'var(--m3-elevation-2)' }}>
          {/* Login/Signup Tabs */}
          <div className="flex gap-2 mb-6 p-1 rounded-full" style={{ background: 'var(--m3-surface-container)' }}>
            <Button
              data-testid="login-tab-btn"
              onClick={() => { setIsLogin(true); }}
              className={`flex-1 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                isLogin
                  ? 'bg-white text-[#D6336C] shadow-sm'
                  : 'bg-transparent text-[#524346] hover:text-[#1F1A1C]'
              }`}
            >
              Login
            </Button>
            <Button
              data-testid="signup-tab-btn"
              onClick={() => { setIsLogin(false); }}
              className={`flex-1 py-2.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                !isLogin
                  ? 'bg-white text-[#D6336C] shadow-sm'
                  : 'bg-transparent text-[#524346] hover:text-[#1F1A1C]'
              }`}
            >
              Sign Up
            </Button>
          </div>

          {isLogin ? (
            <>
              {/* Email/Password Login - Only Method */}
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="login-email" className="text-gray-700 font-semibold">Email or Phone</Label>
                  <div className="relative mt-2">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="login-email"
                      data-testid="login-email-input"
                      type="text"
                      placeholder="Enter email or phone"
                      value={loginData.email_or_phone}
                      onChange={(e) => setLoginData({...loginData, email_or_phone: e.target.value})}
                      className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                      required
                    />
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="login-password" className="text-gray-700 font-semibold">Password</Label>
                  <div className="relative mt-2">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="login-password"
                      data-testid="login-password-input"
                      type={showLoginPwd ? "text" : "password"}
                      placeholder="Enter password"
                      value={loginData.password}
                      onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                      className="pl-10 pr-12 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                      required
                    />
                    <button type="button" onClick={() => setShowLoginPwd(!showLoginPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1" data-testid="login-toggle-pwd">
                      {showLoginPwd ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                    </button>
                  </div>
                </div>

                <Button
                  data-testid="login-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full text-white py-6 rounded-full font-semibold text-base tracking-wide transition-all duration-200 active:scale-[0.98]"
                  style={{ background: 'linear-gradient(135deg, #D6336C 0%, #E8590C 100%)', boxShadow: '0 4px 20px rgba(214,51,108,0.35)' }}
                >
                  {loading ? 'Logging in...' : 'Login'}
                </Button>

                <button
                  data-testid="forgot-password-link"
                  type="button"
                  onClick={() => navigate('/forgot-password')}
                  className="w-full text-center text-pink-600 hover:text-pink-700 font-medium mt-4"
                >
                  Forgot Password?
                </button>
              </form>
            </>
          ) : (
            /* Signup Form */
            <form onSubmit={handleSignup} className="space-y-4">
              {/* Profile Photo Upload - MANDATORY */}
              <div className="mb-6">
                <Label className="text-gray-700 font-semibold">Profile Photo <span className="text-red-500">* (Required)</span></Label>
                <div className="mt-2 flex flex-col items-center">
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoSelect}
                    accept="image/*"
                    className="hidden"
                    data-testid="signup-photo-input"
                  />
                  
                  {profilePicturePreview ? (
                    <div className="relative">
                      <img 
                        src={profilePicturePreview} 
                        alt="Profile Preview" 
                        className="w-28 h-28 rounded-full object-cover border-4 border-pink-500 shadow-lg"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setProfilePicture(null);
                          setProfilePicturePreview('');
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg hover:bg-red-600"
                      >
                        <X className="w-4 h-4" />
                      </button>
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                        ✓ Ready
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-28 h-28 rounded-full bg-gradient-to-br from-pink-100 to-orange-100 border-3 border-dashed border-pink-400 flex flex-col items-center justify-center hover:border-pink-600 hover:from-pink-200 hover:to-orange-200 transition-all cursor-pointer"
                    >
                      <Camera className="w-8 h-8 text-pink-500 mb-1" />
                      <span className="text-xs text-pink-600 font-medium">Add Photo</span>
                    </button>
                  )}
                  
                  {!profilePicturePreview && (
                    <p className="text-xs mt-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
                      Optional — you can add photos after signup
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 font-semibold">Name *</Label>
                  <div className="relative mt-2">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      data-testid="signup-name-input"
                      type="text"
                      placeholder="Your name"
                      value={signupData.name}
                      onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                      className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                      required
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-gray-700 font-semibold">Age *</Label>
                  <div className="relative mt-2">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      data-testid="signup-age-input"
                      type="number"
                      placeholder="Age"
                      min="18"
                      max="100"
                      value={signupData.age}
                      onChange={(e) => setSignupData({...signupData, age: e.target.value})}
                      className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                      required
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Email <span className="text-red-500">*</span></Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    data-testid="signup-email-input"
                    type="email"
                    placeholder="your@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Phone Number <span className="text-red-500">*</span></Label>
                <div className="relative mt-2">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    data-testid="signup-phone-input"
                    type="tel"
                    placeholder="10-digit mobile number"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({...signupData, phone: e.target.value.replace(/\D/g, '').slice(0, 10)})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    maxLength={10}
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Password *</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    data-testid="signup-password-input"
                    type={showSignupPwd ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={signupData.password}
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                    className="pl-10 pr-12 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                    minLength={6}
                  />
                  <button type="button" onClick={() => setShowSignupPwd(!showSignupPwd)} className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1" data-testid="signup-toggle-pwd">
                    {showSignupPwd ? <EyeOff className="w-5 h-5 text-gray-400" /> : <Eye className="w-5 h-5 text-gray-400" />}
                  </button>
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Location *</Label>
                {/* State selector */}
                <select
                  data-testid="signup-state-select"
                  value={selectedState}
                  onChange={(e) => {
                    setSelectedState(e.target.value);
                    setSignupData({...signupData, location: ''});
                    setCitySearch('');
                  }}
                  className="w-full mt-2 py-3 px-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 text-sm bg-white"
                >
                  <option value="">Select State</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                {/* City selector with search */}
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 z-10" />
                  <Input
                    data-testid="signup-location-input"
                    type="text"
                    placeholder={selectedState ? "Search city..." : "Select state first"}
                    value={signupData.location || citySearch}
                    onChange={(e) => {
                      setCitySearch(e.target.value);
                      setSignupData({...signupData, location: ''});
                      setShowCityDropdown(true);
                    }}
                    onFocus={() => setShowCityDropdown(true)}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    disabled={!selectedState}
                    required
                  />
                  {showCityDropdown && selectedState && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                      {(citySearch
                        ? (CITIES_BY_STATE[selectedState] || []).filter(c => c.toLowerCase().includes(citySearch.toLowerCase()))
                        : (CITIES_BY_STATE[selectedState] || [])
                      ).slice(0, 15).map(city => (
                        <button
                          key={city}
                          type="button"
                          onClick={() => {
                            setSignupData({...signupData, location: `${city}, ${selectedState}, India`});
                            setCitySearch('');
                            setShowCityDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2.5 hover:bg-pink-50 text-sm text-gray-700 border-b border-gray-50 last:border-0"
                        >
                          {city}
                        </button>
                      ))}
                      {(CITIES_BY_STATE[selectedState] || []).filter(c => citySearch ? c.toLowerCase().includes(citySearch.toLowerCase()) : true).length === 0 && (
                        <p className="px-4 py-3 text-sm text-gray-400">No cities found</p>
                      )}
                    </div>
                  )}
                </div>
                {signupData.location && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {signupData.location}
                  </p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-700 font-semibold">
                    I am <span className="text-red-500">*</span>
                  </Label>
                  <select
                    data-testid="signup-gender-select"
                    value={signupData.gender}
                    onChange={(e) => setSignupData({...signupData, gender: e.target.value})}
                    className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  <p className="text-xs text-orange-500 mt-1">⚠️ Signup ke baad change nahi hoga</p>
                </div>
                <div>
                  <Label className="text-gray-700 font-semibold">Looking for <span className="text-red-500">*</span></Label>
                  <select
                    data-testid="signup-looking-for-select"
                    value={signupData.looking_for}
                    onChange={(e) => setSignupData({...signupData, looking_for: e.target.value})}
                    className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                    required
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="both">Both</option>
                  </select>
                </div>
              </div>

              {/* Age Verification - REQUIRED for Child Safety Compliance */}
              <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="age-verification"
                    data-testid="age-verification-checkbox"
                    checked={signupData.ageVerified || false}
                    onChange={(e) => setSignupData({...signupData, ageVerified: e.target.checked})}
                    className="mt-1 w-5 h-5 accent-pink-500"
                    required
                  />
                  <label htmlFor="age-verification" className="text-sm text-gray-700">
                    <span className="font-bold text-orange-600">Age Verification Required *</span>
                    <br />
                    I confirm that I am <span className="font-bold">18 years or older</span>. 
                    I understand that HeartLink is an adult dating platform and users under 18 are strictly prohibited.
                  </label>
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Relationship Status</Label>
                <select
                  data-testid="signup-relationship-status-select"
                  value={signupData.relationship_status}
                  onChange={(e) => setSignupData({...signupData, relationship_status: e.target.value})}
                  className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                >
                  <option value="Single">Single</option>
                  <option value="Divorced">Divorced</option>
                  <option value="Widowed">Widowed</option>
                  <option value="Separated">Separated</option>
                  <option value="Complicated">Its Complicated</option>
                </select>
              </div>

              {/* Referral Code */}
              <div>
                <Label className="text-gray-700 font-semibold">Referral Code (Optional)</Label>
                <Input
                  data-testid="signup-referral-input"
                  placeholder="Enter friend's referral code"
                  value={signupData.referral_code}
                  onChange={(e) => setSignupData({...signupData, referral_code: e.target.value.toUpperCase()})}
                  className="mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 uppercase tracking-wider"
                />
                {signupData.referral_code && (
                  <p className="text-xs text-green-600 mt-1">You'll get 2 FREE Superlikes for using a referral code!</p>
                )}
              </div>

              <Button
                data-testid="signup-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all"
              >
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
