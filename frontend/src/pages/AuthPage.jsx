import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, ArrowRight, Shield, Camera, Upload, X, Eye, EyeOff, MessageCircle } from 'lucide-react';
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
  const [signupStep, setSignupStep] = useState(1); // 1 = Email+OTP, 2 = Name+Gender+Password
  
  // Email OTP verification states
  const [otpStep, setOtpStep] = useState(false);  // true = show OTP input
  const [otpCode, setOtpCode] = useState('');
  const [otpSending, setOtpSending] = useState(false);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);

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

  // OTP cooldown timer
  useEffect(() => {
    if (otpCooldown <= 0) return;
    const timer = setTimeout(() => setOtpCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [otpCooldown]);

  // Send OTP to email
  const handleSendOtp = async () => {
    if (otpSending || otpCooldown > 0) return;
    if (!signupData.email || !signupData.email.includes('@')) {
      toast.error('Please enter a valid email address first');
      return;
    }
    setOtpSending(true);
    try {
      await axios.post(`${API}/auth/send-signup-otp`, { email: signupData.email }, { timeout: 15000 });
      toast.success('OTP sent to your email!');
      setOtpStep(true);
      setOtpCooldown(60); // 60 sec cooldown for resend
    } catch (err) {
      if (err.response?.data?.detail?.includes('already registered')) {
        toast.error('This email is already registered. Please login instead.');
      } else {
        toast.error(err.response?.data?.detail || 'Failed to send OTP. Please try again.');
      }
    } finally {
      setOtpSending(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setOtpSending(true);
    try {
      const res = await axios.post(`${API}/auth/verify-signup-otp`, { email: signupData.email, otp: otpCode }, { timeout: 15000 });
      if (res.data.verified) {
        setOtpVerified(true);
        setOtpStep(false);
        toast.success('Email verified successfully!');
        trackEvent('otp_verified');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'OTP verification failed. Please try again.');
    } finally {
      setOtpSending(false);
    }
  };


  // Countdown timer for OTP resend
  // Phone number formatting for signup

  const handleLogin = async (e) => {
    e.preventDefault();
    if (loading) return;
    
    if (!loginData.email_or_phone || !loginData.password) {
      toast.error('Please enter both email/phone and password');
      return;
    }
    
    setLoading(true);
    
    try {
      const response = await axios.post(`${API}/auth/login`, loginData, { timeout: 15000 });
      const userData = response.data.user;
      
      if (!userData || !userData.id) {
        throw new Error('Invalid response from server');
      }
      
      // Store auth token
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
      console.error('Login error:', error);
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Connection timed out. Please check your internet and try again.');
      } else if (!error.response) {
        toast.error('Please check your internet connection and try again.');
      } else if (error.response?.status === 401) {
        toast.error('Invalid email/phone or password. Please try again.');
      } else if (error.response?.status === 429) {
        toast.error('Too many login attempts. Please wait a moment.');
      } else {
        toast.error(error.response?.data?.detail || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Prevent double-tap
    if (loading) return;
    
    // Email OTP must be verified first
    if (!otpVerified) {
      toast.error('Please verify your email with OTP first');
      return;
    }
    
    // Email is compulsory
    if (!signupData.email || !signupData.email.includes('@')) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (!signupData.password || signupData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    if (!signupData.name || !signupData.age) {
      toast.error('Please fill in name and age');
      return;
    }
    
    if (!signupData.gender) {
      toast.error('Please select your gender');
      return;
    }
    
    // Auto-set looking_for if not set
    if (!signupData.looking_for) {
      signupData.looking_for = signupData.gender === 'male' ? 'female' : signupData.gender === 'female' ? 'male' : 'both';
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
      toast.error('Name ya Bio mein social media handles allowed nahi hai');
      return;
    }
    
    // Block numbers in name
    if (/\d/.test(signupData.name)) {
      toast.error('Name mein numbers allowed nahi hain');
      return;
    }
    
    // Block phone numbers in bio (5+ digits)
    if (signupData.bio && /\d{5,}/.test(signupData.bio)) {
      toast.error('Bio mein phone number allowed nahi hain');
      return;
    }
    
    setLoading(true);
    
    // Track signup started
    trackEvent('signup_started');
    
    try {
      // Upload photo if provided — failure should NOT block signup
      let photoURL = null;
      if (profilePicture) {
        try {
          toast.loading('Uploading photo...');
          const tempUserId = `temp_${Date.now()}`;
          photoURL = await uploadProfilePicture(tempUserId);
          toast.dismiss();
        } catch (photoErr) {
          toast.dismiss();
          console.warn('Photo upload failed, continuing without photo:', photoErr);
          // Continue signup without photo
        }
      }

      const submitData = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests ? signupData.interests.split(',').map(i => i.trim()) : [],
        photos: photoURL ? [photoURL] : [],
        profile_picture: photoURL || '',
        installation_id: getStoredInstallId()
      };

      // Build profile prompts from signup form
      const profilePrompts = [];
      if (signupData.prompt1_q && signupData.prompt1_a?.trim()) {
        profilePrompts.push({ question: signupData.prompt1_q, answer: signupData.prompt1_a.trim() });
      }
      if (signupData.prompt2_q && signupData.prompt2_a?.trim()) {
        profilePrompts.push({ question: signupData.prompt2_q, answer: signupData.prompt2_a.trim() });
      }
      if (profilePrompts.length > 0) {
        submitData.profile_prompts = profilePrompts;
      }
      // Clean temp prompt fields
      delete submitData.prompt1_q; delete submitData.prompt1_a;
      delete submitData.prompt2_q; delete submitData.prompt2_a;
      
      // API call with timeout (15 seconds)
      const response = await axios.post(`${API}/auth/signup`, submitData, { timeout: 15000 });
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
      toast.success(`Welcome to HeartLink, ${userData.name}!`);

      // Save profile prompts if user filled them during signup
      if (submitData.profile_prompts?.length > 0) {
        try {
          await axios.post(`${API}/profile-prompts/${userData.id}`, { prompts: submitData.profile_prompts });
        } catch (e) { console.warn('Prompts save after signup:', e); }
      }
      
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
      
      // User-friendly error messages
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        toast.error('Connection timed out. Please check your internet and try again.');
      } else if (!error.response) {
        toast.error('Please check your internet connection and try again.');
      } else if (error.response?.status === 400) {
        const detail = error.response.data?.detail || '';
        if (detail.includes('already') || detail.includes('exists')) {
          toast.error('This email is already registered. Please login instead.');
        } else {
          toast.error(detail || 'Please check your details and try again.');
        }
      } else if (error.response?.status === 429) {
        toast.error('Too many attempts. Please try again after some time.');
      } else {
        toast.error('Something went wrong. Please try again.');
      }
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
              <form onSubmit={handleLogin} className="space-y-4" autoComplete="off">
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
                      autoComplete="off"
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
                      autoComplete="new-password"
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
            /* Signup Form — Simplified 2-Step */
            <form onSubmit={handleSignup} className="space-y-4">
              
              {/* Step indicator */}
              <div className="flex items-center justify-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${signupStep >= 1 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'}`}>1</div>
                <div className={`w-12 h-1 rounded ${signupStep >= 2 ? 'bg-pink-500' : 'bg-gray-200'}`} />
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${signupStep >= 2 ? 'bg-pink-500 text-white' : 'bg-gray-200 text-gray-500'}`}>2</div>
              </div>
              
              {signupStep === 1 && (
                <>
                  <p className="text-center text-sm text-gray-500 mb-2">Step 1: Verify your email</p>
                  
                  {/* Email + OTP */}
                  <div>
                    <Label className="text-gray-700 font-semibold">Email <span className="text-red-500">*</span></Label>
                    <div className="relative mt-2">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                      <Input
                        data-testid="signup-email-input"
                        type="email"
                        placeholder="your@email.com"
                        value={signupData.email}
                        onChange={(e) => { setSignupData({...signupData, email: e.target.value}); if (otpVerified) { setOtpVerified(false); setOtpStep(false); setOtpCode(''); } }}
                        className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                        required
                        disabled={otpVerified}
                      />
                      {!otpVerified && (
                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={otpSending || otpCooldown > 0 || !signupData.email?.includes('@')}
                          data-testid="send-otp-btn"
                          className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white disabled:opacity-50 transition-all"
                          style={{ background: 'linear-gradient(135deg, #ec4899, #f97316)' }}
                        >
                          {otpSending ? '...' : otpCooldown > 0 ? `${otpCooldown}s` : otpStep ? 'Resend' : 'Verify'}
                        </button>
                      )}
                      {otpVerified && (
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm font-semibold" data-testid="email-verified-badge">Verified</span>
                      )}
                    </div>
                    
                    {otpStep && !otpVerified && (
                      <div className="mt-2 flex gap-2" data-testid="otp-input-section">
                        <Input
                          data-testid="otp-input"
                          type="text"
                          inputMode="numeric"
                          placeholder="Enter 6-digit OTP"
                          value={otpCode}
                          onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="flex-1 py-4 rounded-xl border-2 border-gray-200 focus:border-pink-500 text-center text-lg tracking-[0.5em] font-mono"
                          maxLength={6}
                        />
                        <button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={otpSending || otpCode.length !== 6}
                          data-testid="verify-otp-btn"
                          className="px-5 py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-50"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                        >
                          {otpSending ? '...' : 'Verify'}
                        </button>
                      </div>
                    )}
                    
                    <p className="text-xs text-gray-400 mt-1">Check spam folder if OTP nahi aaya</p>
                  </div>
                  
                  {/* Next Step Button */}
                  <Button
                    type="button"
                    disabled={!otpVerified}
                    onClick={() => setSignupStep(2)}
                    data-testid="signup-next-step-btn"
                    className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg disabled:opacity-50"
                  >
                    {otpVerified ? 'Next →' : 'Verify email first'}
                  </Button>
                </>
              )}
              
              {signupStep === 2 && (
                <>
                  <p className="text-center text-sm text-gray-500 mb-2">Step 2: Quick profile setup</p>
                  
                  {/* Verified email badge */}
                  <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2 flex items-center gap-2">
                    <Mail className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700">{signupData.email}</span>
                    <span className="text-xs text-green-500 ml-auto">Verified</span>
                  </div>
                  
                  {/* Name */}
                  <div>
                    <Label className="text-gray-700 font-semibold">Your Name *</Label>
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
                        autoFocus
                      />
                    </div>
                  </div>
                  
                  {/* Password */}
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
                  
                  {/* Gender + Age */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-gray-700 font-semibold">I am <span className="text-red-500">*</span></Label>
                      <select
                        data-testid="signup-gender-select"
                        value={signupData.gender}
                        onChange={(e) => {
                          const g = e.target.value;
                          setSignupData({...signupData, gender: g, looking_for: g === 'male' ? 'female' : g === 'female' ? 'male' : ''});
                        }}
                        className="w-full mt-2 p-3 rounded-xl border-2 border-gray-200 focus:border-pink-500 bg-white"
                        required
                      >
                        <option value="">Select</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
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
                  
                  {/* Girls Free Premium Badge */}
                  {signupData.gender === 'female' && (
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-3 text-center animate-fade-in">
                      <p className="text-sm font-bold text-amber-700">Girls get 1 Month FREE Premium!</p>
                      <p className="text-[10px] text-amber-600">See Who Liked, Crush Reveal, Extra Boosts — all FREE</p>
                    </div>
                  )}

                  {/* Profile Prompts — Conversation Starters (shown for girls prominently, optional for boys) */}
                  <div className={`border-2 rounded-xl p-3 space-y-2 ${signupData.gender === 'female' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-blue-500" />
                      <p className="text-sm font-semibold text-gray-800">Conversation Starters {signupData.gender === 'female' && <span className="text-[10px] text-blue-500 ml-1">helps you get better matches!</span>}</p>
                    </div>
                    <p className="text-[10px] text-gray-500">Pick a question and answer it — boys can start chats based on this</p>

                    {/* Prompt 1 */}
                    <select
                      value={signupData.prompt1_q || ''}
                      onChange={(e) => setSignupData({...signupData, prompt1_q: e.target.value})}
                      className="w-full p-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                      data-testid="signup-prompt1-select"
                    >
                      <option value="">Pick a question...</option>
                      <option value="My ideal weekend looks like...">My ideal weekend looks like...</option>
                      <option value="The way to my heart is...">The way to my heart is...</option>
                      <option value="I'm looking for someone who...">I'm looking for someone who...</option>
                      <option value="My hidden talent is...">My hidden talent is...</option>
                      <option value="Best travel story...">Best travel story...</option>
                      <option value="My comfort food is...">My comfort food is...</option>
                      <option value="I geek out on...">I geek out on...</option>
                      <option value="After work you'll find me...">After work you'll find me...</option>
                    </select>
                    {signupData.prompt1_q && (
                      <input
                        type="text"
                        value={signupData.prompt1_a || ''}
                        onChange={(e) => setSignupData({...signupData, prompt1_a: e.target.value})}
                        placeholder="Your answer..."
                        maxLength={150}
                        className="w-full p-2.5 rounded-lg border border-gray-200 text-sm"
                        data-testid="signup-prompt1-answer"
                      />
                    )}

                    {/* Prompt 2 (optional) */}
                    {signupData.prompt1_q && signupData.prompt1_a && (
                      <>
                        <select
                          value={signupData.prompt2_q || ''}
                          onChange={(e) => setSignupData({...signupData, prompt2_q: e.target.value})}
                          className="w-full p-2.5 rounded-lg border border-gray-200 text-sm bg-white"
                          data-testid="signup-prompt2-select"
                        >
                          <option value="">Add another (optional)...</option>
                          {["My ideal weekend looks like...","The way to my heart is...","I'm looking for someone who...","My hidden talent is...","Best travel story...","My comfort food is...","I geek out on...","After work you'll find me..."]
                            .filter(q => q !== signupData.prompt1_q)
                            .map((q, i) => <option key={i} value={q}>{q}</option>)}
                        </select>
                        {signupData.prompt2_q && (
                          <input
                            type="text"
                            value={signupData.prompt2_a || ''}
                            onChange={(e) => setSignupData({...signupData, prompt2_a: e.target.value})}
                            placeholder="Your answer..."
                            maxLength={150}
                            className="w-full p-2.5 rounded-lg border border-gray-200 text-sm"
                            data-testid="signup-prompt2-answer"
                          />
                        )}
                      </>
                    )}
                  </div>
                  
                  {/* Age Verification */}
                  <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="age-verification"
                        data-testid="age-verification-checkbox"
                        checked={signupData.ageVerified || false}
                        onChange={(e) => setSignupData({...signupData, ageVerified: e.target.checked})}
                        className="mt-0.5 w-5 h-5 accent-pink-500"
                        required
                      />
                      <label htmlFor="age-verification" className="text-xs text-gray-700">
                        I confirm I am <span className="font-bold">18+</span>. HeartLink is for adults only.
                      </label>
                    </div>
                  </div>
                  
                  {/* Hidden fields — auto-set defaults for simplified flow */}
                  
                  {/* Back + Submit buttons */}
                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setSignupStep(1)}
                      className="px-4 py-6 rounded-xl"
                    >
                      ← Back
                    </Button>
                    <Button
                      data-testid="signup-submit-btn"
                      type="submit"
                      disabled={loading}
                      className="flex-1 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg"
                    >
                      {loading ? 'Creating...' : 'Join HeartLink'}
                    </Button>
                  </div>
                  
                  <p className="text-[10px] text-gray-400 text-center">Photo, bio, location — sab baad mein add kar sakte ho</p>
                </>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;
