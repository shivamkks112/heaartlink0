import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import {
  Users, TrendingUp, RefreshCw, Download, AlertTriangle,
  ArrowDown, UserPlus, Mail, CheckCircle, Heart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const SignupFunnelDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const res = await adminApi.get('/admin/signup-funnel?days=30');
      setData(res.data);
    } catch (e) {
      console.error('Failed to load funnel data', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (loading) {
    return <div className="animate-pulse space-y-4"><div className="h-32 bg-gray-200 rounded-xl" /></div>;
  }

  if (!data) return <p className="text-gray-500 text-center py-8">Failed to load</p>;

  const { funnel, gender_breakdown, conversion_rates, recent_signups, dropped_off_emails, drop_off_count } = data;
  const maxFunnel = Math.max(funnel.installs, funnel.otp_sent, funnel.otp_verified, funnel.signup_completed, 1);

  const steps = [
    { label: 'App Installs', value: funnel.installs, icon: Download, color: 'from-blue-500 to-cyan-500', rate: null },
    { label: 'OTP Requested', value: funnel.otp_sent, icon: Mail, color: 'from-purple-500 to-violet-500', rate: conversion_rates.install_to_otp },
    { label: 'OTP Verified', value: funnel.otp_verified, icon: CheckCircle, color: 'from-amber-500 to-orange-500', rate: conversion_rates.otp_to_verify },
    { label: 'Signup Done', value: funnel.signup_completed, icon: UserPlus, color: 'from-emerald-500 to-green-500', rate: conversion_rates.verify_to_signup },
  ];

  return (
    <div className="space-y-5" data-testid="signup-funnel-dashboard">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-500 to-purple-600 rounded-xl p-5 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Signup Funnel (30 days)</h2>
              <p className="text-xs text-white/70">Install → OTP → Verify → Signup</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => { fetchData(); toast.success('Refreshed'); }} className="text-white hover:bg-white/20">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Overall conversion + Gender split */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">{conversion_rates.overall}%</p>
            <p className="text-[10px] text-white/70">Overall Conversion</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-pink-300">{gender_breakdown.girls}</p>
            <p className="text-[10px] text-white/70">Girls Signed Up</p>
          </div>
          <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-blue-300">{gender_breakdown.boys}</p>
            <p className="text-[10px] text-white/70">Boys Signed Up</p>
          </div>
        </div>
      </div>

      {/* Funnel Visualization */}
      <div className="bg-white rounded-xl border p-4" data-testid="funnel-chart">
        <h3 className="text-sm font-bold text-gray-700 mb-4">Conversion Funnel</h3>
        <div className="space-y-3">
          {steps.map((step, i) => {
            const Icon = step.icon;
            const pct = (step.value / maxFunnel) * 100;
            return (
              <div key={i}>
                {i > 0 && (
                  <div className="flex items-center justify-center py-1">
                    <ArrowDown className="w-4 h-4 text-gray-300" />
                    <span className="text-[10px] text-gray-400 ml-1">{step.rate}% conversion</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${step.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-medium text-gray-700">{step.label}</span>
                      <span className="text-sm font-bold text-gray-900">{step.value}</span>
                    </div>
                    <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${step.color} rounded-full transition-all duration-500`}
                        style={{ width: `${Math.max(pct, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Drop-offs Alert */}
      {drop_off_count > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4" data-testid="dropoff-section">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h3 className="text-sm font-bold text-red-700">
              {drop_off_count} users started signup but didn't complete
            </h3>
          </div>
          <p className="text-xs text-red-600 mb-2">Yeh log OTP request kiye but signup complete nahi kiya:</p>
          <div className="flex flex-wrap gap-1.5">
            {dropped_off_emails.map((email, i) => (
              <span key={i} className="px-2 py-1 bg-white rounded-lg text-[10px] text-red-700 border border-red-200">
                {email}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Signups */}
      <div className="bg-white rounded-xl border p-4" data-testid="recent-signups">
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-emerald-500" /> Recent Signups
        </h3>
        {recent_signups.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4">No signups in last 30 days</p>
        ) : (
          <div className="space-y-2">
            {recent_signups.map((s, i) => (
              <div key={i} className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                    s.gender?.toLowerCase() === 'female' ? 'bg-pink-500' : 'bg-blue-500'
                  }`}>
                    {s.gender?.toLowerCase() === 'female' ? '♀' : '♂'}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{s.name || 'Unknown'}</p>
                    <p className="text-[10px] text-gray-400">{s.email} {s.location ? `| ${s.location}` : ''}</p>
                  </div>
                </div>
                <span className="text-[10px] text-gray-400">
                  {new Date(s.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SignupFunnelDashboard;
