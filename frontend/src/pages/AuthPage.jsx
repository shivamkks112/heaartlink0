import { useState, useEffect } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-app-2.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const AuthPage = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
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
    bio: '',
    location: '',
    interests: ''
  });

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API}/auth/login`, loginData);
      toast.success('Login successful!');
      onLogin(response.data.user);
      navigate('/discover');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const data = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests.split(',').map(i => i.trim()).filter(i => i)
      };
      const response = await axios.post(`${API}/auth/signup`, data);
      toast.success('Account created successfully!');
      onLogin(response.data.user);
      navigate('/discover');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleUser = async (user) => {
    try {
      // Try login first
      console.log('🔍 Checking if user exists in backend...');
      const loginResponse = await axios.post(`${API}/auth/login`, {
        email_or_phone: user.email,
        password: user.uid  // Use Firebase UID as password
      });
      console.log('✅ User exists, logging in...');
      toast.success('Welcome back!');
      onLogin(loginResponse.data.user);
      navigate('/discover');
    } catch (loginError) {
      console.log('ℹ️ User not found, creating new account...');
      // User doesn't exist, create account
      const signupData = {
        email: user.email,
        phone: user.phoneNumber || '',
        password: user.uid,
        name: user.displayName || 'User',
        age: 25,  // Default, user can update
        gender: 'Male',  // Default
        looking_for: 'Female',  // Default
        bio: '',
        location: '',
        interests: []
      };
      
      const signupResponse = await axios.post(`${API}/auth/signup`, signupData);
      console.log('✅ Account created successfully');
      toast.success('Account created with Google! 🎉');
      onLogin(signupResponse.data.user);
      navigate('/discover');
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      console.log('🔍 Starting Google Sign-In...');
      console.log('Platform check...');
      
      let user;
      
      // Try native first if on mobile app
      const isNative = isNativePlatform();
      console.log('Is Native Platform?', isNative);
      
      if (isNative) {
        console.log('📱 Attempting NATIVE Google Auth...');
        try {
          user = await nativeGoogleSignIn();
          console.log('✅ Native sign-in successful:', user);
        } catch (nativeError) {
          console.error('❌ Native sign-in failed:', nativeError);
          // Fallback to Firebase
          console.log('⚠️ Falling back to Firebase method...');
          const result = await signInWithPopup(auth, googleProvider);
          user = result.user;
        }
      } else {
        // Web browser - use Firebase
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        
        if (isMobile) {
          console.log('📱 Using redirect method for mobile browser...');
          await signInWithRedirect(auth, googleProvider);
          return; // Result will be handled by useEffect
        } else {
          console.log('💻 Using popup method for desktop...');
          const result = await signInWithPopup(auth, googleProvider);
          user = result.user;
        }
      }
      
      // Handle user login/signup
      if (user) {
        await handleGoogleUser(user);
      }
    } catch (error) {
      console.error('❌ Google Sign-In error:', error);
      console.error('Error code:', error.code);
      console.error('Error message:', error.message);
      
      // Better error messages
      if (error.code === 'auth/popup-closed-by-user') {
        toast.error('Sign-in cancelled');
      } else if (error.code === 'auth/popup-blocked') {
        toast.error('Popup blocked! Please allow popups for this site');
      } else if (error.code === 'auth/unauthorized-domain') {
        toast.error('Domain not authorized. Please contact support.');
        console.error('⚠️ Add this domain to Firebase Console → Authentication → Settings → Authorized domains');
      } else {
        toast.error('Google Sign-In failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 px-4 py-12">
      <Toaster position="top-center" />
      
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-3 rounded-2xl">
              <Heart className="w-10 h-10 text-white" fill="white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 to-orange-600 bg-clip-text text-transparent">
            HeartLink
          </h1>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <div className="flex gap-2 mb-6">
            <Button
              data-testid="login-tab-btn"
              onClick={() => setIsLogin(true)}
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
              onClick={() => setIsLogin(false)}
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
            <form onSubmit={handleSignup} className="space-y-4 max-h-[500px] overflow-y-auto pr-2">
              <div>
                <Label htmlFor="signup-name" className="text-gray-700 font-semibold">Name</Label>
                <div className="relative mt-2">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-name"
                    data-testid="signup-name-input"
                    type="text"
                    placeholder="Your name"
                    value={signupData.name}
                    onChange={(e) => setSignupData({...signupData, name: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-email" className="text-gray-700 font-semibold">Email</Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-email"
                    data-testid="signup-email-input"
                    type="email"
                    placeholder="your@email.com"
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-phone" className="text-gray-700 font-semibold">Phone Number</Label>
                <div className="relative mt-2">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-phone"
                    data-testid="signup-phone-input"
                    type="tel"
                    placeholder="+91 XXXXX XXXXX"
                    value={signupData.phone}
                    onChange={(e) => setSignupData({...signupData, phone: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-password" className="text-gray-700 font-semibold">Password</Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-password"
                    data-testid="signup-password-input"
                    type="password"
                    placeholder="Create password"
                    value={signupData.password}
                    onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="signup-age" className="text-gray-700 font-semibold">Age</Label>
                  <div className="relative mt-2">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="signup-age"
                      data-testid="signup-age-input"
                      type="number"
                      placeholder="Age"
                      value={signupData.age}
                      onChange={(e) => setSignupData({...signupData, age: e.target.value})}
                      className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                      required
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="signup-gender" className="text-gray-700 font-semibold">Gender</Label>
                  <select
                    id="signup-gender"
                    data-testid="signup-gender-select"
                    value={signupData.gender}
                    onChange={(e) => setSignupData({...signupData, gender: e.target.value})}
                    className="w-full mt-2 py-3 px-4 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none"
                  >
                    <option>Male</option>
                    <option>Female</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="signup-looking" className="text-gray-700 font-semibold">Looking For</Label>
                <select
                  id="signup-looking"
                  data-testid="signup-looking-select"
                  value={signupData.looking_for}
                  onChange={(e) => setSignupData({...signupData, looking_for: e.target.value})}
                  className="w-full mt-2 py-3 px-4 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none"
                >
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </div>

              <div>
                <Label htmlFor="signup-location" className="text-gray-700 font-semibold">Location</Label>
                <div className="relative mt-2">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-location"
                    data-testid="signup-location-input"
                    type="text"
                    placeholder="City, State"
                    value={signupData.location}
                    onChange={(e) => setSignupData({...signupData, location: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-interests" className="text-gray-700 font-semibold">Interests (comma-separated)</Label>
                <div className="relative mt-2">
                  <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="signup-interests"
                    data-testid="signup-interests-input"
                    type="text"
                    placeholder="Music, Travel, Food"
                    value={signupData.interests}
                    onChange={(e) => setSignupData({...signupData, interests: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-bio" className="text-gray-700 font-semibold">Bio</Label>
                <textarea
                  id="signup-bio"
                  data-testid="signup-bio-input"
                  placeholder="Tell us about yourself..."
                  value={signupData.bio}
                  onChange={(e) => setSignupData({...signupData, bio: e.target.value})}
                  className="w-full mt-2 py-3 px-4 rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none h-24 resize-none"
                />
              </div>

              <Button
                data-testid="signup-submit-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg transform hover:scale-105 transition-all"
              >
                {loading ? 'Creating Account...' : 'Sign Up'}
              </Button>
            </form>
          )}
        </div>

        <button
          data-testid="back-home-btn"
          onClick={() => navigate('/')}
          className="mt-6 w-full text-center text-gray-600 hover:text-gray-800 font-medium"
        >
          Back to Home
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
