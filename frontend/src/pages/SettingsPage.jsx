import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, UserX, BellOff, Mail, Phone, Link2, CheckCircle, AlertCircle, Shield, Eye, EyeOff, MessageSquare, Clock, Camera, Sun, Moon, Monitor, Crown, ExternalLink, Flame, Gift, ChevronRight } from 'lucide-react';
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
import { useTheme } from '@/hooks/useTheme';

import { BACKEND_URL, API } from '@/config/api';
import { AdDebugPanel } from '@/components/ads/AdDebugPanel';

const DailyRewardsWidget = ({ userId, isGirl }) => {
  const [status, setStatus] = useState(null);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (userId) {
      axios.get(`${API}/rewards/status/${userId}`).then(r => setStatus(r.data)).catch(() => {});
    }
  }, [userId]);

  const claimReward = async () => {
    setClaiming(true);
    try {
      const res = await axios.post(`${API}/rewards/daily-checkin/${userId}`);
      if (res.data.success) {
        toast.success(res.data.message);
        setStatus(prev => ({ ...prev, can_claim_today: false, streak: res.data.streak, heart_coins: res.data.total_coins }));
      } else {
        toast.info(res.data.message);
      }
    } catch { toast.error('Try again later'); }
    setClaiming(false);
  };

  if (!status) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">HeartCoins: <span className="font-bold text-amber-600">{status.heart_coins || 0}</span></p>
          <p className="text-xs text-gray-400">Streak: {status.streak || 0} day{status.streak !== 1 ? 's' : ''}</p>
        </div>
        {isGirl && <span className="text-[10px] bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-medium">2x Girl Bonus</span>}
      </div>
      <button
        onClick={claimReward}
        disabled={!status.can_claim_today || claiming}
        className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${status.can_claim_today ? 'bg-gradient-to-r from-orange-400 to-amber-500 text-white active:scale-[0.97]' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
        data-testid="claim-daily-reward"
      >
        {claiming ? 'Claiming...' : status.can_claim_today ? 'Claim Daily Reward' : 'Already Claimed Today'}
      </button>
    </div>
  );
};

const LadiesFirstToggle = ({ userId, initialEnabled }) => {
  const [enabled, setEnabled] = useState(initialEnabled || false);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${API}/user/${userId}/ladies-first`, { enabled: !enabled });
      if (res.data.success) {
        setEnabled(!enabled);
        toast.success(!enabled ? 'Ladies First enabled — boys wait for your message first' : 'Ladies First disabled');
      }
    } catch (e) { toast.error(e.response?.data?.detail || 'Failed'); }
    setLoading(false);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm text-gray-600">Jab ON ho, sirf tum pehle message kar sakti ho. Boys ko wait karna padega.</p>
      <div className="flex items-center justify-between bg-gray-50 px-4 py-3 rounded-xl">
        <span className="text-sm font-medium text-gray-700">{enabled ? 'Active' : 'Off'}</span>
        <button
          onClick={toggle}
          disabled={loading}
          className={`w-12 h-6 rounded-full transition-colors relative ${enabled ? 'bg-purple-500' : 'bg-gray-300'}`}
          data-testid="ladies-first-toggle"
        >
          <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${enabled ? 'left-[26px]' : 'left-0.5'}`} />
        </button>
      </div>
    </div>
  );
};

const SettingsPage = ({ user, setUser }) => {
  const navigate = useNavigate();
  const { mode: themeMode, setMode: setThemeMode } = useTheme();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState(user || null);
  
  // Privacy settings state
  const [privacySettings, setPrivacySettings] = useState({
    hide_online_status: false,
    hide_read_receipts: false,
    hide_typing_indicator: false,
    hide_phone_number: true,
    blur_photos_for_non_matches: true,
    disappearing_messages: false,
    disappearing_messages_duration: 86400,
    screenshot_alert: true
  });
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const [nightSafety, setNightSafety] = useState(true);
  
  // Linking states
  const [showLinkEmail, setShowLinkEmail] = useState(false);
  const [showLinkPhone, setShowLinkPhone] = useState(false);
  const [linkEmail, setLinkEmail] = useState('');
  const [linkPassword, setLinkPassword] = useState('');
  const [linkPhone, setLinkPhone] = useState('');
  const [linkingLoading, setLinkingLoading] = useState(false);

  useEffect(() => {
    fetchUserSettings();
    fetchPrivacySettings();
    fetchNightSafety();
  }, []);

  const fetchNightSafety = async () => {
    try {
      const res = await axios.get(`${API}/safety/night-mode/${user.id}`);
      setNightSafety(res.data.night_safety_enabled);
    } catch {}
  };

  const toggleNightSafety = async () => {
    const newVal = !nightSafety;
    setNightSafety(newVal);
    try {
      await axios.post(`${API}/safety/night-mode/toggle`, { user_id: user.id, enabled: newVal });
      toast.success(newVal ? 'Night Safety ON' : 'Night Safety OFF');
    } catch {
      setNightSafety(!newVal);
      toast.error('Failed to update');
    }
  };

  const fetchPrivacySettings = async () => {
    try {
      const response = await axios.get(`${API}/privacy/${user.id}`);
      setPrivacySettings(response.data);
    } catch (error) {
      console.error('Failed to fetch privacy settings', error);
    }
  };

  const updatePrivacySetting = async (key, value) => {
    setSavingPrivacy(true);
    try {
      const response = await axios.put(`${API}/privacy/${user.id}`, {
        [key]: value
      });
      setPrivacySettings(prev => ({ ...prev, [key]: value }));
      toast.success('Privacy setting updated');
    } catch (error) {
      toast.error('Failed to update privacy setting');
    } finally {
      setSavingPrivacy(false);
    }
  };

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
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
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
        {/* Theme / Appearance Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm" data-testid="theme-section">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Sun className="w-5 h-5 text-pink-600" />
            Appearance
          </h2>
          <div className="flex gap-2">
            {[
              { id: 'light', icon: Sun, label: 'Light' },
              { id: 'dark', icon: Moon, label: 'Dark' },
              { id: 'system', icon: Monitor, label: 'System' },
            ].map(({ id, icon: Icon, label }) => (
              <button
                key={id}
                data-testid={`theme-${id}`}
                onClick={() => setThemeMode(id)}
                className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl transition-all duration-200 ${
                  themeMode === id
                    ? 'bg-pink-50 border-2 border-pink-400 text-pink-700'
                    : 'bg-gray-50 border-2 border-transparent text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Premium Subscription Section */}
        <div className="bg-white rounded-xl p-4 shadow-sm" data-testid="premium-settings-section">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Crown className="w-5 h-5 text-amber-500" />
            HeartLink Premium
          </h2>
          {(user?.is_premium || user?.gender?.toLowerCase() === 'female') ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-2 rounded-lg">
                <CheckCircle className="w-4 h-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">
                  {user?.gender?.toLowerCase() === 'female' ? 'Free for Girls' : user?.subscription_status === 'trialing' ? 'Trial Active' : 'Premium Active'}
                </span>
              </div>
              {user?.gender?.toLowerCase() !== 'female' && (
                <button
                  onClick={() => {
                    const pkg = 'com.heartlink.app';
                    window.open(`https://play.google.com/store/account/subscriptions?sku=heartlink_premium_monthly&package=${pkg}`, '_system');
                  }}
                  className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-xl transition-colors"
                  data-testid="manage-subscription-settings"
                >
                  <span className="text-sm font-medium text-gray-700">Manage Subscription</span>
                  <ExternalLink className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          ) : (
            <button
              onClick={() => navigate('/premium')}
              className="w-full bg-gradient-to-r from-amber-400 to-orange-500 text-white px-4 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
              data-testid="upgrade-premium-settings"
            >
              <Crown className="w-4 h-4" /> Upgrade to Premium
            </button>
          )}
          <button
            onClick={() => navigate('/payment-history')}
            className="w-full flex items-center justify-between bg-gray-50 hover:bg-gray-100 px-4 py-3 rounded-xl transition-colors mt-2"
            data-testid="payment-history-link"
          >
            <span className="text-sm font-medium text-gray-600">Payment & Subscription History</span>
            <ExternalLink className="w-4 h-4 text-gray-400" />
          </button>
        </div>
        <div className="bg-white rounded-xl p-4 shadow-sm" data-testid="daily-rewards-section">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Daily Rewards
          </h2>
          <DailyRewardsWidget userId={user?.id} isGirl={user?.gender?.toLowerCase() === 'female'} />
        </div>

        {/* Ladies First Mode — Girls Only */}
        {user?.gender?.toLowerCase() === 'female' && (
          <div className="bg-white rounded-xl p-4 shadow-sm" data-testid="ladies-first-section">
            <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-500" />
              Ladies First
            </h2>
            <LadiesFirstToggle userId={user?.id} initialEnabled={user?.ladies_first_enabled} />
          </div>
        )}

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

        {/* Chat Privacy Settings */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
            <Shield className="w-5 h-5 text-purple-600" />
            Chat Privacy
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Control what others can see about you in chat
          </p>
          
          <div className="space-y-4">
            {/* Hide Phone Number */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-red-50 to-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Phone className="w-5 h-5 text-red-500" />
                <div>
                  <p className="font-medium text-gray-900">Hide Phone Number</p>
                  <p className="text-xs text-gray-500">Matches won't see your number</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.hide_phone_number}
                  onChange={(e) => updatePrivacySetting('hide_phone_number', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
              </label>
            </div>

            {/* Hide Online Status */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-green-50 to-teal-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium text-gray-900">Hide Online Status</p>
                  <p className="text-xs text-gray-500">Others won't see when you're online</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.hide_online_status}
                  onChange={(e) => updatePrivacySetting('hide_online_status', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
              </label>
            </div>

            {/* Hide Read Receipts */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="font-medium text-gray-900">Hide Read Receipts</p>
                  <p className="text-xs text-gray-500">Others won't see blue ticks</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.hide_read_receipts}
                  onChange={(e) => updatePrivacySetting('hide_read_receipts', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
              </label>
            </div>

            {/* Hide Typing Indicator */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg">
              <div className="flex items-center gap-3">
                <MessageSquare className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="font-medium text-gray-900">Hide Typing Indicator</p>
                  <p className="text-xs text-gray-500">"Typing..." won't show to others</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.hide_typing_indicator}
                  onChange={(e) => updatePrivacySetting('hide_typing_indicator', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
              </label>
            </div>

            {/* Screenshot Alert */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Camera className="w-5 h-5 text-yellow-600" />
                <div>
                  <p className="font-medium text-gray-900">Screenshot Alerts</p>
                  <p className="text-xs text-gray-500">Get notified when someone screenshots</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.screenshot_alert}
                  onChange={(e) => updatePrivacySetting('screenshot_alert', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
              </label>
            </div>

            {/* Disappearing Messages */}
            <div className="p-3 bg-gradient-to-r from-gray-50 to-slate-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-gray-600" />
                  <div>
                    <p className="font-medium text-gray-900">Disappearing Messages</p>
                    <p className="text-xs text-gray-500">Messages auto-delete after set time</p>
                  </div>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={privacySettings.disappearing_messages}
                    onChange={(e) => updatePrivacySetting('disappearing_messages', e.target.checked)}
                    className="sr-only peer"
                    disabled={savingPrivacy}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-gray-600"></div>
                </label>
              </div>
              {privacySettings.disappearing_messages && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => updatePrivacySetting('disappearing_messages_duration', 86400)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${privacySettings.disappearing_messages_duration === 86400 ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    24 Hours
                  </button>
                  <button
                    onClick={() => updatePrivacySetting('disappearing_messages_duration', 604800)}
                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${privacySettings.disappearing_messages_duration === 604800 ? 'bg-gray-800 text-white' : 'bg-gray-200 text-gray-700'}`}
                  >
                    7 Days
                  </button>
                </div>
              )}
            </div>

            {/* Blur Photos */}
            <div className="flex items-center justify-between p-3 bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg">
              <div className="flex items-center gap-3">
                <EyeOff className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="font-medium text-gray-900">Blur Photos for Non-Matches</p>
                  <p className="text-xs text-gray-500">Only matches see clear photos</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={privacySettings.blur_photos_for_non_matches}
                  onChange={(e) => updatePrivacySetting('blur_photos_for_non_matches', e.target.checked)}
                  className="sr-only peer"
                  disabled={savingPrivacy}
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-500"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Privacy Options */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900 mb-3">More Privacy Options</h2>
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

        {/* Girls Night Safety Toggle */}
        {user?.gender?.toLowerCase() === 'female' && (
          <div className="bg-white rounded-2xl p-4 shadow-sm mb-4" data-testid="night-safety-toggle">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                  <Moon className="w-5 h-5 text-indigo-600" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-sm">Night Safety Mode</p>
                  <p className="text-xs text-gray-500">11PM-6AM new matches can't message you</p>
                </div>
              </div>
              <button
                onClick={toggleNightSafety}
                className={`w-12 h-7 rounded-full transition-colors ${nightSafety ? 'bg-indigo-500' : 'bg-gray-300'}`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform ${nightSafety ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
        )}

        {/* Safe Word Info (for girls) */}
        {user?.gender?.toLowerCase() === 'female' && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200/50 rounded-2xl p-4 shadow-sm mb-4" data-testid="safe-word-info">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <Shield className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 text-sm">Emergency Safe Word</p>
                <p className="text-xs text-gray-600 mt-1">
                  Chat mein <span className="font-bold text-red-600">"heartlink sos"</span> ya <span className="font-bold text-red-600">"i feel unsafe"</span> type karo — user instantly block + report ho jayega. Humari team turant review karegi.
                </p>
              </div>
            </div>
          </div>
        )}

        <AdDebugPanel />

        {/* Feedback & Support */}
        <div className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 shadow-sm mb-4" data-testid="feedback-section">
          <button
            onClick={() => navigate('/feedback')}
            className="w-full flex items-center justify-between"
            data-testid="feedback-link"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center">
                <MessageSquare className="w-5 h-5 text-pink-500" />
              </div>
              <div className="text-left">
                <p className="font-semibold text-gray-900 text-sm">Feedback & Support</p>
                <p className="text-xs text-gray-500">Bug report, feature ideas, help</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
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
