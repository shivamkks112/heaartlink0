import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import {
  Shield, AlertTriangle, Ban, CheckCircle, RefreshCw,
  ChevronDown, ChevronUp, Zap, User, Unlock, Lock,
  Search, MessageSquare, Eye
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SEVERITY_COLORS = {
  high: 'bg-red-100 text-red-700 border-red-200',
  medium: 'bg-orange-100 text-orange-700 border-orange-200',
  low: 'bg-yellow-100 text-yellow-700 border-yellow-200',
  none: 'bg-gray-100 text-gray-600 border-gray-200',
};

const SafetyDashboard = () => {
  const [reports, setReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({});
  const [bannedUsers, setBannedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedReport, setExpandedReport] = useState(null);
  const [activeSection, setActiveSection] = useState('alerts');
  const [safeWords, setSafeWords] = useState('');
  const [savingConfig, setSavingConfig] = useState(false);
  const [searchBanned, setSearchBanned] = useState('');
  const [reviewingUser, setReviewingUser] = useState(null);
  const [chatHistory, setChatHistory] = useState(null);
  const [loadingChat, setLoadingChat] = useState(false);
  const [banModal, setBanModal] = useState(null); // { userId, userName }

  const fetchData = useCallback(async () => {
    try {
      const [reportsRes, bannedRes] = await Promise.all([
        adminApi.get('/admin/safety-reports?limit=50'),
        adminApi.get('/admin/safety-banned-users'),
      ]);
      setReports(reportsRes.data.reports || []);
      setAlerts(reportsRes.data.alerts || []);
      setStats(reportsRes.data.stats || {});
      setBannedUsers(bannedRes.data.banned_users || []);
    } catch (e) {
      console.error('Failed to load safety data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleBan = async (userId, userName) => {
    setBanModal({ userId, userName });
  };

  const executeBan = async (duration) => {
    if (!banModal) return;
    const { userId, userName } = banModal;
    try {
      await adminApi.post('/admin/safety-ban', { user_id: userId, reason: 'Banned from safety review', duration });
      const label = duration === '24h' ? '24 hours' : duration === '7d' ? '7 days' : 'permanently';
      toast.success(`${userName || 'User'} banned for ${label}`);
      setBanModal(null);
      fetchData();
    } catch (e) {
      toast.error('Ban failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  const handleUnban = async (userId, userName) => {
    if (!confirm(`Unban ${userName || 'this user'}? Warnings reset ho jayenge.`)) return;
    try {
      await adminApi.post('/admin/safety-unban', { user_id: userId });
      toast.success(`${userName || 'User'} unbanned + warnings reset`);
      setReviewingUser(null);
      setChatHistory(null);
      fetchData();
    } catch (e) {
      toast.error('Unban failed: ' + (e.response?.data?.detail || e.message));
    }
  };

  const reviewChatHistory = async (userId) => {
    if (reviewingUser === userId) { setReviewingUser(null); setChatHistory(null); return; }
    setReviewingUser(userId);
    setLoadingChat(true);
    try {
      const res = await adminApi.get(`/admin/user-chat-history/${userId}?limit=50`);
      setChatHistory(res.data);
    } catch (e) {
      toast.error('Chat load failed');
      setChatHistory(null);
    }
    setLoadingChat(false);
  };

  const updateSafeWords = async () => {
    setSavingConfig(true);
    try {
      const words = safeWords.split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
      await adminApi.put('/admin/safety-config', { safe_words: words });
      toast.success(`${words.length} safe words saved`);
    } catch { toast.error('Failed'); }
    setSavingConfig(false);
  };

  const filteredBanned = bannedUsers.filter(u =>
    !searchBanned || (u.name || '').toLowerCase().includes(searchBanned.toLowerCase()) ||
    (u.email || '').toLowerCase().includes(searchBanned.toLowerCase())
  );

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-24 bg-gray-200 rounded-xl" /><div className="h-40 bg-gray-100 rounded-xl" /></div>;
  }

  const sections = [
    { id: 'alerts', label: 'Alerts', count: alerts.length, color: 'text-red-600' },
    { id: 'reports', label: 'Reports', count: reports.length, color: 'text-orange-600' },
    { id: 'banned', label: 'Banned', count: bannedUsers.length, color: 'text-purple-600' },
    { id: 'config', label: 'Config', count: null, color: 'text-gray-600' },
  ];

  return (
    <div className="space-y-4" data-testid="safety-dashboard">
      {/* Header Stats */}
      <div className="bg-gradient-to-r from-red-500 to-orange-500 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Safety Dashboard</h2>
              <p className="text-xs text-white/70">AI detection, safe words, ban/unban</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { fetchData(); toast.success('Refreshed'); }} className="text-white hover:bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { val: stats.total_reports || 0, label: 'Total Reports' },
            { val: stats.ai_detections || 0, label: 'AI Detections' },
            { val: stats.safe_word_triggers || 0, label: 'Safe Words' },
            { val: stats.auto_bans || 0, label: 'Auto Bans' },
            { val: bannedUsers.length, label: 'Currently Banned', highlight: true },
          ].map((s, i) => (
            <div key={i} className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
              <p className={`text-2xl font-bold ${s.highlight ? 'text-yellow-300' : ''}`}>{s.val}</p>
              <p className="text-[10px] text-white/70">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1" data-testid="safety-section-tabs">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setActiveSection(s.id)}
            className={`flex-1 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
              activeSection === s.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
            data-testid={`safety-tab-${s.id}`}
          >
            {s.label}
            {s.count !== null && s.count > 0 && (
              <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-[10px] ${
                activeSection === s.id ? 'bg-red-100 text-red-600' : 'bg-gray-200 text-gray-500'
              }`}>{s.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ═══ ALERTS SECTION ═══ */}
      {activeSection === 'alerts' && (
        <div className="space-y-2" data-testid="safety-alerts-section">
          {alerts.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-700 font-medium">No emergency alerts. All safe!</p>
            </div>
          ) : (
            alerts.map((alert, i) => (
              <div key={i} className="bg-red-50 border border-red-200 rounded-xl p-4" data-testid={`alert-${i}`}>
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-red-200 rounded-lg flex items-center justify-center">
                      <Zap className="w-4 h-4 text-red-700" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-red-800">SOS: {alert.girl_name} feels unsafe!</p>
                      <p className="text-[10px] text-red-500">{new Date(alert.created_at).toLocaleString('en-IN')}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-red-100 mb-3 text-xs space-y-1">
                  <p><span className="font-bold text-gray-500">Girl:</span> <span className="text-gray-800">{alert.girl_name}</span></p>
                  <p><span className="font-bold text-gray-500">Against:</span> <span className="text-gray-800 font-medium">{alert.reported_user_name || alert.reported_user_id?.substring(0, 12)}</span> {alert.reported_user_email && <span className="text-gray-400">({alert.reported_user_email})</span>}</p>
                  {alert.safe_word_used && <p><span className="font-bold text-gray-500">Safe Word:</span> <span className="text-red-600 font-mono">"{alert.safe_word_used}"</span></p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="destructive" onClick={() => handleBan(alert.reported_user_id, alert.reported_user_name)} data-testid={`ban-alert-${i}`}>
                    <Ban className="w-3 h-3 mr-1" /> Ban User
                  </Button>
                  <Button size="sm" variant="outline" className="text-green-600 border-green-300 hover:bg-green-50" onClick={() => handleUnban(alert.reported_user_id, alert.reported_user_name)}>
                    <Unlock className="w-3 h-3 mr-1" /> Unban
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ REPORTS SECTION ═══ */}
      {activeSection === 'reports' && (
        <div className="space-y-2" data-testid="safety-reports-section">
          {reports.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-700">No safety reports yet. All clear!</p>
            </div>
          ) : (
            reports.map((r, i) => {
              const isExpanded = expandedReport === i;
              const isSafeWord = r.type === 'safe_word_triggered';
              const severityClass = SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.none;

              return (
                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`report-${i}`}>
                  <div className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50" onClick={() => setExpandedReport(isExpanded ? null : i)}>
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${isSafeWord ? 'bg-red-100' : 'bg-orange-100'}`}>
                      {isSafeWord ? <Zap className="w-4 h-4 text-red-600" /> : <AlertTriangle className="w-4 h-4 text-orange-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-gray-800">{isSafeWord ? 'Safe Word' : 'AI Detection'}</p>
                        {r.severity && r.severity !== 'none' && (
                          <span className={`px-1.5 py-0.5 text-[10px] font-bold rounded border ${severityClass}`}>{r.severity.toUpperCase()}</span>
                        )}
                        {r.auto_action === 'banned' && <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-red-600 text-white">AUTO-BANNED</span>}
                      </div>
                      <p className="text-xs text-gray-500 truncate">
                        {r.sender_name || r.triggered_by_name || '?'} → {r.receiver_name || r.reported_user_name || '?'} | {new Date(r.created_at).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>

                  {isExpanded && (
                    <div className="border-t border-gray-100 p-3 bg-gray-50 space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-white rounded-lg p-2.5 border">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{isSafeWord ? 'Girl (Reporter)' : 'Sender'}</p>
                          <p className="text-sm font-semibold text-gray-900">{r.sender_name || r.triggered_by_name || 'Unknown'}</p>
                          {r.sender_email && <p className="text-[10px] text-gray-400">{r.sender_email}</p>}
                          {r.sender_age && <p className="text-[10px] text-gray-400">{r.sender_age} yrs, {r.sender_location || ''}</p>}
                        </div>
                        <div className="bg-white rounded-lg p-2.5 border">
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1">{isSafeWord ? 'Reported User' : 'Sent To'}</p>
                          <p className="text-sm font-semibold text-gray-900">{r.receiver_name || r.reported_user_name || 'Unknown'}</p>
                          {(r.reported_user_email) && <p className="text-[10px] text-gray-400">{r.reported_user_email}</p>}
                        </div>
                      </div>
                      {r.content && (
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold">Message</p>
                          <p className="text-sm text-red-700 bg-red-50 rounded-lg p-2 border border-red-100 mt-1 font-mono">"{r.content}"</p>
                        </div>
                      )}
                      {r.reason && <p className="text-xs text-gray-600"><span className="font-bold">AI Reason:</span> {r.reason}</p>}
                      {r.warning_number && <p className="text-xs text-orange-600 font-medium">Warning #{r.warning_number}/3</p>}
                      {r.safe_word_used && <p className="text-xs text-red-600 font-medium">Safe word: "{r.safe_word_used}"</p>}
                      <div className="flex gap-2 pt-1">
                        <Button size="sm" variant="destructive" onClick={() => handleBan(r.sender_id || r.reported_user, r.sender_name || r.reported_user_name)}>
                          <Ban className="w-3 h-3 mr-1" /> Ban
                        </Button>
                        <Button size="sm" variant="outline" className="text-green-600 border-green-300" onClick={() => handleUnban(r.sender_id || r.reported_user, r.sender_name || r.reported_user_name)}>
                          <Unlock className="w-3 h-3 mr-1" /> Unban
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ═══ BANNED USERS SECTION ═══ */}
      {activeSection === 'banned' && (
        <div className="space-y-3" data-testid="safety-banned-section">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchBanned}
              onChange={(e) => setSearchBanned(e.target.value)}
              placeholder="Search banned users..."
              className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-500 focus:border-transparent"
              data-testid="banned-search"
            />
          </div>

          {filteredBanned.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-green-700">{searchBanned ? 'No results found' : 'No banned users. Everyone is good!'}</p>
            </div>
          ) : (
            filteredBanned.map((u, i) => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden" data-testid={`banned-user-${i}`}>
                <div className="p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {u.photos?.[0] ? (
                        <img src={u.photos[0]} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="w-5 h-5 text-red-400" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-gray-900">{u.name || 'Unknown'}</p>
                        <Lock className="w-3 h-3 text-red-500" />
                        {u.safety_warnings > 0 && (
                          <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-orange-100 text-orange-700">{u.safety_warnings} warnings</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400">{u.email || ''} {u.age ? `| ${u.age} yrs` : ''} {u.gender ? `| ${u.gender}` : ''} {u.location ? `| ${u.location}` : ''}</p>
                      <p className="text-[10px] text-red-500 mt-0.5">
                        {u.block_reason || 'No reason'} {u.banned_at ? `| ${new Date(u.banned_at).toLocaleDateString('en-IN')}` : ''}
                        {u.ban_duration && u.ban_duration !== 'permanent' && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 font-bold">
                            {u.ban_duration === '24h' ? '24hr' : '7-day'} ban
                            {u.ban_expires_at && ` · expires ${new Date(u.ban_expires_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`}
                          </span>
                        )}
                        {(!u.ban_duration || u.ban_duration === 'permanent') && (
                          <span className="ml-1 px-1.5 py-0.5 rounded bg-gray-800 text-white font-bold">Permanent</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                      onClick={() => reviewChatHistory(u.id)}
                      data-testid={`review-chat-${i}`}
                    >
                      <Eye className="w-3 h-3 mr-1" /> Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-300 hover:bg-green-50"
                      onClick={() => handleUnban(u.id, u.name)}
                      data-testid={`unban-user-${i}`}
                    >
                      <Unlock className="w-3 h-3 mr-1" /> Unban
                    </Button>
                  </div>
                </div>
                
                {/* Chat History Review Panel */}
                {reviewingUser === u.id && (
                  <div className="border-t border-gray-100 bg-gray-50 p-3" data-testid={`chat-review-${i}`}>
                    {loadingChat ? (
                      <div className="flex items-center justify-center py-6">
                        <RefreshCw className="w-5 h-5 text-gray-400 animate-spin" />
                        <span className="text-sm text-gray-500 ml-2">Loading chat history...</span>
                      </div>
                    ) : chatHistory ? (
                      <div className="space-y-3">
                        {/* Safety Reports */}
                        {chatHistory.safety_reports?.length > 0 && (
                          <div>
                            <p className="text-[10px] text-red-500 uppercase font-bold mb-1.5">Flagged Messages</p>
                            <div className="space-y-1">
                              {chatHistory.safety_reports.map((r, ri) => (
                                <div key={ri} className="bg-red-50 border border-red-100 rounded-lg p-2 text-xs">
                                  <div className="flex items-center gap-2 mb-0.5">
                                    <span className={`px-1 py-0.5 rounded text-[9px] font-bold ${SEVERITY_COLORS[r.severity] || SEVERITY_COLORS.none}`}>{(r.severity || 'none').toUpperCase()}</span>
                                    <span className="text-gray-500">Warning #{r.warning_number} → {r.receiver_name || '?'}</span>
                                  </div>
                                  <p className="text-red-700 font-mono">"{r.content}"</p>
                                  {r.reason && <p className="text-gray-500 mt-0.5">AI: {r.reason}</p>}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        
                        {/* Chat Messages */}
                        <div>
                          <p className="text-[10px] text-gray-400 uppercase font-bold mb-1.5">
                            Recent Messages ({chatHistory.messages?.length || 0}) across {chatHistory.total_matches} matches
                          </p>
                          <div className="max-h-64 overflow-y-auto space-y-1 bg-white rounded-lg border p-2">
                            {(chatHistory.messages || []).length === 0 ? (
                              <p className="text-xs text-gray-400 text-center py-3">No messages found</p>
                            ) : (
                              chatHistory.messages.map((msg, mi) => (
                                <div key={mi} className={`flex gap-2 ${msg.is_own ? '' : 'flex-row-reverse'}`}>
                                  <div className={`max-w-[80%] px-2.5 py-1.5 rounded-lg text-xs ${
                                    msg.is_own ? 'bg-pink-50 text-pink-900 border border-pink-100' : 'bg-gray-100 text-gray-700'
                                  }`}>
                                    <div className="flex items-center gap-1 mb-0.5">
                                      <span className="font-bold text-[10px]">{msg.is_own ? u.name : msg.other_user_name}</span>
                                      {msg.is_ai_match && <span className="text-[8px] bg-purple-100 text-purple-600 px-1 rounded">AI</span>}
                                    </div>
                                    <p>{msg.content}</p>
                                    <p className="text-[9px] text-gray-400 mt-0.5 text-right">
                                      {new Date(msg.created_at).toLocaleString('en-IN', {day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit'})}
                                    </p>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 pt-1">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-300 flex-1" onClick={() => handleUnban(u.id, u.name)}>
                            <Unlock className="w-3 h-3 mr-1" /> Unban — Innocent
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-300 flex-1" onClick={() => { setReviewingUser(null); toast.info('Ban maintained'); }}>
                            <Lock className="w-3 h-3 mr-1" /> Keep Banned
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400 text-center py-4">Failed to load</p>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ═══ CONFIG SECTION ═══ */}
      {activeSection === 'config' && (
        <div className="space-y-4" data-testid="safety-config-section">
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
              <Shield className="w-4 h-4 text-red-500" /> Safe Words Configuration
            </h3>
            <p className="text-xs text-gray-500 mb-3">Comma-separated keywords. Girl types any of these → instant block + report + admin FCM alert.</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={safeWords}
                onChange={(e) => setSafeWords(e.target.value)}
                placeholder="heartlink sos, i feel unsafe, hl sos"
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                data-testid="safe-words-input"
              />
              <Button size="sm" onClick={updateSafeWords} disabled={savingConfig} className="bg-red-500 hover:bg-red-600 text-white" data-testid="safe-words-save">
                {savingConfig ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Save'}
              </Button>
            </div>
            <p className="text-[10px] text-gray-400 mt-2">Defaults: "heartlink sos", "i feel unsafe", "hl sos"</p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <h3 className="text-sm font-bold text-blue-800 mb-2">How Safety System Works</h3>
            <div className="text-xs text-blue-700 space-y-1.5">
              <p><span className="font-bold">AI Detection:</span> Har message AI se check hota hai. Inappropriate → sender ko warning. 3 warnings → auto-ban.</p>
              <p><span className="font-bold">Safe Word:</span> Girl chat mein safe word type kare → instantly block + report + admin ko FCM push.</p>
              <p><span className="font-bold">Night Safety:</span> 11PM-6AM new matches (48hr) ke boys girl ko msg nahi bhej sakte.</p>
              <p><span className="font-bold">Admin FCM:</span> Safe word trigger + auto-ban pe sabhi admins ko instant push notification with full details.</p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ BAN DURATION MODAL ═══ */}
      {banModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setBanModal(null)} data-testid="ban-duration-modal">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-3">
                <Ban className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Ban {banModal.userName || 'User'}</h3>
              <p className="text-xs text-gray-500 mt-1">Select ban duration</p>
            </div>
            <div className="space-y-2">
              <button onClick={() => executeBan('24h')} className="w-full p-3 rounded-xl border-2 border-orange-200 bg-orange-50 hover:bg-orange-100 text-left transition-all" data-testid="ban-24h">
                <p className="text-sm font-bold text-orange-800">24 Hours</p>
                <p className="text-[10px] text-orange-600">Temporary — auto-unban after 24 hours</p>
              </button>
              <button onClick={() => executeBan('7d')} className="w-full p-3 rounded-xl border-2 border-red-200 bg-red-50 hover:bg-red-100 text-left transition-all" data-testid="ban-7d">
                <p className="text-sm font-bold text-red-800">7 Days</p>
                <p className="text-[10px] text-red-600">Week ban — auto-unban after 7 days</p>
              </button>
              <button onClick={() => executeBan('permanent')} className="w-full p-3 rounded-xl border-2 border-gray-800 bg-gray-900 hover:bg-black text-left transition-all" data-testid="ban-permanent">
                <p className="text-sm font-bold text-white">Permanent Ban</p>
                <p className="text-[10px] text-gray-400">Manual unban required</p>
              </button>
            </div>
            <button onClick={() => setBanModal(null)} className="w-full py-2 text-sm text-gray-500 hover:text-gray-700" data-testid="ban-cancel">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SafetyDashboard;
