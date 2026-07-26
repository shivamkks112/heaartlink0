import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Shield, Eye, EyeOff, Users, Lock, Heart, Moon, 
  UserCheck, AlertTriangle, ChevronRight, ArrowLeft,
  Camera, Volume2, Video
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import { useNavigate } from 'react-router-dom';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

import { BACKEND_URL, API } from '@/config/api';

const PrivacyPage = ({ user, onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(user);
  
  // Privacy Settings
  const [settings, setSettings] = useState({
    show_profile: true,
    show_photos: true,
    incognito_mode: false
  });
  
  // Gender Lock Settings
  const [genderLock, setGenderLock] = useState({
    gender_lock_enabled: false,
    show_to_gender: 'both',
    hide_profile_from_gender: 'none'
  });
  
  // Women Safety Settings
  const [womenSafety, setWomenSafety] = useState({
    women_safety_mode: false,
    night_quiet_hours_enabled: false
  });

  useEffect(() => {
    if (user?.id) {
      fetchProfile();
    }
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const data = response.data;
      setProfile(data);
      
      if (data.privacy_settings) {
        setSettings(data.privacy_settings);
      }
      
      setGenderLock({
        gender_lock_enabled: data.gender_lock_enabled || false,
        show_to_gender: data.show_to_gender || 'both',
        hide_profile_from_gender: data.hide_profile_from_gender || 'none'
      });
      
      setWomenSafety({
        women_safety_mode: data.women_safety_mode || false,
        night_quiet_hours_enabled: data.night_quiet_hours_enabled || false
      });
    } catch (error) {
      console.error('Privacy settings load error:', error);
      toast.error('Failed to load settings');
    }
  };

  const handlePrivacyUpdate = async (key, value) => {
    setLoading(true);
    try {
      await axios.put(`${API}/privacy/${user.id}`, { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Privacy settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleGenderLockUpdate = async (updates) => {
    setLoading(true);
    try {
      await axios.put(`${API}/user/${user.id}/gender-lock`, updates);
      setGenderLock(prev => ({ ...prev, ...updates }));
      toast.success('Gender preferences updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleWomenSafetyUpdate = async (updates) => {
    setLoading(true);
    try {
      await axios.put(`${API}/user/${user.id}/women-safety`, updates);
      setWomenSafety(prev => ({ ...prev, ...updates }));
      toast.success('Safety settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: '70px', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-full transition-all"
            data-testid="back-button"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Privacy & Safety</h1>
            <p className="text-gray-600">Control who sees you and your safety features</p>
          </div>
        </div>

        <div className="space-y-6">
          
          {/* === BASIC PRIVACY === */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Eye className="w-5 h-5" />
                Visibility Settings
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Show Profile */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-pink-100 p-2.5 rounded-xl">
                    <Users className="w-5 h-5 text-pink-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Show Profile</h3>
                    <p className="text-sm text-gray-500">Allow others to discover you</p>
                  </div>
                </div>
                <Switch
                  data-testid="show-profile-toggle"
                  checked={settings.show_profile}
                  onCheckedChange={(checked) => handlePrivacyUpdate('show_profile', checked)}
                  disabled={loading}
                />
              </div>

              {/* Show Photos */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-purple-100 p-2.5 rounded-xl">
                    <Camera className="w-5 h-5 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Show Photos</h3>
                    <p className="text-sm text-gray-500">Display photos to matches only</p>
                  </div>
                </div>
                <Switch
                  data-testid="show-photos-toggle"
                  checked={settings.show_photos}
                  onCheckedChange={(checked) => handlePrivacyUpdate('show_photos', checked)}
                  disabled={loading}
                />
              </div>

              {/* Incognito Mode */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-gray-100 p-2.5 rounded-xl">
                    <EyeOff className="w-5 h-5 text-gray-700" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Incognito Mode</h3>
                    <p className="text-sm text-gray-500">Browse without being seen</p>
                  </div>
                </div>
                <Switch
                  data-testid="incognito-toggle"
                  checked={settings.incognito_mode}
                  onCheckedChange={(checked) => handlePrivacyUpdate('incognito_mode', checked)}
                  disabled={loading}
                />
              </div>
            </div>
          </div>

          {/* === GENDER LOCK === */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-500 to-cyan-500 px-6 py-4">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Gender Preferences
              </h2>
            </div>
            
            <div className="p-6 space-y-6">
              {/* Enable Gender Lock */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-100 p-2.5 rounded-xl">
                    <Lock className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">Enable Gender Lock</h3>
                    <p className="text-sm text-gray-500">Strictly filter by gender</p>
                  </div>
                </div>
                <Switch
                  data-testid="gender-lock-toggle"
                  checked={genderLock.gender_lock_enabled}
                  onCheckedChange={(checked) => handleGenderLockUpdate({ gender_lock_enabled: checked })}
                  disabled={loading}
                />
              </div>

              {genderLock.gender_lock_enabled && (
                <>
                  {/* Show To Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Show my profile to
                    </label>
                    <div className="flex gap-3">
                      {['male', 'female', 'both'].map((option) => (
                        <button
                          key={option}
                          onClick={() => handleGenderLockUpdate({ show_to_gender: option })}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                            genderLock.show_to_gender === option
                              ? 'bg-blue-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          data-testid={`show-to-${option}`}
                        >
                          {option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Hide From Gender */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Hide my profile from
                    </label>
                    <div className="flex gap-3">
                      {['none', 'male', 'female'].map((option) => (
                        <button
                          key={option}
                          onClick={() => handleGenderLockUpdate({ hide_profile_from_gender: option })}
                          className={`flex-1 py-3 px-4 rounded-xl font-medium transition-all ${
                            genderLock.hide_profile_from_gender === option
                              ? 'bg-red-500 text-white shadow-lg'
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                          data-testid={`hide-from-${option}`}
                        >
                          {option === 'none' ? 'No One' : option.charAt(0).toUpperCase() + option.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* === WOMEN SAFETY MODE === */}
          {profile.gender?.toLowerCase() === 'female' && (
            <div className="bg-white rounded-2xl shadow-lg overflow-hidden border-2 border-pink-200">
              <div className="bg-gradient-to-r from-pink-600 to-rose-500 px-6 py-4">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Shield className="w-5 h-5" />
                  Women Safety Mode
                </h2>
                <p className="text-pink-100 text-sm mt-1">Extra protection features for your safety</p>
              </div>
              
              <div className="p-6 space-y-6">
                {/* Women Safety Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-pink-100 p-2.5 rounded-xl">
                      <UserCheck className="w-5 h-5 text-pink-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">Enable Safety Mode</h3>
                      <p className="text-sm text-gray-500">Only verified males can message</p>
                    </div>
                  </div>
                  <Switch
                    data-testid="women-safety-toggle"
                    checked={womenSafety.women_safety_mode}
                    onCheckedChange={(checked) => handleWomenSafetyUpdate({ women_safety_mode: checked })}
                    disabled={loading}
                  />
                </div>

                {womenSafety.women_safety_mode && (
                  <>
                    {/* Night Quiet Hours */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-indigo-100 p-2.5 rounded-xl">
                          <Moon className="w-5 h-5 text-indigo-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-gray-900">Night Quiet Hours</h3>
                          <p className="text-sm text-gray-500">Auto-mute 10 PM - 7 AM</p>
                        </div>
                      </div>
                      <Switch
                        data-testid="quiet-hours-toggle"
                        checked={womenSafety.night_quiet_hours_enabled}
                        onCheckedChange={(checked) => handleWomenSafetyUpdate({ night_quiet_hours_enabled: checked })}
                        disabled={loading}
                      />
                    </div>

                    {/* Safety Features Info */}
                    <div className="bg-pink-50 rounded-xl p-4 border border-pink-200">
                      <h4 className="font-semibold text-pink-800 mb-2">Active Protections:</h4>
                      <ul className="text-sm text-pink-700 space-y-1">
                        <li>✓ Only verified males can message you</li>
                        <li>✓ 2-minute delay on first messages from males</li>
                        {womenSafety.night_quiet_hours_enabled && (
                          <li>✓ No messages during night hours (10 PM - 7 AM)</li>
                        )}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {/* === PROFILE VIEWERS === */}
          <button
            onClick={() => navigate('/profile-viewers')}
            className="w-full bg-white rounded-2xl shadow-lg p-6 flex items-center justify-between hover:shadow-xl transition-all"
            data-testid="view-profile-viewers"
          >
            <div className="flex items-center gap-3">
              <div className="bg-orange-100 p-2.5 rounded-xl">
                <Eye className="w-5 h-5 text-orange-600" />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-gray-900">Profile Viewers</h3>
                <p className="text-sm text-gray-500">See who viewed your profile</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </button>

          {/* === TRUST BADGE === */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2.5 rounded-xl ${
                profile.trust_badge_level === 'high' ? 'bg-green-100' :
                profile.trust_badge_level === 'medium' ? 'bg-yellow-100' : 'bg-gray-100'
              }`}>
                <Shield className={`w-5 h-5 ${
                  profile.trust_badge_level === 'high' ? 'text-green-600' :
                  profile.trust_badge_level === 'medium' ? 'text-yellow-600' : 'text-gray-600'
                }`} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">Trust Badge Level</h3>
                <p className="text-sm text-gray-500">Your verified trust status</p>
              </div>
            </div>
            
            <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold ${
              profile.trust_badge_level === 'high' ? 'bg-green-100 text-green-700' :
              profile.trust_badge_level === 'medium' ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-700'
            }`}>
              <Shield className="w-4 h-4" />
              {(profile.trust_badge_level || 'low').toUpperCase()} TRUST
            </div>
            
            <p className="text-xs text-gray-500 mt-3">
              Complete your profile and get verified to increase your trust level.
            </p>
          </div>

          {/* === SAFETY TIPS === */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-lg p-6 border-2 border-blue-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">Safety Tips</h3>
                <ul className="text-blue-800 space-y-2 text-sm">
                  <li>• Block and report users who make you uncomfortable</li>
                  <li>• Never share personal info like address or finances</li>
                  <li>• Meet in public places for first dates</li>
                  <li>• Tell a friend where you are going</li>
                  <li>• Trust your instincts - if something feels wrong, leave</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
