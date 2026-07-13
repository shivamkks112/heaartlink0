import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, Hash, ArrowRight, Shield, Camera, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { setupRecaptcha, sendOTP, verifyOTP, clearRecaptcha, getStorage, ref, uploadBytes, getDownloadURL } from '@/firebase/config';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env?.REACT_APP_BACKEND_URL;
if (!BACKEND_URL) console.error('⚠️ REACT_APP_BACKEND_URL is not set!');
const API = `${BACKEND_URL}/api`;

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [authMethod, setAuthMethod] = useState('email'); // 'email' or 'phone'
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [countdown, setCountdown] = useState(0);
  
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
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // Cleanup recaptcha on component unmount or auth method change
  useEffect(() => {
    return () => {
      clearRecaptcha();
    };
  }, []);

  // Clear recaptcha when switching auth methods
  useEffect(() => {
    if (authMethod === 'email') {
      clearRecaptcha();
    }
  }, [authMethod]);

  const formatPhoneNumber = (phone) => {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // Ensure it's 10 digits
    if (cleaned.length !== 10) {
      return null;
    }
    
    // Add India country code
    return '+91' + cleaned;
  };

  const handleSendOTP = async () => {
    // Validate phone number
    if (!phoneNumber || phoneNumber.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }

    setLoading(true);
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      
      if (!formattedPhone) {
        toast.error('Invalid phone number format');
        setLoading(false);
        return;
      }
      
      console.log('Sending OTP to:', formattedPhone);
      
      // Clear any existing recaptcha first
      clearRecaptcha();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Setup fresh recaptcha
      const recaptchaVerifier = setupRecaptcha('recaptcha-container');
      
      // Render with timeout (WebView can hang here)
      const renderPromise = recaptchaVerifier.render();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('reCAPTCHA timeout')), 10000)
      );
      
      try {
        await Promise.race([renderPromise, timeoutPromise]);
      } catch (renderError) {
        console.warn('reCAPTCHA render issue:', renderError.message);
        // Continue anyway - invisible reCAPTCHA may still work
      }
      
      const result = await sendOTP(formattedPhone, recaptchaVerifier);
      
      if (result.success) {
        setOtpSent(true);
        setCountdown(60);
        toast.success('OTP sent successfully! Check your phone.');
      } else {
        toast.error(result.error || 'Failed to send OTP');
        clearRecaptcha();
      }
    } catch (error) {
      console.error('Send OTP error:', error);
      
      let errorMessage = 'Failed to send OTP. Please try again.';
      if (error.message?.includes('already been rendered')) {
        errorMessage = 'Please wait a moment and try again.';
        clearRecaptcha();
      } else if (error.message?.includes('too-short')) {
        errorMessage = 'Phone number is too short. Enter 10 digits.';
      } else if (error.message?.includes('timeout')) {
        errorMessage = 'Network slow hai, dobara try karo.';
        clearRecaptcha();
      } else if (error.message?.includes('auth/network-request-failed')) {
        errorMessage = 'Internet connection check karo.';
      }
      
      toast.error(errorMessage);
      clearRecaptcha();
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (countdown > 0) return;
    
    // Clear existing state and recaptcha
    clearRecaptcha();
    setOtp('');
    
    // Wait for cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Send OTP again
    await handleSendOTP();
  };

  const handleVerifyOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const result = await verifyOTP(otp);
      
      if (result.success) {
        const firebaseUser = result.user;
        const formattedPhone = formatPhoneNumber(phoneNumber);
        
        // Check if user exists in our database
        try {
          const loginResponse = await axios.post(`${API}/auth/phone-login`, {
            phone: formattedPhone,
            firebase_uid: firebaseUser.uid
          });
          
          const userData = loginResponse.data.user;
          localStorage.setItem('user', JSON.stringify(userData));
          await onLogin(userData);
          toast.success(`Welcome back, ${userData.name}!`);
          navigate('/discover');
        } catch (error) {
          if (error.response?.status === 404) {
            // User doesn't exist, redirect to complete profile
            toast.info('Please complete your profile');
            navigate('/complete-profile', { 
              state: { 
                phone: formattedPhone, 
                firebase_uid: firebaseUser.uid 
              } 
            });
          } else {
            throw error;
          }
        }
      } else {
        toast.error(result.error || 'Invalid OTP');
      }
    } catch (error) {
      console.error('Verify OTP error:', error);
      
      // Better error messages
      let errorMessage = 'Verification failed. Please try again.';
      if (error.code === 'auth/code-expired') {
        errorMessage = 'OTP expired! Please request a new one.';
      } else if (error.code === 'auth/invalid-verification-code') {
        errorMessage = 'Invalid OTP. Please check and try again.';
      } else if (error.message?.includes('expired')) {
        errorMessage = 'OTP expired! Please request a new one.';
      }
      
      toast.error(errorMessage);
      
      // Clear OTP and allow resend
      setOtp('');
      setCountdown(0);
    } finally {
      setLoading(false);
    }
  };

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
      
      localStorage.setItem('user', JSON.stringify(userData));
      await onLogin(userData);
      toast.success(`Welcome back, ${userData.name}!`);
      
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
    
    // Profile picture is MANDATORY
    if (!profilePicture) {
      toast.error('Profile photo is required! Please upload your photo.');
      return;
    }
    
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
    
    try {
      const submitData = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests ? signupData.interests.split(',').map(i => i.trim()) : []
      };
      
      const response = await axios.post(`${API}/auth/signup`, submitData);
      const userData = response.data.user;
      
      // Upload profile picture (mandatory)
      toast.loading('Uploading photo...');
      const photoURL = await uploadProfilePicture(userData.id);
      
      if (photoURL) {
        // Update user with profile picture
        await axios.patch(`${API}/user/${userData.id}`, {
          profile_picture: photoURL
        });
        userData.profile_picture = photoURL;
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
        navigate('/discover');
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
    <div className="min-h-screen bg-gradient-to-br from-pink-100 via-rose-50 to-orange-100 flex items-center justify-center p-4">
      <Toaster position="top-center" richColors />
      
      {/* Recaptcha container - invisible */}
      <div id="recaptcha-container"></div>
      
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full mb-4 shadow-lg">
            <Heart className="w-10 h-10 text-white" fill="white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">
            HeartLink
          </h1>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Login/Signup Tabs */}
          <div className="flex gap-2 mb-6">
            <Button
              data-testid="login-tab-btn"
              onClick={() => { setIsLogin(true); setOtpSent(false); setAuthMethod('email'); }}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                isLogin
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Login
            </Button>
            <Button
              data-testid="signup-tab-btn"
              onClick={() => { setIsLogin(false); setOtpSent(false); }}
              className={`flex-1 py-3 rounded-xl font-semibold transition-all ${
                !isLogin
                  ? 'bg-gradient-to-r from-pink-500 to-orange-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Sign Up
            </Button>
          </div>

          {isLogin ? (
            <>
              {/* Auth Method Toggle for Login */}
              <div className="flex gap-2 mb-6">
                <button
                  onClick={() => { setAuthMethod('email'); setOtpSent(false); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    authMethod === 'email'
                      ? 'bg-pink-100 text-pink-700 border-2 border-pink-500'
                      : 'bg-gray-50 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                  Email
                </button>
                <button
                  onClick={() => { setAuthMethod('phone'); setOtpSent(false); }}
                  className={`flex-1 py-2 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                    authMethod === 'phone'
                      ? 'bg-pink-100 text-pink-700 border-2 border-pink-500'
                      : 'bg-gray-50 text-gray-600 border-2 border-transparent'
                  }`}
                >
                  <Phone className="w-4 h-4" />
                  Phone OTP
                </button>
              </div>

              {authMethod === 'email' ? (
                /* Email/Password Login */
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
                        type="password"
                        placeholder="Enter password"
                        value={loginData.password}
                        onChange={(e) => setLoginData({...loginData, password: e.target.value})}
                        className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                        required
                      />
                    </div>
                  </div>

                  <Button
                    data-testid="login-submit-btn"
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all"
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
              ) : (
                /* Phone OTP Login */
                <div className="space-y-4">
                  {!otpSent ? (
                    <>
                      <div>
                        <Label className="text-gray-700 font-semibold">Phone Number</Label>
                        <div className="relative mt-2">
                          <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            data-testid="phone-input"
                            type="tel"
                            placeholder="Enter 10-digit mobile number"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                            className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                            maxLength={10}
                          />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">We will send you an OTP to verify</p>
                      </div>

                      <Button
                        data-testid="send-otp-btn"
                        onClick={handleSendOTP}
                        disabled={loading || phoneNumber.length !== 10}
                        className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all"
                      >
                        {loading ? 'Sending OTP...' : 'Send OTP'}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="text-center mb-4">
                        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-3">
                          <Shield className="w-8 h-8 text-green-600" />
                        </div>
                        <p className="text-gray-600">OTP sent to <span className="font-semibold">+91 {phoneNumber}</span></p>
                      </div>

                      <div>
                        <Label className="text-gray-700 font-semibold">Enter OTP</Label>
                        <div className="relative mt-2">
                          <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                          <Input
                            data-testid="otp-input"
                            type="text"
                            placeholder="Enter 6-digit OTP"
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500 text-center text-2xl tracking-widest"
                            maxLength={6}
                          />
                        </div>
                      </div>

                      <Button
                        data-testid="verify-otp-btn"
                        onClick={handleVerifyOTP}
                        disabled={loading || otp.length !== 6}
                        className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all"
                      >
                        {loading ? 'Verifying...' : 'Verify & Login'}
                      </Button>

                      <div className="flex justify-between items-center mt-4">
                        <button
                          onClick={() => { 
                            setOtpSent(false); 
                            setOtp(''); 
                            clearRecaptcha();
                          }}
                          className="text-gray-600 hover:text-gray-800 text-sm"
                        >
                          ← Change Number
                        </button>
                        <button
                          onClick={handleResendOTP}
                          disabled={countdown > 0 || loading}
                          className={`text-sm font-medium ${
                            countdown > 0 ? 'text-gray-400' : 'text-pink-600 hover:text-pink-700'
                          }`}
                        >
                          {countdown > 0 ? `Resend in ${countdown}s` : 'Resend OTP'}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
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
                    <p className="text-xs text-orange-600 mt-2 flex items-center gap-1">
                      <span className="text-red-500">⚠</span> Photo is required for registration
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
                    type="password"
                    placeholder="Min 6 characters"
                    value={signupData.password}
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Location *</Label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    data-testid="signup-location-input"
                    type="text"
                    placeholder="Your city"
                    value={signupData.location}
                    onChange={(e) => setSignupData({...signupData, location: e.target.value})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
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
