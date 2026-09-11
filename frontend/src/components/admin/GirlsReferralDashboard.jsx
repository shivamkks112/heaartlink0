import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import {
  Users, Heart, TrendingUp, Crown, Gift, RefreshCw,
  BarChart3, Award, ArrowUpRight
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const GirlsReferralDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/girls-referral-tracking');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load girls referral data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-32 bg-gray-200 rounded-xl" />
        <div className="h-40 bg-gray-100 rounded-xl" />
      </div>
    );
  }

  if (!data) return <p className="text-gray-500 text-center py-8">Failed to load data</p>;

  const maxTrend = Math.max(...data.weekly_trend.map(w => w.girls_signup), 1);

  return (
    <div className="space-y-5" data-testid="girls-referral-dashboard">
      {/* Header */}
      <div className="bg-gradient-to-r from-pink-500 to-rose-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <Heart className="w-5 h-5 text-white" fill="white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Girls Acquisition Tracker</h2>
              <p className="text-xs text-white/70">Referrals, signups & conversion metrics</p>
            </div>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => { fetchData(); toast.success('Refreshed'); }}
            className="text-white hover:bg-white/20"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{data.total_girls}</p>
            <p className="text-[10px] text-white/70">Total Girls</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{data.total_boys}</p>
            <p className="text-[10px] text-white/70">Total Boys</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-yellow-300">{data.gender_ratio}</p>
            <p className="text-[10px] text-white/70">Gender Ratio</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{data.referral_conversion_rate}%</p>
            <p className="text-[10px] text-white/70">Referral Rate</p>
          </div>
        </div>
      </div>

      {/* Referral Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="w-9 h-9 bg-purple-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Gift className="w-4 h-4 text-purple-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{data.girls_via_referral}</p>
          <p className="text-xs text-gray-500">Girls via Referral</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="w-9 h-9 bg-amber-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Crown className="w-4 h-4 text-amber-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{data.girls_premium}</p>
          <p className="text-xs text-gray-500">Girls with Premium</p>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="w-9 h-9 bg-emerald-100 rounded-lg flex items-center justify-center mx-auto mb-2">
            <Award className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-xl font-bold text-gray-900">{data.boys_with_invite_premium}</p>
          <p className="text-xs text-gray-500">Boys Earned Premium</p>
        </div>
      </div>

      {/* Weekly Trend Chart */}
      <div className="bg-white rounded-xl border p-4" data-testid="weekly-girls-trend">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-pink-500" />
          <h3 className="text-sm font-bold text-gray-700">Weekly Girl Signups (Last 4 Weeks)</h3>
        </div>
        <div className="flex items-end gap-3 h-28">
          {data.weekly_trend.map((w, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs font-bold text-gray-700">{w.girls_signup}</span>
              <div
                className="w-full bg-gradient-to-t from-pink-500 to-rose-400 rounded-t-md transition-all duration-300"
                style={{ height: `${Math.max((w.girls_signup / maxTrend) * 100, 6)}%`, minHeight: '4px' }}
              />
              <span className="text-[9px] text-gray-400 text-center leading-tight">{w.week}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top Referrers */}
      <div className="bg-white rounded-xl border p-4" data-testid="top-referrers">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-emerald-500" />
          <h3 className="text-sm font-bold text-gray-700">Top Girl Inviters</h3>
        </div>
        {data.top_referrers.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No referrals yet. Boys need to invite girls!</p>
        ) : (
          <div className="space-y-2">
            {data.top_referrers.map((ref, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${i === 0 ? 'bg-amber-500' : i === 1 ? 'bg-gray-400' : i === 2 ? 'bg-orange-400' : 'bg-gray-300'}`}>
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{ref.name}</p>
                    <p className="text-[10px] text-gray-400">{ref.email || ref.referral_code}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-pink-600">{ref.girls_invited}</span>
                  <span className="text-xs text-gray-400">girls</span>
                  {ref.girls_invited >= 3 && (
                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GirlsReferralDashboard;
