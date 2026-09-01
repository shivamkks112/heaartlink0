import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import { Heart, Sparkles, MessageCircle, Save, ToggleLeft, ToggleRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const Toggle = ({ label, desc, field, value, onChange, icon: Icon, color }) => (
  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
    <div className="flex items-center gap-3">
      <div className={`w-10 h-10 ${color} rounded-lg flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h4 className="font-semibold text-gray-900 text-sm">{label}</h4>
        <p className="text-xs text-gray-500">{desc}</p>
      </div>
    </div>
    <button
      onClick={() => onChange(!value)}
      data-testid={`welcome-toggle-${field}`}
      className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
        value ? 'bg-green-500' : 'bg-gray-300'
      }`}
    >
      <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
        value ? 'translate-x-7' : 'translate-x-0.5'
      }`} />
    </button>
  </div>
);

const TextInput = ({ label, field, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
    <input
      type="text"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      data-testid={`welcome-input-${field}`}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none"
    />
  </div>
);

const TextArea = ({ label, field, value, onChange, placeholder }) => (
  <div>
    <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
    <textarea
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={3}
      data-testid={`welcome-textarea-${field}`}
      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-pink-300 focus:border-pink-400 outline-none resize-none"
    />
  </div>
);

const WelcomeSettings = () => {
  const [settings, setSettings] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [saving, setSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/welcome-settings', { params: { _t: Date.now() } });
      setSettings(res.data.settings);
      setAnalytics(res.data.analytics || {});
    } catch (e) {
      toast.error('Failed to load welcome settings');
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      await adminApi.put('/admin/welcome-settings', settings);
      toast.success('Welcome settings saved!');
    } catch (e) {
      toast.error('Failed to save: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const update = (key, value) => setSettings(prev => ({ ...prev, [key]: value }));

  if (!settings) return <p className="text-sm text-gray-400 text-center py-8">Loading welcome settings...</p>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-800 text-lg">Welcome Messages</h3>
          <p className="text-xs text-gray-500">Personalized messages for new and returning users. Use {'{firstName}'} and {'{fullName}'} as variables.</p>
        </div>
        <Button onClick={saveSettings} disabled={saving} className="bg-pink-500 hover:bg-pink-600" data-testid="save-welcome-btn">
          <Save className="w-4 h-4 mr-1" /> {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {/* Toggles */}
      <Toggle label="New User Welcome" desc="Show welcome popup after first signup" field="new_user_enabled" value={settings.new_user_enabled} onChange={(v) => update('new_user_enabled', v)} icon={Heart} color="bg-pink-500" />
      <Toggle label="Returning User Welcome" desc="Show welcome back popup after inactivity" field="returning_user_enabled" value={settings.returning_user_enabled} onChange={(v) => update('returning_user_enabled', v)} icon={Sparkles} color="bg-purple-500" />

      {/* Inactivity Days */}
      <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
        <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 text-sm">Returning User Inactivity Period</h4>
          <p className="text-xs text-gray-500">Days before showing "Welcome Back"</p>
        </div>
        <input
          type="number"
          min={1}
          max={90}
          value={settings?.returning_inactivity_days || 7}
          onChange={(e) => update('returning_inactivity_days', parseInt(e.target.value) || 7)}
          data-testid="welcome-inactivity-days"
          className="w-16 px-2 py-1.5 text-sm text-center border rounded-lg"
        />
        <span className="text-sm text-gray-500">days</span>
      </div>

      {/* New User Message Editor */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h4 className="font-semibold text-sm text-pink-600 flex items-center gap-2">
          <Heart className="w-4 h-4" /> New User Message
        </h4>
        <TextInput label="Title" field="new_user_title" value={settings.new_user_title} onChange={(v) => update('new_user_title', v)} placeholder="Welcome to HeartLink" />
        <TextArea label="Message" field="new_user_message" value={settings.new_user_message} onChange={(v) => update('new_user_message', v)} placeholder="We're happy to have you here..." />
        <TextInput label="CTA Button" field="new_user_cta" value={settings.new_user_cta} onChange={(v) => update('new_user_cta', v)} placeholder="Explore HeartLink" />
      </div>

      {/* Returning User Message Editor */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        <h4 className="font-semibold text-sm text-purple-600 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Welcome Back Message
        </h4>
        <TextInput label="Title" field="returning_user_title" value={settings.returning_user_title} onChange={(v) => update('returning_user_title', v)} placeholder="Welcome back, {firstName}!" />
        <TextArea label="Message" field="returning_user_message" value={settings.returning_user_message} onChange={(v) => update('returning_user_message', v)} placeholder="We've missed you..." />
        <TextInput label="CTA Button" field="returning_user_cta" value={settings.returning_user_cta} onChange={(v) => update('returning_user_cta', v)} placeholder="Continue Exploring" />
      </div>

      {/* Analytics */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-100 rounded-xl p-4">
        <h4 className="font-semibold text-sm text-gray-800 mb-3">Welcome Analytics</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xl font-bold text-pink-600">{analytics?.new_user_welcome_shown || 0}</p>
            <p className="text-[10px] text-gray-500">New Welcome Shown</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xl font-bold text-green-600">{analytics?.new_user_welcome_clicked || 0}</p>
            <p className="text-[10px] text-gray-500">New Welcome Clicked</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xl font-bold text-purple-600">{analytics?.welcome_back_shown || 0}</p>
            <p className="text-[10px] text-gray-500">Welcome Back Shown</p>
          </div>
          <div className="p-3 bg-white rounded-lg shadow-sm">
            <p className="text-xl font-bold text-blue-600">{analytics?.welcome_back_clicked || 0}</p>
            <p className="text-[10px] text-gray-500">Welcome Back Clicked</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeSettings;
