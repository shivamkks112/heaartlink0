import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, Hash, ArrowRight, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { setupRecaptcha, sendOTP, verifyOTP, clearRecaptcha } from '@/firebase/config';

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
    gender: 'Male',
    looking_for: 'Female',
    relationship_status: 'Single',
    bio: '',
    location: '',
    interests: ''
  });

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
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Setup fresh recaptcha
      const recaptchaVerifier = setupRecaptcha('recaptcha-container');
      
      // Render the recaptcha (needed for invisible recaptcha)
      await recaptchaVerifier.render();
      
      const result = await sendOTP(formattedPhone, recaptchaVerifier);
      
      if (result.success) {
        setOtpSent(true);
        setCountdown(60); // 60 seconds countdown
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
      toast.error('Verification failed. Please try again.');
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
    
    if (!signupData.email && !signupData.phone) {
      toast.error('Please enter either email or phone number');
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
    
    setLoading(true);
    
    try {
      const submitData = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests ? signupData.interests.split(',').map(i => i.trim()) : []
      };
      
      const response = await axios.post(`${API}/auth/signup`, submitData);
      const userData = response.data.user;
      
      localStorage.setItem('user', JSON.stringify(userData));
      await onLogin(userData);
      toast.success(`Welcome to HeartLink, ${userData.name}!`);
      
      setTimeout(() => {
        navigate('/discover');
      }, 100);
    } catch (error) {
      console.error('Signup error:', error);
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
                <Label className="text-gray-700 font-semibold">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    data-testid="signup-email-input"
                    type="email"
                    placeholder="your@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                    className="pl-10 py-5 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <Label className="text-gray-700 font-semibold">Phone Number</Label>
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
                  <Label className="text-gray-700 font-semibold">I am</Label>
                  <select
                    data-testid="signup-gender-select"
                    value={signupData.gender}
                    onChange={(e) => setSignupData({...signupData, gender: e.target.value})}
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
                    data-testid="signup-looking-for-select"
                    value={signupData.looking_for}
                    onChange={(e) => setSignupData({...signupData, looking_for: e.target.value})}
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
