import { useState, useEffect } from 'react';
import { Rocket, Send, RefreshCw, Shield, AlertTriangle, Check, Bell, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import adminApi from '@/utils/adminApi';

const AppUpdateSettings = () => {
  const [config, setConfig] = useState(null);
  const [analytics, setAnalytics] = useState({});
  const [history, setHistory] = useState([]);
  const [totalSent, setTotalSent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [autoNotify, setAutoNotify] = useState(true);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/app-update');
      setConfig(res.data.config);
      setAnalytics(res.data.analytics || {});
      setHistory(res.data.notification_history || []);
      setTotalSent(res.data.total_notifications_sent || 0);
    } catch (err) {
      toast.error('Failed to load update config');
    }
    setLoading(false);
  };

  useEffect(() => { fetchConfig(); }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = { ...config, auto_notify: autoNotify };
      const res = await adminApi.put('/admin/app-update', payload);
      
      if (res.data.auto_notification_sent) {
        toast.success('Config saved + Update notification auto-sent to all users!', { duration: 5000 });
      } else {
        toast.success('Update config saved!');
      }
      
      setConfig(res.data);
      fetchConfig(); // Refresh history
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    }
    setSaving(false);
  };

  const handleManualSend = async () => {
    setSending(true);
    setShowConfirm(false);
    try {
      const res = await adminApi.post('/admin/app-update/send-notification', {
        title: config.update_title,
        message: config.update_message,
      });
      toast.success(`Notification sent! Targeted: ${res.data.result?.total_targeted || 0} users`);
      fetchConfig();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Send failed');
    }
    setSending(false);
  };

  const updateField = (key, value) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  if (loading || !config) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-gray-900">App Update Control</h3>
        <div className="h-40 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="app-update-settings">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
            <Rocket className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900">App Update Control</h3>
            <p className="text-xs text-gray-500">Version config + Auto/Manual push notifications</p>
          </div>
        </div>
        <Button onClick={fetchConfig} variant="ghost" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-lg font-bold text-blue-700">{analytics.update_prompt_shown || 0}</p>
          <p className="text-[9px] text-blue-500 font-medium">Shown</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-lg font-bold text-emerald-700">{analytics.update_prompt_clicked || 0}</p>
          <p className="text-[9px] text-emerald-500 font-medium">Clicked</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
          <p className="text-lg font-bold text-gray-700">{analytics.update_prompt_dismissed || 0}</p>
          <p className="text-[9px] text-gray-500 font-medium">Dismissed</p>
        </div>
        <div className="bg-amber-50 rounded-xl p-3 text-center border border-amber-100">
          <p className="text-lg font-bold text-amber-700">{totalSent}</p>
          <p className="text-[9px] text-amber-500 font-medium">Push Sent</p>
        </div>
      </div>

      {/* Config Fields */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Shield className="w-4 h-4 text-gray-400" /> Version Config
        </h4>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Version Code (versionCode)</label>
            <Input
              type="number"
              value={config.latest_version_code || 0}
              onChange={e => updateField('latest_version_code', parseInt(e.target.value) || 0)}
              data-testid="version-code-input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Version Name</label>
            <Input
              type="text"
              value={config.latest_version_name || ''}
              onChange={e => updateField('latest_version_name', e.target.value)}
              data-testid="version-name-input"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Notification Title</label>
          <Input
            type="text"
            value={config.update_title || ''}
            onChange={e => updateField('update_title', e.target.value)}
            data-testid="update-title-input"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Notification Message</label>
          <textarea
            value={config.update_message || ''}
            onChange={e => updateField('update_message', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-emerald-300"
            data-testid="update-message-input"
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-wrap gap-4">
          <label className="flex items-center gap-2 cursor-pointer" data-testid="update-enabled-toggle">
            <input type="checkbox" checked={config.update_enabled !== false}
              onChange={e => updateField('update_enabled', e.target.checked)}
              className="w-4 h-4 accent-emerald-500" />
            <span className="text-sm font-medium text-gray-700">In-App Prompt</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" data-testid="force-update-toggle">
            <input type="checkbox" checked={config.force_update === true}
              onChange={e => updateField('force_update', e.target.checked)}
              className="w-4 h-4 accent-red-500" />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Shield className="w-3 h-3 text-red-500" /> Force Update
            </span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer" data-testid="auto-notify-toggle">
            <input type="checkbox" checked={autoNotify}
              onChange={e => setAutoNotify(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Zap className="w-3 h-3 text-blue-500" /> Auto-send push on save
            </span>
          </label>
        </div>

        {/* Auto info */}
        {autoNotify && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 flex items-start gap-2">
            <Zap className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-blue-700">
              <b>Automatic:</b> Jab aap version code badhayenge aur Save karenge, push notification automatically sabhi users ko chali jaayegi.
            </p>
          </div>
        )}

        <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
          {saving ? 'Saving...' : autoNotify ? 'Save & Auto-Send Notification' : 'Save Config'}
        </Button>
      </div>

      {/* Manual Send */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Bell className="w-5 h-5 text-amber-600" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Manual Push (Anytime)</p>
            <p className="text-xs text-gray-500">Version change ke bina bhi notification bhej sakte ho</p>
          </div>
        </div>

        {!showConfirm ? (
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={sending}
            variant="outline"
            className="w-full border-amber-300 text-amber-700 hover:bg-amber-100"
            data-testid="manual-send-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Push Notification Now
          </Button>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-800">Sabhi users ko notification bhejni hai?</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleManualSend} disabled={sending} size="sm" className="bg-amber-600 hover:bg-amber-700" data-testid="confirm-manual-send">
                {sending ? 'Sending...' : 'Haan, Bhejo'}
              </Button>
              <Button onClick={() => setShowConfirm(false)} variant="ghost" size="sm">Cancel</Button>
            </div>
          </div>
        )}
      </div>

      {/* Recent History */}
      {history.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Notifications</h4>
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between text-xs p-2.5 bg-gray-50 rounded-lg gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {h.source === 'auto_version_change' ? (
                    <Zap className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                  ) : (
                    <Bell className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                  )}
                  <span className="font-medium text-gray-700 truncate">{h.title}</span>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${h.source === 'auto_version_change' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
                    {h.source === 'auto_version_change' ? 'AUTO' : 'MANUAL'}
                  </span>
                  <span className="text-gray-400">
                    {new Date(h.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppUpdateSettings;
