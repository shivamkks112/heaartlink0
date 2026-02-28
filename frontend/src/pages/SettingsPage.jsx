import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, UserX, BellOff, Mail, Phone, Link2, CheckCircle, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsPage = ({ user, setUser }) => {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState(null);
  
  // Linking states
  const [showLinkEmail, setShowLinkEmail] = useState(false);
  const [showLinkPhone, setShowLinkPhone] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkPhone, setLinkPhone] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const fetchedUserData = response.data;
      setUserData(fetchedUserData);
      
      // Fetch blocked users details
      const blockedIds = fetchedUserData.blocked_users || [];
      const blockedUsersData = await Promise.all(
        blockedIds.map(async (userId) => {
          try {
            const userResponse = await axios.get(`${API}/profile/${userId}`);
            return userResponse.data;
          } catch (error) {
            return null;
          }
        })
      );
      setBlockedUsers(blockedUsersData.filter(u => u !== null));

      // Fetch muted users details
      const mutedIds = fetchedUserData.muted_users || [];
      const mutedUsersData = await Promise.all(
        mutedIds.map(async (userId) => {
          try {
            const userResponse = await axios.get(`${API}/profile/${userId}`);
            return userResponse.data;
          } catch (error) {
            return null;
          }
        })
      );
      setMutedUsers(mutedUsersData.filter(u => u !== null));
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load settings');
      setLoading(false);
      console.error('Settings error:', error);
    }
  };

  // Handle linking email
  const handleLinkEmail = async () => {
    if (!linkEmail || !linkPassword) {
      toast.error('Email and password required');
      return;
    }
    
    setLinkingLoading(true);
    try {
      const response = await axios.post(`${API}/profile/${user.id}/link-email`, {
        email: linkEmail,
        password: linkPassword
      });
      
      if (response.data.status === 'success') {
        toast.success('Email linked successfully!');
        setShowLinkEmail(false);
        setLinkEmail('');
        setLinkPassword('');
        // Refresh user data
        fetchUserSettings();
        // Update parent user state if available
        if (setUser) {
          const updatedUser = await axios.get(`${API}/profile/${user.id}`);
          setUser(updatedUser.data);
        }
      } else if (response.data.status === 'merge_available') {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link email');
    } finally {
      setLinkingLoading(false);
    }
  };

  // Handle linking phone
  const handleLinkPhone = async () => {
    if (!linkPhone) {
      toast.error('Phone number required');
      return;
    }
    
    setLinkingLoading(true);
    try {
      const response = await axios.post(`${API}/profile/${user.id}/link-phone`, {
        phone: linkPhone,
        otp_verified: false // For now, can add OTP verification later
      });
      
      if (response.data.status === 'success') {
        toast.success('Phone linked successfully!');
        setShowLinkPhone(false);
        setLinkPhone('');
        fetchUserSettings();
        if (setUser) {
          const updatedUser = await axios.get(`${API}/profile/${user.id}`);
          setUser(updatedUser.data);
        }
      } else if (response.data.status === 'merge_available') {
        toast.info(response.data.message);
      }
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to link phone');
    } finally {
      setLinkingLoading(false);
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await axios.post(`${API}/user/${user.id}/unblock`, {
        blocked_user_id: blockedUserId
      });
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
      toast.success('User unblocked');
    } catch (error) {
      toast.error('Failed to unblock user');
      console.error('Unblock error:', error);
    }
  };

  const handleUnmute = async (mutedUserId) => {
    try {
      await axios.post(`${API}/user/${user.id}/unmute`, {
        muted_user_id: mutedUserId
      });
      setMutedUsers(prev => prev.filter(u => u.id !== mutedUserId));
      toast.success('User unmuted');
    } catch (error) {
      toast.error('Failed to unmute user');
      console.error('Unmute error:', error);
    }
  };

 

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center page-with-bottom-nav status-bar-spacing">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-20 sm:pb-24" style={{ paddingTop: '95px' }}>
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white shadow-md px-4 py-4 flex items-center gap-4 sticky top-16 z-40">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Privacy Settings</h1>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Account Linking Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Link2 className="w-5 h-5 text-pink-600" />
            Account Linking
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Link your email and phone to secure your account and enable multiple login methods.
          </p>
          
          {/* Email Status */}
          <div className="p-3 bg-gradient-to-r from-pink-50 to-orange-50 rounded-lg mb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-pink-600" />
                <div>
                  <p className="font-semibold text-gray-900">Email</p>
                  {userData?.email ? (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {userData.email}
                    </p>
                  ) : (
                    <p className="text-sm text-orange-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Not linked
                    </p>
                  )}
                </div>
              </div>
              {!userData?.email && (
                <Button
                  onClick={() => setShowLinkEmail(!showLinkEmail)}
                  size="sm"
                  className="bg-pink-500 hover:bg-pink-600 text-white"
                >
                  Link Email
                </Button>
              )}
            </div>
            
            {/* Link Email Form */}
            {showLinkEmail && !userData?.email && (
              <div className="mt-4 space-y-3 border-t border-pink-200 pt-4">
                <input
                  type="email"
                  placeholder="Enter your email"
                  value={linkEmail}
                  onChange={(e) => setLinkEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <input
                  type="password"
                  placeholder="Create a password"
                  value={linkPassword}
                  onChange={(e) => setLinkPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500">
                  Password: min 8 chars, 1 uppercase, 1 number, 1 special char
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleLinkEmail}
                    disabled={linkingLoading}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    {linkingLoading ? 'Linking...' : 'Confirm Link'}
                  </Button>
                  <Button
                    onClick={() => {setShowLinkEmail(false); setLinkEmail(''); setLinkPassword('');}}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
          
          {/* Phone Status */}
          <div className="p-3 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-blue-600" />
                <div>
                  <p className="font-semibold text-gray-900">Phone</p>
                  {userData?.phone ? (
                    <p className="text-sm text-green-600 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> {userData.phone}
                    </p>
                  ) : (
                    <p className="text-sm text-orange-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" /> Not linked
                    </p>
                  )}
                </div>
              </div>
              {!userData?.phone && (
                <Button
                  onClick={() => setShowLinkPhone(!showLinkPhone)}
                  size="sm"
                  className="bg-blue-500 hover:bg-blue-600 text-white"
                >
                  Link Phone
                </Button>
              )}
            </div>
            
            {/* Link Phone Form */}
            {showLinkPhone && !userData?.phone && (
              <div className="mt-4 space-y-3 border-t border-blue-200 pt-4">
                <div className="flex gap-2">
                  <span className="px-3 py-2 bg-gray-100 border border-gray-300 rounded-lg text-gray-600">+91</span>
                  <input
                    type="tel"
                    placeholder="Enter phone number"
                    value={linkPhone}
                    onChange={(e) => setLinkPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    maxLength={10}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleLinkPhone}
                    disabled={linkingLoading || linkPhone.length !== 10}
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white"
                  >
                    {linkingLoading ? 'Linking...' : 'Confirm Link'}
                  </Button>
                  <Button
                    onClick={() => {setShowLinkPhone(false); setLinkPhone('');}}
                    variant="outline"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Privacy Options */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">Privacy Options</h2>
          <button
            onClick={() => navigate('/privacy')}
            className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-orange-50 rounded-lg hover:from-pink-100 hover:to-orange-100 transition-all"
          >
            <div className="flex items-center gap-3">
              <svg className="w-5 h-5 text-pink-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <div className="text-left">
                <p className="font-semibold text-gray-900">Privacy & Safety</p>
                <p className="text-xs text-gray-600">Control visibility, incognito mode, and more</p>
              </div>
            </div>
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Blocked & Muted Users */}
        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="blocked">
              Blocked ({blockedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="muted">
              Muted ({mutedUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocked" className="space-y-3">
            {blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map((blockedUser) => (
                <div
                  key={blockedUser.id}
                  className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {blockedUser.profile_picture ? (
                        <img 
                          src={blockedUser.profile_picture} 
                          alt={blockedUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        blockedUser.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{blockedUser.name}</h3>
                      <p className="text-sm text-gray-500">{blockedUser.age} years old</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnblock(blockedUser.id)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Unblock
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="muted" className="space-y-3">
            {mutedUsers.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No muted users</p>
              </div>
            ) : (
              mutedUsers.map((mutedUser) => (
                <div
                  key={mutedUser.id}
                  className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {mutedUser.profile_picture ? (
                        <img 
                          src={mutedUser.profile_picture} 
                          alt={mutedUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        mutedUser.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{mutedUser.name}</h3>
                      <p className="text-sm text-gray-500">Notifications muted</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnmute(mutedUser.id)}
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    Unmute
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
