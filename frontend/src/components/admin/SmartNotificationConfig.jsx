import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import {
  Bell, BellRing, UserPlus, Clock, CalendarDays,
  Repeat, Sparkles, TrendingUp, RefreshCw, Save,
  ToggleLeft, ToggleRight, Gauge, BarChart3, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const NOTIF_TYPES = [
  { key: 'welcome_enabled', label: 'Welcome Push', desc: 'Naye user ko signup ke turant baad welcome FCM bhejo', icon: Sparkles, color: 'text-emerald-500', bg: 'bg-emerald-50' },
  { key: 'profile_reminder_enabled', label: 'Profile Completion', desc: '24 ghante baad incomplete profile walo ko reminder', icon: UserPlus, color: 'text-blue-500', bg: 'bg-blue-50' },
  { key: 'new_user_discovery_enabled', label: 'New User Discovery', desc: 'Naya user join kare toh opposite gender ko alert', icon: BellRing, color: 'text-pink-500', bg: 'bg-pink-50' },
  { key: 'comeback_3d_enabled', label: '3-Day Comeback', desc: '3 din inactive users ko wapas bulao', icon: Clock, color: 'text-amber-500', bg: 'bg-amber-50' },
  { key: 'comeback_7d_enabled', label: '7-Day Comeback', desc: '7 din inactive users ko final reminder', icon: CalendarDays, color: 'text-red-500', bg: 'bg-red-50' },
  { key: 'daily_engagement_enabled', label: 'Daily Engagement', desc: 'Daily picks, unread reminders, smart re-engagement', icon: Repeat, color: 'text-violet-500', bg: 'bg-violet-50' },
  { key: 'weekend_special_enabled', label: 'Weekend Special', desc: 'Saturday-Sunday special notification blast', icon: Zap, color: 'text-orange-500', bg: 'bg-orange-50' },
  { key: 'girls_retention_enabled', label: 'Girls Retention', desc: '3 din inactive girls ko personalized push — "tumhe miss kar rahe hai!"', icon: BellRing, color: 'text-rose-500', bg: 'bg-rose-50' },
];

const SmartNotificationConfig = () => {
  const [config, setConfig] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [recent24h, setRecent24h] = useState(0);
  const [typeBreakdown, setTypeBreakdown] = useState({});
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/notification-config');
      setConfig(res.data.config || {});
      setAnalytics(res.data.analytics || {});
      setRecent24h(res.data.recent_24h || 0);
      setTypeBreakdown(res.data.type_breakdown_24h || {});
    } catch (e) {
      console.error('Failed to load notification config', e);
    }
  }, []);

  const fetchChart = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/notification-analytics-chart?days=7');
      setChartData(res.data.chart || []);
    } catch (e) {
      console.error('Failed to load chart', e);
    }
  }, []);

  useEffect(() => {
    Promise.all([fetchConfig(), fetchChart()]).finally(() => setLoading(false));
  }, [fetchConfig, fetchChart]);

  const toggleKey = (key) => {
    setConfig(prev => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const setMaxDaily = (val) => {
    const num = Math.max(1, Math.min(10, parseInt(val) || 3));
    setConfig(prev => ({ ...prev, max_notifications_per_user_per_day: num }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.put('/admin/notification-config', config);
      toast.success('Notification config saved!');
      setDirty(false);
      fetchConfig();
    } catch (e) {
      toast.error('Save failed: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
    }
  };

  const maxChart = Math.max(...chartData.map(d => d.total), 1);

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-6 animate-pulse">
        <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-gray-100 dark:bg-gray-800 rounded-lg" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg overflow-hidden" data-testid="smart-notification-config">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-500 to-purple-600 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Bell className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Smart Notifications</h2>
              <p className="text-xs text-white/70">Behavior-based retention system</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { fetchConfig(); fetchChart(); toast.success('Refreshed!'); }}
              className="text-white hover:bg-white/20"
              data-testid="notif-config-refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            {dirty && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
                className="bg-white text-indigo-600 hover:bg-white/90"
                data-testid="notif-config-save"
              >
                {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-1" /> : <Save className="w-4 h-4 mr-1" />}
                Save
              </Button>
            )}
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{recent24h}</p>
            <p className="text-xs text-white/70">Last 24h</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{Object.keys(typeBreakdown).length}</p>
            <p className="text-xs text-white/70">Active Types</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-white">{config.max_notifications_per_user_per_day || 3}</p>
            <p className="text-xs text-white/70">Max/User/Day</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 7-Day Chart */}
        {chartData.length > 0 && (
          <div data-testid="notif-chart-7day">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">7-Day Notification Volume</h3>
            </div>
            <div className="flex items-end gap-1.5 h-24">
              {chartData.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-gray-500 font-medium">{d.total}</span>
                  <div
                    className="w-full bg-gradient-to-t from-indigo-500 to-purple-400 rounded-t-sm transition-all duration-300"
                    style={{ height: `${Math.max((d.total / maxChart) * 100, 4)}%`, minHeight: '3px' }}
                  />
                  <span className="text-[9px] text-gray-400">{d.date.split(' ')[1]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 24h Type Breakdown */}
        {Object.keys(typeBreakdown).length > 0 && (
          <div data-testid="notif-type-breakdown">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" />
              <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">24h Breakdown</h3>
            </div>
            <div className="flex flex-wrap gap-2">
              {Object.entries(typeBreakdown).map(([type, count]) => (
                <span key={type} className="px-2.5 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-xs font-medium text-gray-700 dark:text-gray-300">
                  {type.replace(/_/g, ' ')}: <span className="text-indigo-600 dark:text-indigo-400 font-bold">{count}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Frequency Limit */}
        <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl" data-testid="notif-frequency-limit">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg flex items-center justify-center">
              <Gauge className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Max Notifications / User / Day</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Spam se bachne ke liye daily limit</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMaxDaily((config.max_notifications_per_user_per_day || 3) - 1)}
              className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center text-lg font-bold hover:bg-gray-300"
              data-testid="notif-freq-minus"
            >-</button>
            <span className="w-8 text-center text-lg font-bold text-indigo-600 dark:text-indigo-400" data-testid="notif-freq-value">
              {config.max_notifications_per_user_per_day || 3}
            </span>
            <button
              onClick={() => setMaxDaily((config.max_notifications_per_user_per_day || 3) + 1)}
              className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center justify-center text-lg font-bold hover:bg-gray-300"
              data-testid="notif-freq-plus"
            >+</button>
          </div>
        </div>

        {/* Toggle Cards */}
        <div className="space-y-2">
          {NOTIF_TYPES.map(({ key, label, desc, icon: Icon, color, bg }) => {
            const enabled = config[key] !== false;
            const sentCount = analytics[`${key.replace('_enabled', '')}_sent`] || 0;
            return (
              <div
                key={key}
                className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                  enabled
                    ? 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
                    : 'border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 opacity-60'
                }`}
                data-testid={`notif-toggle-${key}`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className={`w-9 h-9 ${bg} dark:bg-opacity-20 rounded-lg flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">{label}</p>
                      {sentCount > 0 && (
                        <span className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-[10px] text-gray-500 font-medium">
                          {sentCount} sent
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{desc}</p>
                  </div>
                </div>
                <button
                  onClick={() => toggleKey(key)}
                  className="flex-shrink-0 ml-3"
                  data-testid={`notif-toggle-btn-${key}`}
                >
                  {enabled ? (
                    <ToggleRight className="w-10 h-10 text-indigo-500" />
                  ) : (
                    <ToggleLeft className="w-10 h-10 text-gray-300 dark:text-gray-600" />
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Save Button (bottom sticky for mobile) */}
        {dirty && (
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white"
            data-testid="notif-config-save-bottom"
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
            Save Configuration
          </Button>
        )}
      </div>
    </div>
  );
};

export default SmartNotificationConfig;
