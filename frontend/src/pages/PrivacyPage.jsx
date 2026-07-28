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

// Reusable setting row
const SettingRow = ({ icon: Icon, iconBg, iconColor, title, desc, testId, checked, onChange, disabled }) => (
  <div className="flex items-center justify-between py-1" style={{ minHeight: '56px' }}>
    <div className="flex items-center gap-3 flex-1 min-w-0">
      <div className="p-2.5 rounded-xl flex-shrink-0" style={{ background: iconBg }}>
        <Icon className="w-5 h-5" style={{ color: iconColor }} />
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-sm" style={{ color: 'var(--m3-on-surface)' }}>{title}</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--m3-on-surface-variant)' }}>{desc}</p>
      </div>
    </div>
    <Switch
      data-testid={testId}
      checked={checked}
      onCheckedChange={onChange}
      disabled={disabled}
      className="ml-3 flex-shrink-0"
    />
  </div>
);

// Reusable section card
const SectionCard = ({ children, headerBg, headerIcon: HIcon, headerTitle, headerDesc, borderColor }) => (
  <div className="overflow-hidden m3-animate-in" style={{
    background: 'var(--m3-surface-container-lowest)',
    borderRadius: 'var(--m3-shape-lg)',
    boxShadow: 'var(--m3-elevation-2)',
    border: borderColor ? `1.5px solid ${borderColor}` : 'none',
  }}>
    {headerBg && (
      <div className="px-5 py-3.5" style={{ background: headerBg }}>
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          <HIcon className="w-4.5 h-4.5" />
          {headerTitle}
        </h2>
        {headerDesc && <p className="text-white/70 text-xs mt-0.5">{headerDesc}</p>}
      </div>
    )}
    <div className="px-5 py-4 space-y-3">{children}</div>
  </div>
);

const PrivacyPage = ({ user, onUpdate }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState(user);
  
  const [settings, setSettings] = useState({
    show_profile: true,
    show_photos: true,
    incognito_mode: false
  });
  
  const [genderLock, setGenderLock] = useState({
    gender_lock_enabled: false,
    show_to_gender: 'both',
    hide_profile_from_gender: 'none'
  });
  
  const [womenSafety, setWomenSafety] = useState({
    women_safety_mode: false,
    night_quiet_hours_enabled: false
  });

  useEffect(() => {
    if (user?.id) fetchProfile();
  }, [user?.id]);

  const fetchProfile = async () => {
    if (!user?.id) return;
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const data = response.data;
      setProfile(data);
      if (data.privacy_settings) setSettings(data.privacy_settings);
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
      toast.error('Failed to load settings');
    }
  };

  const handlePrivacyUpdate = async (key, value) => {
    setLoading(true);
    try {
      await axios.put(`${API}/privacy/${user.id}`, { [key]: value });
      setSettings(prev => ({ ...prev, [key]: value }));
      toast.success('Privacy settings updated');
    } catch (error) { toast.error('Failed to update settings'); }
    finally { setLoading(false); }
  };

  const handleGenderLockUpdate = async (updates) => {
    setLoading(true);
    try {
      await axios.put(`${API}/user/${user.id}/gender-lock`, updates);
      setGenderLock(prev => ({ ...prev, ...updates }));
      toast.success('Gender preferences updated');
    } catch (error) { toast.error('Failed to update settings'); }
    finally { setLoading(false); }
  };

  const handleWomenSafetyUpdate = async (updates) => {
    setLoading(true);
    try {
      await axios.put(`${API}/user/${user.id}/women-safety`, updates);
      setWomenSafety(prev => ({ ...prev, ...updates }));
      toast.success('Safety settings updated');
    } catch (error) { toast.error('Failed to update settings'); }
    finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-3xl mx-auto px-4 py-4 m3-animate-in">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <button
            onClick={() => navigate(-1)}
            className="p-2.5 rounded-full transition-all active:scale-90"
            style={{ background: 'var(--m3-surface-container-high)' }}
            data-testid="back-button"
          >
            <ArrowLeft className="w-5 h-5" style={{ color: 'var(--m3-on-surface)' }} />
          </button>
          <div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--m3-on-surface)' }}>Privacy & Safety</h1>
            <p className="text-sm" style={{ color: 'var(--m3-on-surface-variant)' }}>Control who sees you and your safety</p>
          </div>
        </div>

        <div className="space-y-4 m3-stagger">
          
          {/* === VISIBILITY === */}
          <SectionCard
            headerBg="linear-gradient(135deg, #D6336C 0%, #E8590C 100%)"
            headerIcon={Eye}
            headerTitle="Visibility Settings"
          >
            <SettingRow
              icon={Users} iconBg="var(--m3-primary-container)" iconColor="var(--m3-primary)"
              title="Show Profile" desc="Allow others to discover you"
              testId="show-profile-toggle"
              checked={settings.show_profile}
              onChange={(v) => handlePrivacyUpdate('show_profile', v)}
              disabled={loading}
            />
            <div style={{ height: '1px', background: 'var(--m3-outline-variant)', opacity: 0.5 }} />
            <SettingRow
              icon={Camera} iconBg="var(--m3-secondary-container)" iconColor="var(--m3-secondary)"
              title="Show Photos" desc="Display photos to matches only"
              testId="show-photos-toggle"
              checked={settings.show_photos}
              onChange={(v) => handlePrivacyUpdate('show_photos', v)}
              disabled={loading}
            />
            <div style={{ height: '1px', background: 'var(--m3-outline-variant)', opacity: 0.5 }} />
            <SettingRow
              icon={EyeOff} iconBg="var(--m3-surface-container-high)" iconColor="var(--m3-on-surface-variant)"
              title="Incognito Mode" desc="Browse without being seen"
              testId="incognito-toggle"
              checked={settings.incognito_mode}
              onChange={(v) => handlePrivacyUpdate('incognito_mode', v)}
              disabled={loading}
            />
          </SectionCard>

          {/* === GENDER LOCK === */}
          <SectionCard
            headerBg="linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)"
            headerIcon={Lock}
            headerTitle="Gender Preferences"
          >
            <SettingRow
              icon={Lock} iconBg="rgba(59,130,246,0.15)" iconColor="#3B82F6"
              title="Enable Gender Lock" desc="Strictly filter by gender"
              testId="gender-lock-toggle"
              checked={genderLock.gender_lock_enabled}
              onChange={(v) => handleGenderLockUpdate({ gender_lock_enabled: v })}
              disabled={loading}
            />

            {genderLock.gender_lock_enabled && (
              <>
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Show my profile to
                  </label>
                  <div className="flex gap-2">
                    {['male', 'female', 'both'].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleGenderLockUpdate({ show_to_gender: option })}
                        className="flex-1 py-2.5 px-3 rounded-xl font-medium text-sm transition-all active:scale-[0.97]"
                        style={{
                          background: genderLock.show_to_gender === option
                            ? 'linear-gradient(135deg, #3B82F6 0%, #06B6D4 100%)'
                            : 'var(--m3-surface-container-high)',
                          color: genderLock.show_to_gender === option ? 'white' : 'var(--m3-on-surface)',
                          boxShadow: genderLock.show_to_gender === option ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
                        }}
                        data-testid={`show-to-${option}`}
                      >
                        {option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--m3-on-surface-variant)' }}>
                    Hide my profile from
                  </label>
                  <div className="flex gap-2">
                    {['none', 'male', 'female'].map((option) => (
                      <button
                        key={option}
                        onClick={() => handleGenderLockUpdate({ hide_profile_from_gender: option })}
                        className="flex-1 py-2.5 px-3 rounded-xl font-medium text-sm transition-all active:scale-[0.97]"
                        style={{
                          background: genderLock.hide_profile_from_gender === option
                            ? 'linear-gradient(135deg, #E53935 0%, #FF6D00 100%)'
                            : 'var(--m3-surface-container-high)',
                          color: genderLock.hide_profile_from_gender === option ? 'white' : 'var(--m3-on-surface)',
                          boxShadow: genderLock.hide_profile_from_gender === option ? '0 2px 8px rgba(229,57,53,0.3)' : 'none',
                        }}
                        data-testid={`hide-from-${option}`}
                      >
                        {option === 'none' ? 'No One' : option.charAt(0).toUpperCase() + option.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </SectionCard>

          {/* === WOMEN SAFETY === */}
          {profile.gender?.toLowerCase() === 'female' && (
            <SectionCard
              headerBg="linear-gradient(135deg, #D6336C 0%, #BE185D 100%)"
              headerIcon={Shield}
              headerTitle="Women Safety Mode"
              headerDesc="Extra protection features"
              borderColor="var(--m3-primary)"
            >
              <SettingRow
                icon={UserCheck} iconBg="var(--m3-primary-container)" iconColor="var(--m3-primary)"
                title="Enable Safety Mode" desc="Only verified males can message"
                testId="women-safety-toggle"
                checked={womenSafety.women_safety_mode}
                onChange={(v) => handleWomenSafetyUpdate({ women_safety_mode: v })}
                disabled={loading}
              />

              {womenSafety.women_safety_mode && (
                <>
                  <div style={{ height: '1px', background: 'var(--m3-outline-variant)', opacity: 0.5 }} />
                  <SettingRow
                    icon={Moon} iconBg="rgba(99,102,241,0.15)" iconColor="#6366F1"
                    title="Night Quiet Hours" desc="Auto-mute 10 PM - 7 AM"
                    testId="quiet-hours-toggle"
                    checked={womenSafety.night_quiet_hours_enabled}
                    onChange={(v) => handleWomenSafetyUpdate({ night_quiet_hours_enabled: v })}
                  />

                  <div className="rounded-xl p-3.5" style={{ background: 'var(--m3-primary-container)', border: '1px solid var(--m3-outline-variant)' }}>
                    <h4 className="font-semibold text-xs mb-1.5" style={{ color: 'var(--m3-on-primary-container)' }}>Active Protections:</h4>
                    <ul className="text-xs space-y-0.5" style={{ color: 'var(--m3-on-primary-container)' }}>
                      <li>&#10003; Only verified males can message you</li>
                      <li>&#10003; 2-minute delay on first messages from males</li>
                      {womenSafety.night_quiet_hours_enabled && (
                        <li>&#10003; No messages during night hours (10 PM - 7 AM)</li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </SectionCard>
          )}

          {/* === PROFILE VIEWERS === */}
          <button
            onClick={() => navigate('/profile-viewers')}
            className="w-full flex items-center justify-between p-4 transition-all active:scale-[0.99]"
            style={{
              background: 'var(--m3-surface-container-lowest)',
              borderRadius: 'var(--m3-shape-lg)',
              boxShadow: 'var(--m3-elevation-1)',
            }}
            data-testid="view-profile-viewers"
          >
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl" style={{ background: 'var(--m3-tertiary-container)' }}>
                <Eye className="w-5 h-5" style={{ color: 'var(--m3-tertiary)' }} />
              </div>
              <div className="text-left">
                <h3 className="font-semibold text-sm" style={{ color: 'var(--m3-on-surface)' }}>Profile Viewers</h3>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>See who viewed your profile</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5" style={{ color: 'var(--m3-outline)' }} />
          </button>

          {/* === TRUST BADGE === */}
          <div className="p-4" style={{
            background: 'var(--m3-surface-container-lowest)',
            borderRadius: 'var(--m3-shape-lg)',
            boxShadow: 'var(--m3-elevation-1)',
          }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="p-2.5 rounded-xl" style={{
                background: profile.trust_badge_level === 'high' ? 'rgba(16,185,129,0.15)'
                  : profile.trust_badge_level === 'medium' ? 'rgba(245,158,11,0.15)' : 'var(--m3-surface-container-high)',
              }}>
                <Shield className="w-5 h-5" style={{
                  color: profile.trust_badge_level === 'high' ? '#10B981'
                    : profile.trust_badge_level === 'medium' ? '#F59E0B' : 'var(--m3-outline)',
                }} />
              </div>
              <div>
                <h3 className="font-semibold text-sm" style={{ color: 'var(--m3-on-surface)' }}>Trust Badge Level</h3>
                <p className="text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>Your verified trust status</p>
              </div>
            </div>
            
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full font-semibold text-xs" style={{
              background: profile.trust_badge_level === 'high' ? 'rgba(16,185,129,0.15)'
                : profile.trust_badge_level === 'medium' ? 'rgba(245,158,11,0.15)' : 'var(--m3-surface-container-high)',
              color: profile.trust_badge_level === 'high' ? '#10B981'
                : profile.trust_badge_level === 'medium' ? '#F59E0B' : 'var(--m3-on-surface-variant)',
            }}>
              <Shield className="w-3.5 h-3.5" />
              {(profile.trust_badge_level || 'low').toUpperCase()} TRUST
            </span>
            
            <p className="text-[11px] mt-2.5" style={{ color: 'var(--m3-outline)' }}>
              Complete your profile and get verified to increase your trust level.
            </p>
          </div>

          {/* === SAFETY TIPS === */}
          <div className="p-4 m3-animate-in" style={{
            background: 'var(--m3-surface-container)',
            borderRadius: 'var(--m3-shape-lg)',
            border: '1.5px solid rgba(59,130,246,0.3)',
          }}>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl flex-shrink-0" style={{ background: 'rgba(59,130,246,0.15)' }}>
                <AlertTriangle className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold mb-2" style={{ color: 'var(--m3-on-surface)' }}>Safety Tips</h3>
                <ul className="space-y-1.5 text-xs" style={{ color: 'var(--m3-on-surface-variant)' }}>
                  <li>&#8226; Block and report users who make you uncomfortable</li>
                  <li>&#8226; Never share personal info like address or finances</li>
                  <li>&#8226; Meet in public places for first dates</li>
                  <li>&#8226; Tell a friend where you are going</li>
                  <li>&#8226; Trust your instincts - if something feels wrong, leave</li>
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
