import { useState } from 'react';
import axios from 'axios';
import { Heart, Mail, Lock, ArrowLeft, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'https://heartlink-dating.preview.emergentagent.com';
const API = `${BACKEND_URL}/api`;

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: New Password
  const [loading, setLoading] = useState(false);
  const [otpCode, setOtpCode] = useState(''); // Store OTP to display
  
  const [formData, setFormData] = useState({
    email_or_phone: '',
    reset_code: '',
    new_password: '',
    confirm_password: ''
  });

  const handleRequestCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await axios.post(`${API}/auth/forgot-password`, {
        email_or_phone: formData.email_or_phone
      });
      
      // Store OTP code from response
      if (response.data.dev_otp) {
        setOtpCode(response.data.dev_otp);
        toast.success('Reset code generated! See below.');
      } else {
        toast.success('Reset code sent! Check your email/phone');
      }
      
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(otpCode);
    toast.success('OTP copied to clipboard!');
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      await axios.post(`${API}/auth/verify-reset-code`, null, {
        params: {
          email_or_phone: formData.email_or_phone,
          reset_code: formData.reset_code
        }
      });
      
      toast.success('Code verified! Set new password');
      setStep(3);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();

    if (formData.new_password !== formData.confirm_password) {
      toast.error('Passwords do not match');
      return;
    }

    if (formData.new_password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${API}/auth/reset-password`, {
        email_or_phone: formData.email_or_phone,
        reset_code: formData.reset_code,
        new_password: formData.new_password
      });
      
      toast.success('Password reset successful! Please login');
      setTimeout(() => navigate('/auth'), 2000);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to reset password');
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
            Reset Password
          </h1>
          <p className="text-gray-600 mt-2">
            {step === 1 && 'Enter your email or phone number'}
            {step === 2 && 'Enter the code sent to you'}
            {step === 3 && 'Create a new password'}
          </p>
        </div>

        <div className="bg-white rounded-3xl shadow-2xl p-8">
          {/* Progress Steps */}
          <div className="flex items-center justify-between mb-8">
            <div className={`flex items-center gap-2 ${step >= 1 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 1 ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}>
                {step > 1 ? <CheckCircle className="w-5 h-5" /> : '1'}
              </div>
              <span className="text-sm font-semibold hidden sm:inline">Email</span>
            </div>
            
            <div className={`flex-1 h-1 mx-2 ${step >= 2 ? 'bg-pink-600' : 'bg-gray-200'}`}></div>
            
            <div className={`flex items-center gap-2 ${step >= 2 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 2 ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}>
                {step > 2 ? <CheckCircle className="w-5 h-5" /> : '2'}
              </div>
              <span className="text-sm font-semibold hidden sm:inline">Code</span>
            </div>
            
            <div className={`flex-1 h-1 mx-2 ${step >= 3 ? 'bg-pink-600' : 'bg-gray-200'}`}></div>
            
            <div className={`flex items-center gap-2 ${step >= 3 ? 'text-pink-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step >= 3 ? 'bg-pink-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="text-sm font-semibold hidden sm:inline">Reset</span>
            </div>
          </div>

          {/* Step 1: Email/Phone */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <Label htmlFor="email-phone" className="text-gray-700 font-semibold">
                  Email or Phone Number
                </Label>
                <div className="relative mt-2">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email-phone"
                    data-testid="forgot-email-input"
                    type="text"
                    placeholder="Enter your email or phone"
                    value={formData.email_or_phone}
                    onChange={(e) => setFormData({...formData, email_or_phone: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <Button
                data-testid="send-code-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg"
              >
                {loading ? 'Sending...' : 'Send Reset Code'}
              </Button>
            </form>
          )}

          {/* Step 2: Verify Code */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              {/* OTP Display Box - Development Mode */}
              {otpCode && (
                <div className="bg-gradient-to-r from-pink-50 to-orange-50 border-2 border-pink-300 rounded-2xl p-6 mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-bold text-pink-700 flex items-center gap-2">
                      <Mail className="w-5 h-5" />
                      Your Reset Code
                    </h3>
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full font-semibold">
                      DEV MODE
                    </span>
                  </div>
                  
                  <div className="bg-white rounded-xl p-4 mb-3 border-2 border-dashed border-pink-300">
                    <p className="text-4xl font-mono font-bold text-center tracking-widest text-pink-600">
                      {otpCode}
                    </p>
                  </div>
                  
                  <button
                    type="button"
                    onClick={copyToClipboard}
                    className="w-full bg-pink-600 hover:bg-pink-700 text-white py-2 rounded-lg font-semibold transition-all"
                  >
                    📋 Copy Code
                  </button>
                  
                  <p className="text-xs text-gray-600 mt-3 text-center">
                    ⚠️ Email service not configured. Use this code below.
                  </p>
                  <p className="text-xs text-gray-500 text-center">
                    Code expires in 15 minutes
                  </p>
                </div>
              )}
              
              <div>
                <Label htmlFor="reset-code" className="text-gray-700 font-semibold">
                  6-Digit Reset Code
                </Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="reset-code"
                    data-testid="reset-code-input"
                    type="text"
                    placeholder="Enter 6-digit code"
                    value={formData.reset_code}
                    onChange={(e) => setFormData({...formData, reset_code: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500 text-center text-2xl tracking-widest"
                    maxLength={6}
                    required
                  />
                </div>
                <p className="text-sm text-gray-500 mt-2">Code expires in 15 minutes</p>
              </div>

              <Button
                data-testid="verify-code-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg"
              >
                {loading ? 'Verifying...' : 'Verify Code'}
              </Button>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full text-gray-600 hover:text-gray-800 font-medium"
              >
                ← Back to Email
              </button>
            </form>
          )}

          {/* Step 3: New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <Label htmlFor="new-password" className="text-gray-700 font-semibold">
                  New Password
                </Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="new-password"
                    data-testid="new-password-input"
                    type="password"
                    placeholder="Enter new password"
                    value={formData.new_password}
                    onChange={(e) => setFormData({...formData, new_password: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="confirm-password" className="text-gray-700 font-semibold">
                  Confirm Password
                </Label>
                <div className="relative mt-2">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="confirm-password"
                    data-testid="confirm-password-input"
                    type="password"
                    placeholder="Confirm new password"
                    value={formData.confirm_password}
                    onChange={(e) => setFormData({...formData, confirm_password: e.target.value})}
                    className="pl-10 py-6 rounded-xl border-2 border-gray-200 focus:border-pink-500"
                    required
                  />
                </div>
              </div>

              <Button
                data-testid="reset-password-btn"
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-6 rounded-xl font-semibold text-lg shadow-lg"
              >
                {loading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </form>
          )}
        </div>

        <button
          data-testid="back-to-login-btn"
          onClick={() => navigate('/auth')}
          className="mt-6 w-full text-center text-gray-600 hover:text-gray-800 font-medium flex items-center justify-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Login
        </button>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
