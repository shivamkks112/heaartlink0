import { useState, useEffect } from 'react';
import { Rocket, Send, RefreshCw, Shield, AlertTriangle } from 'lucide-react';
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
      const res = await adminApi.put('/admin/app-update', config);
      setConfig(res.data);
      toast.success('Update config saved!');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Save failed');
    }
    setSaving(false);
  };

  const handleSendNotification = async () => {
    setSending(true);
    setShowConfirm(false);
    try {
      const res = await adminApi.post('/admin/app-update/send-notification', {
        title: config.update_title,
        message: config.update_message,
      });
      toast.success(`Notification sent! Targeted: ${res.data.result?.total_targeted || 0} users`);
      fetchConfig(); // refresh history
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
        <h3 className="text-lg font-bold text-gray-900">App Update Settings</h3>
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
            <p className="text-xs text-gray-500">Configure Play Store update prompts & notifications</p>
          </div>
        </div>
        <Button onClick={fetchConfig} variant="ghost" size="sm" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-blue-50 rounded-xl p-3 text-center border border-blue-100">
          <p className="text-xl font-bold text-blue-700">{analytics.update_prompt_shown || 0}</p>
          <p className="text-[10px] text-blue-500 font-medium">Prompts Shown</p>
        </div>
        <div className="bg-emerald-50 rounded-xl p-3 text-center border border-emerald-100">
          <p className="text-xl font-bold text-emerald-700">{analytics.update_prompt_clicked || 0}</p>
          <p className="text-[10px] text-emerald-500 font-medium">Clicked Update</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 text-center border border-gray-200">
          <p className="text-xl font-bold text-gray-700">{analytics.update_prompt_dismissed || 0}</p>
          <p className="text-[10px] text-gray-500 font-medium">Dismissed</p>
        </div>
      </div>

      {/* Config Fields */}
      <div className="bg-white rounded-xl border p-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Latest Version Code</label>
            <Input
              type="number"
              value={config.latest_version_code || 0}
              onChange={e => updateField('latest_version_code', parseInt(e.target.value) || 0)}
              data-testid="version-code-input"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Latest Version Name</label>
            <Input
              type="text"
              value={config.latest_version_name || ''}
              onChange={e => updateField('latest_version_name', e.target.value)}
              data-testid="version-name-input"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Update Title</label>
          <Input
            type="text"
            value={config.update_title || ''}
            onChange={e => updateField('update_title', e.target.value)}
            data-testid="update-title-input"
          />
        </div>

        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">Update Message</label>
          <textarea
            value={config.update_message || ''}
            onChange={e => updateField('update_message', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none resize-none focus:ring-2 focus:ring-emerald-300"
            data-testid="update-message-input"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Dismiss Cooldown (hours)</label>
            <Input
              type="number"
              value={config.min_dismiss_hours || 24}
              onChange={e => updateField('min_dismiss_hours', parseInt(e.target.value) || 24)}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Play Store URL</label>
            <Input
              type="text"
              value={config.play_store_url || ''}
              onChange={e => updateField('play_store_url', e.target.value)}
              className="text-xs"
            />
          </div>
        </div>

        {/* Toggles */}
        <div className="flex gap-4">
          <label className="flex items-center gap-2 cursor-pointer" data-testid="update-enabled-toggle">
            <input
              type="checkbox"
              checked={config.update_enabled !== false}
              onChange={e => updateField('update_enabled', e.target.checked)}
              className="w-4 h-4 accent-emerald-500"
            />
            <span className="text-sm font-medium text-gray-700">Update Enabled</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer" data-testid="force-update-toggle">
            <input
              type="checkbox"
              checked={config.force_update === true}
              onChange={e => updateField('force_update', e.target.checked)}
              className="w-4 h-4 accent-red-500"
            />
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Shield className="w-3 h-3 text-red-500" /> Force Update
            </span>
          </label>
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full bg-emerald-600 hover:bg-emerald-700">
          {saving ? 'Saving...' : 'Save Config'}
        </Button>
      </div>

      {/* Send Notification */}
      <div className="bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-xl p-4">
        <div className="flex items-center gap-3 mb-3">
          <Send className="w-5 h-5 text-emerald-600" />
          <div>
            <p className="font-semibold text-gray-900 text-sm">Send Update Push Notification</p>
            <p className="text-xs text-gray-500">Sends FCM push to all users with tokens ({totalSent} sent so far)</p>
          </div>
        </div>

        {!showConfirm ? (
          <Button
            onClick={() => setShowConfirm(true)}
            disabled={sending}
            variant="outline"
            className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-100"
            data-testid="send-update-notif-btn"
          >
            <Send className="w-4 h-4 mr-2" />
            Send Update Notification to All Users
          </Button>
        ) : (
          <div className="bg-white rounded-lg p-3 border border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <p className="text-sm font-medium text-gray-800">Send update notification to eligible users?</p>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSendNotification}
                disabled={sending}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                data-testid="confirm-send-btn"
              >
                {sending ? 'Sending...' : 'Yes, Send Now'}
              </Button>
              <Button
                onClick={() => setShowConfirm(false)}
                variant="ghost"
                size="sm"
              >
                Cancel
              </Button>
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
              <div key={i} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded-lg">
                <span className="font-medium text-gray-700 truncate flex-1">{h.title}</span>
                <span className="text-gray-400 ml-2 flex-shrink-0">
                  {new Date(h.sent_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AppUpdateSettings;
