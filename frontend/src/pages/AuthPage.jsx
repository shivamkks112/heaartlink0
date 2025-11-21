import { useState } from 'react';
import axios from 'axios';
import { Heart, Mail, Phone, Lock, User, MapPin, Calendar, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-dating-1.preview.emergentagent.com';
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
    
    if (!loginData.email_or_phone || !loginData.password) {
      toast.error('Please enter both email/phone and password');
      return;
    }
    
    setLoading(true);
    console.log('🔐 Starting login process...');
    console.log('📧 Email/Phone:', loginData.email_or_phone);
    
    try {
      console.log('📤 Sending login request to:', `${API}/auth/login`);
      const response = await axios.post(`${API}/auth/login`, loginData);
      console.log('✅ Login response:', response.data);
      
      const userData = response.data.user;
      
      if (!userData || !userData.id) {
        console.error('❌ Invalid user data received:', userData);
        throw new Error('Invalid response from server');
      }
      
      console.log('💾 Storing user in localStorage:', userData.id);
      // Store in localStorage first
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('🔄 Updating app state...');
      // Then update state
      await onLogin(userData);
      
      console.log('🎉 Login successful!');
      toast.success(`Welcome back, ${userData.name}!`);
      
      // Navigate after state is set
      setTimeout(() => {
        console.log('🔀 Navigating to /discover');
        navigate('/discover');
      }, 100);
    } catch (error) {
      console.error('❌ Login error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      if (error.response?.status === 401) {
        toast.error('Invalid email/phone or password');
      } else if (error.response?.status === 500) {
        toast.error('Server error. Please try again later.');
      } else if (error.code === 'ERR_NETWORK') {
        toast.error('Network error. Please check your internet connection.');
      } else {
        toast.error(error.response?.data?.detail || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    // Validate form data before submission
    if (!signupData.email || signupData.email.trim().length === 0) {
      toast.error('Please provide your email address');
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(signupData.email)) {
      toast.error('Please enter a valid email address');
      return;
    }
    
    if (!signupData.name || signupData.name.trim().length < 2) {
      toast.error('Please enter a valid name (at least 2 characters)');
      return;
    }
    
    if (!signupData.password || signupData.password.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }
    
    if (!signupData.age || parseInt(signupData.age) < 18 || parseInt(signupData.age) > 100) {
      toast.error('Age must be between 18 and 100');
      return;
    }
    
    if (!signupData.location || signupData.location.trim().length < 2) {
      toast.error('Please enter your location');
      return;
    }
    
    setLoading(true);
    console.log('🚀 Starting signup process...');
    console.log('📧 Email:', signupData.email);
    console.log('📱 Phone:', signupData.phone);
    console.log('👤 Name:', signupData.name);
    
    try {
      const data = {
        ...signupData,
        age: parseInt(signupData.age),
        interests: signupData.interests.split(',').map(i => i.trim()).filter(i => i)
      };
      
      console.log('📤 Sending signup request to:', `${API}/auth/signup`);
      const response = await axios.post(`${API}/auth/signup`, data);
      console.log('✅ Signup response:', response.data);
      
      const userData = response.data.user;
      
      if (!userData || !userData.id) {
        console.error('❌ Invalid user data received:', userData);
        throw new Error('Invalid response from server');
      }
      
      console.log('💾 Storing user in localStorage:', userData.id);
      // Store in localStorage first
      localStorage.setItem('user', JSON.stringify(userData));
      
      console.log('🔄 Updating app state...');
      // Then update state
      await onLogin(userData);
      
      console.log('🎉 Signup successful! User created:', userData.id);
      toast.success(`Welcome ${userData.name}! Account created successfully!`);
      
      // Navigate after state is set
      setTimeout(() => {
        console.log('🔀 Navigating to /discover');
        navigate('/discover');
      }, 100);
    } catch (error) {
      console.error('❌ Signup error:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      
      if (error.response?.status === 400) {
        // Validation error from backend
        toast.error(error.response.data.detail || 'Invalid signup data');
      } else if (error.response?.status === 500) {
        // Server error
        toast.error('Server error. Please try again later.');
      } else if (error.code === 'ERR_NETWORK') {
        // Network error
        toast.error('Network error. Please check your internet connection.');
      } else {
        toast.error(error.response?.data?.detail || 'Signup failed. Please try again.');
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
                <Label htmlFor="signup-email" className="text-gray-700 font-semibold">Email *</Label>
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
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="signup-phone" className="text-gray-700 font-semibold">Phone Number (Optional)</Label>
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
