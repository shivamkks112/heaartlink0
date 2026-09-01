import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import { 
  TrendingUp, Users, UserPlus, Download, ArrowDown, 
  RefreshCw, AlertTriangle, Calendar, Globe, Smartphone,
  ChevronRight, User
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const FunnelBar = ({ label, value, total, color }) => {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="w-36 text-xs font-medium text-gray-600 text-right">{label}</div>
      <div className="flex-1 bg-gray-100 rounded-full h-7 relative overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all duration-500`} style={{ width: `${Math.max(pct, 2)}%` }} />
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-800">
          {value.toLocaleString()} ({pct}%)
        </span>
      </div>
    </div>
  );
};

const MetricCard = ({ label, value, sub, color = 'bg-blue-50', iconColor = 'bg-blue-500', icon: Icon = TrendingUp }) => (
  <div className={`${color} rounded-xl p-4 shadow-sm`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-xs text-gray-500 font-medium">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{typeof value === 'number' ? value.toLocaleString() : value}</p>
        {sub && <p className="text-[11px] text-gray-400 mt-0.5">{sub}</p>}
      </div>
      <div className={`p-2.5 ${iconColor} rounded-full`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
    </div>
  </div>
);

const SourceRow = ({ name, data }) => (
  <div className="flex items-center justify-between py-3 border-b border-gray-100 last:border-0">
    <div className="flex items-center gap-2">
      <Globe className="w-4 h-4 text-gray-400" />
      <span className="text-sm font-medium text-gray-700">{name}</span>
    </div>
    <div className="flex items-center gap-6 text-sm">
      <span className="text-gray-600">{data.installs} installs</span>
      <span className="text-green-600 font-medium">{data.signups} signups</span>
      <span className="text-blue-600 font-semibold">{data.conversion_rate}%</span>
    </div>
  </div>
);

const GrowthAcquisition = () => {
  const [stats, setStats] = useState(null);
  const [table, setTable] = useState(null);
  const [retention, setRetention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [period, setPeriod] = useState('today');
  const [tablePage, setTablePage] = useState(1);
  const [sendingDigest, setSendingDigest] = useState(false);

  const fetchGrowthStats = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.get('/admin/growth-stats', { 
        params: { period, _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' }
      });
      setStats(res.data);
    } catch (e) {
      if (e.response?.status === 404) {
        // Endpoint not deployed yet — show empty state
        setStats({ installs: { total: 0, today: 0, this_week: 0, this_month: 0, period: 0 }, signups: { today: 0, this_week: 0, this_month: 0, period: 0 }, not_registered: 0, conversion_rate: 0, source_breakdown: {}, gender_breakdown: { male: 0, female: 0, other: 0 }, funnel: { app_install: 0, app_opened: 0, signup_started: 0, signup_completed: 0, first_login: 0, active_user: 0 }, active_users: { today: 0, this_week: 0 } });
      } else {
        const msg = e.response?.data?.detail || e.message || 'Failed to load growth stats';
        setError(msg);
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }, [period]);

  const fetchTable = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/acquisition-table', { 
        params: { page: tablePage, limit: 10, _t: Date.now() } 
      });
      setTable(res.data);
    } catch (e) {
      console.error('Acquisition table error:', e);
    }
  }, [tablePage]);

  const fetchRetention = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/retention-chart', { 
        params: { days: 7, _t: Date.now() } 
      });
      setRetention(res.data?.retention || []);
    } catch (e) {
      if (e.response?.status !== 404) console.error('Retention chart error:', e);
    }
  }, []);

  const sendDigestNow = async () => {
    setSendingDigest(true);
    try {
      await adminApi.post('/admin/send-weekly-digest-now');
      toast.success('Weekly digest email sent!');
    } catch (e) {
      toast.error('Failed to send digest: ' + (e.response?.data?.detail || e.message));
    } finally {
      setSendingDigest(false);
    }
  };

  useEffect(() => { fetchGrowthStats(); }, [fetchGrowthStats]);
  useEffect(() => { fetchTable(); }, [fetchTable]);
  useEffect(() => { fetchRetention(); }, [fetchRetention]);

  // Auto-refresh every 30s
  useEffect(() => {
    const iv = setInterval(() => { fetchGrowthStats(); fetchTable(); fetchRetention(); }, 30000);
    return () => clearInterval(iv);
  }, [fetchGrowthStats, fetchTable, fetchRetention]);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-3" />
        <p className="text-sm font-medium text-red-800 mb-1">Failed to load growth data</p>
        <p className="text-xs text-red-600 mb-3">{error}</p>
        <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={fetchGrowthStats}>Retry</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Period Filter */}
      <div className="flex items-center gap-2 flex-wrap">
        <Calendar className="w-4 h-4 text-gray-400" />
        {[
          { key: 'today', label: 'Today' },
          { key: 'yesterday', label: 'Yesterday' },
          { key: 'week', label: 'Last 7 Days' },
          { key: 'month', label: 'Last 30 Days' },
        ].map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            data-testid={`period-${p.key}`}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              period === p.key ? 'bg-pink-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.label}
          </button>
        ))}
        <Button size="sm" variant="outline" className="ml-auto" onClick={() => { fetchGrowthStats(); fetchTable(); }} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {/* Install & Signup Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total Installs" value={stats?.installs?.total || 0} sub="All time" icon={Download} color="bg-indigo-50" iconColor="bg-indigo-500" />
        <MetricCard label="Installs Today" value={stats?.installs?.today || 0} icon={Smartphone} color="bg-blue-50" iconColor="bg-blue-500" />
        <MetricCard label="Installs This Week" value={stats?.installs?.this_week || 0} icon={TrendingUp} color="bg-cyan-50" iconColor="bg-cyan-500" />
        <MetricCard label="Installs This Month" value={stats?.installs?.this_month || 0} icon={TrendingUp} color="bg-teal-50" iconColor="bg-teal-500" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Signups Today" value={stats?.signups?.today || 0} icon={UserPlus} color="bg-green-50" iconColor="bg-green-500" />
        <MetricCard label="Signups This Week" value={stats?.signups?.this_week || 0} icon={UserPlus} color="bg-emerald-50" iconColor="bg-emerald-500" />
        <MetricCard label="Signups This Month" value={stats?.signups?.this_month || 0} icon={UserPlus} color="bg-lime-50" iconColor="bg-lime-600" />
        <MetricCard label="Not Registered" value={stats?.not_registered || 0} sub="Installed but didn't signup" icon={Users} color="bg-amber-50" iconColor="bg-amber-500" />
      </div>

      {/* Conversion Rate */}
      <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-xl p-5 border border-pink-100">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600">Signup Conversion Rate ({period})</p>
            <p className="text-4xl font-bold text-pink-600">{stats?.conversion_rate || 0}%</p>
            <p className="text-xs text-gray-400 mt-1">
              {stats?.signups?.period || 0} signups / {stats?.installs?.period || 0} installs
            </p>
          </div>
          <TrendingUp className="w-12 h-12 text-pink-300" />
        </div>
      </div>

      {/* Gender Breakdown */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">Gender Breakdown (New Signups - {period})</h3>
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{stats?.gender_breakdown?.male || 0}</p>
            <p className="text-xs text-gray-500">Male</p>
          </div>
          <div className="text-center p-3 bg-pink-50 rounded-lg">
            <p className="text-2xl font-bold text-pink-600">{stats?.gender_breakdown?.female || 0}</p>
            <p className="text-xs text-gray-500">Female</p>
          </div>
          <div className="text-center p-3 bg-gray-50 rounded-lg">
            <p className="text-2xl font-bold text-gray-600">{stats?.gender_breakdown?.other || 0}</p>
            <p className="text-xs text-gray-500">Other</p>
          </div>
        </div>
      </div>

      {/* Acquisition Source Breakdown */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">Acquisition Sources ({period})</h3>
        {stats?.source_breakdown && Object.entries(stats.source_breakdown).map(([src, data]) => (
          <SourceRow key={src} name={src.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())} data={data} />
        ))}
        {!stats?.source_breakdown && <p className="text-sm text-gray-400 text-center py-4">No data</p>}
      </div>

      {/* Funnel */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">Acquisition Funnel ({period})</h3>
        {stats?.funnel && (
          <div>
            <FunnelBar label="App Install" value={stats.funnel.app_install} total={stats.funnel.app_install} color="bg-indigo-400" />
            <FunnelBar label="App Opened" value={stats.funnel.app_opened} total={stats.funnel.app_install} color="bg-blue-400" />
            <FunnelBar label="Signup Started" value={stats.funnel.signup_started} total={stats.funnel.app_install} color="bg-cyan-400" />
            <FunnelBar label="Signup Completed" value={stats.funnel.signup_completed} total={stats.funnel.app_install} color="bg-green-400" />
            <FunnelBar label="First Login" value={stats.funnel.first_login} total={stats.funnel.app_install} color="bg-emerald-400" />
            <FunnelBar label="Active User" value={stats.funnel.active_user} total={stats.funnel.app_install} color="bg-pink-500" />
          </div>
        )}
      </div>

      {/* 7-Day Retention Chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">7-Day Retention (Users who came back today)</h3>
        {retention && retention.length > 0 ? (
          <div>
            <div className="flex items-end gap-2 h-48 mb-3">
              {retention.map((d, i) => {
                const maxH = 160;
                const barH = Math.max(d.retention_pct / 100 * maxH, 4);
                return (
                  <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1">
                    <span className="text-[10px] font-bold text-gray-700">{d.retention_pct}%</span>
                    <div 
                      className="w-full rounded-t-md transition-all duration-500"
                      style={{ 
                        height: `${barH}px`, 
                        background: d.retention_pct > 30 ? 'linear-gradient(180deg, #10b981, #059669)' : 
                                    d.retention_pct > 10 ? 'linear-gradient(180deg, #f59e0b, #d97706)' : 
                                    'linear-gradient(180deg, #ef4444, #dc2626)',
                        minWidth: '24px'
                      }}
                    />
                    <span className="text-[10px] text-gray-500">{d.day}</span>
                  </div>
                );
              })}
            </div>
            <div className="grid grid-cols-7 gap-2 text-center text-[10px] text-gray-500">
              {retention.map((d, i) => (
                <div key={i}>
                  <span className="font-medium text-gray-700">{d.returned_today}</span>/{d.cohort_size}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 text-center py-8">No retention data yet</p>
        )}
      </div>

      {/* Weekly Email Digest */}
      <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-xl p-5 border border-indigo-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-sm text-gray-800">Weekly Growth Email Digest</h3>
            <p className="text-xs text-gray-500 mt-1">Auto-sent every Monday 9 AM IST to shivamkks112@gmail.com</p>
          </div>
          <Button 
            size="sm" 
            className="bg-indigo-500 hover:bg-indigo-600" 
            onClick={sendDigestNow}
            disabled={sendingDigest}
            data-testid="send-digest-btn"
          >
            {sendingDigest ? 'Sending...' : 'Send Now'}
          </Button>
        </div>
      </div>

      {/* Acquisition Table */}
      <div className="bg-white rounded-xl p-5 shadow-sm">
        <h3 className="font-bold text-sm text-gray-800 mb-3">Recent Acquisition Records</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2 pr-3">Install ID</th>
                <th className="pb-2 pr-3">First Open</th>
                <th className="pb-2 pr-3">Source</th>
                <th className="pb-2 pr-3">Status</th>
                <th className="pb-2 pr-3">Signup Date</th>
                <th className="pb-2 pr-3">Last Active</th>
                <th className="pb-2 pr-3">Platform</th>
                <th className="pb-2">User</th>
              </tr>
            </thead>
            <tbody>
              {table?.records?.map((r, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-2 pr-3 font-mono text-gray-600">{r.installation_id}</td>
                  <td className="py-2 pr-3 text-gray-600">{r.first_open ? new Date(r.first_open).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      r.source === 'meta_ads' ? 'bg-blue-100 text-blue-700' :
                      r.source === 'google_ads' ? 'bg-red-100 text-red-700' :
                      r.source === 'organic' ? 'bg-green-100 text-green-700' :
                      r.source === 'referral' ? 'bg-purple-100 text-purple-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {r.source}
                    </span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      r.signup_status === 'registered' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                    }`}>
                      {r.signup_status === 'registered' ? 'Registered' : 'Not Registered'}
                    </span>
                  </td>
                  <td className="py-2 pr-3 text-gray-600">{r.signup_date ? new Date(r.signup_date).toLocaleDateString('en-IN') : '-'}</td>
                  <td className="py-2 pr-3 text-gray-600">{r.last_active ? new Date(r.last_active).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td className="py-2 pr-3">
                    <span className={`px-2 py-0.5 rounded-full ${r.platform === 'android' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                      {r.platform}
                    </span>
                  </td>
                  <td className="py-2">
                    {r.user ? (
                      <div className="flex items-center gap-1.5">
                        {r.user.profile_picture ? (
                          <img src={r.user.profile_picture} alt="" className="w-5 h-5 rounded-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-gray-400" />
                        )}
                        <span className="text-gray-700 font-medium">{r.user.name}</span>
                      </div>
                    ) : '-'}
                  </td>
                </tr>
              ))}
              {(!table?.records || table.records.length === 0) && (
                <tr><td colSpan={8} className="py-8 text-center text-gray-400">No install records yet</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {table && table.pages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button size="sm" variant="outline" disabled={tablePage <= 1} onClick={() => setTablePage(p => p - 1)}>Prev</Button>
            <span className="text-xs text-gray-500">Page {tablePage} of {table.pages}</span>
            <Button size="sm" variant="outline" disabled={tablePage >= table.pages} onClick={() => setTablePage(p => p + 1)}>Next</Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default GrowthAcquisition;
