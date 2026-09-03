import { useState, useEffect } from 'react';
import { BarChart2, DollarSign, Target, Tv, TrendingUp, Users, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import adminApi from '@/utils/adminApi';

const AdAnalyticsPanel = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await adminApi.get('/admin/ad-analytics');
      setData(res.data);
    } catch (err) {
      console.error('Ad analytics fetch failed:', err);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  if (loading && !data) {
    return (
      <div className="space-y-4" data-testid="ad-analytics-panel">
        <h2 className="text-xl font-bold text-gray-900">Ad Analytics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <div key={i} className="h-28 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      </div>
    );
  }

  if (!data) return null;
  const s = data.summary;
  const tb = data.type_breakdown || {};
  const rb = data.reward_breakdown || {};
  const daily = data.daily_impressions || [];
  const topUsers = data.top_users || [];
  const maxDaily = Math.max(...daily.map(d => d.count), 1);

  return (
    <div className="space-y-6" data-testid="ad-analytics-panel">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Ad Analytics</h2>
        <Button onClick={fetchData} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard icon={<Target className="w-5 h-5 text-blue-600" />} bg="bg-blue-50"
          label="Total Impressions" value={s.total_impressions} sub={`Today: ${s.today_impressions}`} />
        <SummaryCard icon={<Tv className="w-5 h-5 text-purple-600" />} bg="bg-purple-50"
          label="This Week" value={s.week_impressions} sub={`30d: ${s.month_impressions}`} />
        <SummaryCard icon={<Users className="w-5 h-5 text-emerald-600" />} bg="bg-emerald-50"
          label="Unique Users" value={s.unique_users_total} sub={`Today: ${s.unique_users_today}`} />
        <SummaryCard icon={<DollarSign className="w-5 h-5 text-amber-600" />} bg="bg-amber-50"
          label="Est. Revenue" value={`$${s.estimated_revenue_usd}`} sub="Based on eCPM" />
      </div>

      {/* Ad Type + Rewards Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Impressions by Type */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-blue-500" /> Impressions by Type
          </h3>
          {Object.keys(tb).length === 0 ? (
            <p className="text-sm text-gray-400">No impressions recorded yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(tb).map(([type, count]) => {
                const total = Object.values(tb).reduce((a, b) => a + b, 0);
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const colors = {
                  interstitial: 'bg-blue-500',
                  rewarded: 'bg-purple-500',
                  banner: 'bg-emerald-500',
                };
                return (
                  <div key={type}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="capitalize font-medium text-gray-700">{type}</span>
                      <span className="text-gray-500">{count} ({pct}%)</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${colors[type] || 'bg-gray-400'}`}
                        style={{ width: `${pct}%`, transition: 'width 0.5s ease' }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rewards Breakdown */}
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-500" /> Rewards Given
          </h3>
          {Object.keys(rb).length === 0 ? (
            <p className="text-sm text-gray-400">No rewards earned yet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(rb).map(([type, info]) => (
                <div key={type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-700 capitalize text-sm">{type.replace(/_/g, ' ')}</p>
                    <p className="text-xs text-gray-400">{info.count} times</p>
                  </div>
                  <span className="text-lg font-bold text-purple-600">{info.total_amount}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Daily Chart (last 7 days) */}
      <div className="bg-white rounded-xl border p-5">
        <h3 className="font-semibold text-gray-800 mb-4">Daily Impressions (Last 7 Days)</h3>
        {daily.length === 0 ? (
          <p className="text-sm text-gray-400">No data available yet</p>
        ) : (
          <div className="flex items-end gap-2 h-40">
            {daily.map((d) => (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-gray-600">{d.count}</span>
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-md"
                  style={{
                    height: `${Math.max((d.count / maxDaily) * 100, 4)}%`,
                    minHeight: '4px',
                    transition: 'height 0.5s ease',
                  }}
                />
                <span className="text-[10px] text-gray-400">
                  {new Date(d.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Top Users */}
      {topUsers.length > 0 && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-semibold text-gray-800 mb-4">Top Users by Ad Views</h3>
          <div className="space-y-2">
            {topUsers.map((u, i) => (
              <div key={u.user_id} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-gray-700">{u.name}</span>
                </div>
                <span className="text-sm text-gray-500">{u.impressions} views</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const SummaryCard = ({ icon, bg, label, value, sub }) => (
  <div className={`${bg} rounded-xl p-4 border`} data-testid={`ad-stat-${label.toLowerCase().replace(/ /g, '-')}`}>
    <div className="flex items-center gap-2 mb-2">
      {icon}
      <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
    </div>
    <p className="text-2xl font-bold text-gray-900">{value}</p>
    {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
  </div>
);

export default AdAnalyticsPanel;
