import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import {
  Shield, AlertTriangle, Eye, Ban, CheckCircle, Clock,
  RefreshCw, ChevronDown, ChevronUp, Zap, Moon, MessageSquare
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SEVERITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  none: 'bg-gray-100 text-gray-600 border-gray-200',
};

const TYPE_ICONS = {
  ai_detection: AlertTriangle,
  safe_word_triggered: Zap,
};

const SafetyDashboard = () => {
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [safeWords, setSafeWords] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/safety-reports?limit=50');
      setReports(res.data.reports || []);
      setAlerts(res.data.alerts || []);
      setStats(res.data.stats || {});
    } catch (e) {
      console.error('Failed to load safety data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBanUser = async (userId) => {
    try {
      await adminApi.post('/admin/block-user', { user_id: userId, reason: 'Manual ban from safety review' });
      toast.success('User banned');
      fetchData();
    } catch (e) {
      toast.error('Ban failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleDismissReport = async (reportId) => {
    try {
      await adminApi.put('/admin/safety-config', { dismissed_report: reportId });
      setReports(prev => prev.filter(r => r.created_at !== reportId));
      toast.success('Report dismissed');
    } catch {
      toast.error('Failed');
    }
  };

  const updateSafeWords = async () => {
    setSavingConfig(true);
    try {
      const words = safeWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      await adminApi.put('/admin/safety-config', { safe_words: words });
      toast.success(`${words.length} safe words saved`);
    } catch (e) {
      toast.error('Failed');
    }
    setSavingConfig(false);
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-24 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5" data-testid="safety-dashboard">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-5 text-white">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Safety Dashboard</h2>
            <p className="text-xs text-white/70">AI detection, safe words & reports</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { fetchData(); toast.success('Refreshed'); }}
            className="ml-auto text-white hover:bg-white/20"
            data-testid="safety-refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.total_reports || 0}</p>
            <p className="text-[10px] text-white/70">Total Reports</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.ai_detections || 0}</p>
            <p className="text-[10px] text-white/70">AI Detections</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.safe_word_triggers || 0}</p>
            <p className="text-[10px] text-white/70">Safe Words</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{stats.auto_bans || 0}</p>
            <p className="text-[10px] text-white/70">Auto Bans</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-300">{stats.unread_alerts || 0}</p>
            <p className="text-[10px] text-white/70">Unread Alerts</p>
          </div>
        </div>
      </div>

      {/* Emergency Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2" data-testid="safety-alerts">
          <h3 className="text-sm font-bold text-red-600 flex items-center gap-2">
            <Zap className="w-4 h-4" /> Emergency Alerts ({alerts.length})
          </h3>
          {alerts.slice(0, 5).map((alert, i) => (
            <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-red-800">
                  Safe Word triggered by <span className="font-bold">{alert.girl_name}</span>
                </p>
                <p className="text-xs text-red-600">
                  Against user: {alert.reported_user_id?.substring(0, 8)}... | {new Date(alert.created_at).toLocaleString('en-IN')}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => handleBanUser(alert.reported_user_id)}
                data-testid={`ban-alert-${i}`}
              >
                <Ban className="w-3 h-3 mr-1" /> Ban
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Reports List */}
      <div data-testid="safety-reports-list">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> Recent Reports ({reports.length})
        </h3>

        {reports.length === 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
            <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
            <p className="text-sm text-green-700">No safety reports yet. All clear!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {reports.map((r, i) => {
              const Icon = TYPE_ICONS[r.type] || AlertTriangle;
              const isExpanded = expandedReport === i;
              const severityClass = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.none;

              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`report-${i}`}>
                  <div
                    className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
                    onClick={() => setExpandedReport(isExpanded ? null : i)}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${r.type === 'safe_word_triggered' ? 'bg-red-100' : 'bg-orange-100'}`}>
                      <Icon className={`w-4 h-4 ${r.type === 'safe_word_triggered' ? 'text-red-600' : 'text-orange-600'}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-800 truncate">
                          {r.type === 'safe_word_triggered' ? 'Safe Word Emergency' : 'AI Detection'}
                        </p>
                        {r.severity && r.severity !== 'none' && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${severityClass}`}>
                            {r.severity.toUpperCase()}
                          </span>
                        )}
                        {r.auto_action === 'banned' && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white">
                            AUTO-BANNED
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {r.sender_id?.substring(0, 8)}... → {r.receiver_id?.substring(0, 8) || r.reported_user?.substring(0, 8)}... | {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-2">
                      {r.content && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">Message Content</p>
                          <p className="text-sm text-gray-800 bg-white rounded-lg p-2 border mt-1">"{r.content}"</p>
                        </div>
                      )}
                      {r.reason && (
                        <div>
                          <p className="text-[10px] text-gray-500 uppercase font-bold">AI Reason</p>
                          <p className="text-sm text-gray-700 mt-1">{r.reason}</p>
                        </div>
                      )}
                      {r.warning_number && (
                        <p className="text-xs text-orange-600">Warning #{r.warning_number}</p>
                      )}
                      {r.safe_word_used && (
                        <p className="text-xs text-red-600">Safe word: "{r.safe_word_used}"</p>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => handleBanUser(r.sender_id || r.reported_user)}
                          data-testid={`ban-report-${i}`}
                        >
                          <Ban className="w-3 h-3 mr-1" /> Ban User
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleDismissReport(r.created_at)}
                        >
                          <CheckCircle className="w-3 h-3 mr-1" /> Dismiss
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Safe Words Config */}
      <div className="bg-white rounded-xl border border-gray-200 p-4" data-testid="safe-words-config">
        <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
          <Shield className="w-4 h-4 text-red-500" /> Safe Words Configuration
        </h3>
        <p className="text-xs text-gray-500 mb-3">Comma-separated keywords. Girl types any of these → instant block + report.</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={safeWords}
            onChange={(e) => setSafeWords(e.target.value)}
            placeholder="heartlink sos, i feel unsafe, hl sos"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            data-testid="safe-words-input"
          />
          <Button
            size="sm"
            onClick={updateSafeWords}
            disabled={savingConfig}
            className="bg-red-500 hover:bg-red-600 text-white"
            data-testid="safe-words-save"
          >
            {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
        <p className="text-[10px] text-gray-400 mt-2">Defaults: "heartlink sos", "i feel unsafe", "hl sos"</p>
      </div>
    </div>
  );
};

export default SafetyDashboard;
