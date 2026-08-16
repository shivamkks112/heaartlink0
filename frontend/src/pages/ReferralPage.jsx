import { useState, useEffect } from 'react';
import axios from 'axios';
import { Share2, Copy, Users, Gift, Trophy, ChevronRight, Star, Check, MessageCircle, Phone } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import { Button } from '@/components/ui/button';

import { BACKEND_URL, API } from '@/config/api';

const ReferralPage = ({ user }) => {
  const navigate = useNavigate();
  const [referralData, setReferralData] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const [refRes, leaderRes] = await Promise.all([
        axios.get(`${API}/referral/${user.id}`),
        axios.get(`${API}/referral/${user.id}/leaderboard`)
      ]);
      setReferralData(refRes.data);
      setLeaderboard(leaderRes.data.leaderboard || []);
    } catch (error) {
      if (error.response?.status === 403) {
        setPaused(true);
      } else {
        console.error('Error fetching referral data:', error);
        toast.error('Failed to load referral data');
      }
    } finally {
      setLoading(false);
    }
  };

  const copyCode = async () => {
    if (!referralData?.referral_code) return;
    try {
      await navigator.clipboard.writeText(referralData.referral_code);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const shareReferral = async () => {
    if (!referralData) return;
    const shareText = `HeartLink pe join karo - India's #1 Safe Dating App! Mera referral code use karo: ${referralData.referral_code} aur paao 2 FREE Superlikes! ${referralData.referral_link}`;
    
    if (navigator.share) {
      try {
        await navigator.share({ title: 'HeartLink - Join Now!', text: shareText, url: referralData.referral_link });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success('Share link copied to clipboard!');
      } catch {}
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
        <TopBar user={user} />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-pink-500"></div>
        </div>
        <Navbar user={user} />
      </div>
    );
  }

  const progress = referralData ? ((3 - referralData.referrals_for_next_reward) / 3) * 100 : 0;

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar user={user} />
      <Toaster position="top-center" />

      <div className="max-w-lg mx-auto px-4 pt-4 space-y-5">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900" data-testid="referral-title">Invite Friends</h1>
          <p className="text-gray-600 text-sm mt-1">Share HeartLink & earn Superlikes</p>
        </div>

        {paused ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6 text-center" data-testid="referral-paused">
            <div className="w-14 h-14 bg-yellow-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Gift className="w-7 h-7 text-yellow-600" />
            </div>
            <h3 className="font-bold text-gray-900 text-lg">Referral System Paused</h3>
            <p className="text-gray-600 text-sm mt-2">Referral program is temporarily paused. Check back later!</p>
          </div>
        ) : (
        <>
        {/* Reward Card */}
        <div className="bg-gradient-to-br from-orange-500 via-pink-500 to-purple-600 rounded-2xl p-5 text-white shadow-lg" data-testid="referral-reward-card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
              <Gift className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-lg">Invite 3 Friends</h2>
              <p className="text-white/80 text-sm">Get 10 FREE Superlikes!</p>
            </div>
          </div>
          
          {/* Progress */}
          <div className="mt-4">
            <div className="flex justify-between text-sm mb-1.5">
              <span className="text-white/80">{3 - (referralData?.referrals_for_next_reward || 3)} of 3 referrals</span>
              <span className="font-semibold">{referralData?.referrals_for_next_reward || 3} more needed</span>
            </div>
            <div className="w-full bg-white/20 rounded-full h-3" data-testid="referral-progress">
              <div 
                className="bg-white rounded-full h-3 transition-all duration-500"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Referral Code */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="referral-code-section">
          <h3 className="font-semibold text-gray-900 mb-3">Your Referral Code</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl px-4 py-3 text-center">
              <span className="text-xl font-bold tracking-wider text-gray-900" data-testid="referral-code">
                {referralData?.referral_code || '---'}
              </span>
            </div>
            <button
              onClick={copyCode}
              data-testid="copy-code-btn"
              className="p-3 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors"
            >
              {copied ? <Check className="w-5 h-5 text-green-600" /> : <Copy className="w-5 h-5 text-gray-600" />}
            </button>
          </div>
          
          <Button
            onClick={shareReferral}
            data-testid="share-referral-btn"
            className="w-full mt-4 bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" />
            Share with Friends
          </Button>

          {/* WhatsApp Direct Share */}
          <Button
            onClick={() => {
              const msg = encodeURIComponent(
                `🔥 HeartLink pe meri matches aa chuki hain! India ka safest dating app try karo.\n\n` +
                `Mera code use karo: *${referralData?.referral_code}* — 2 FREE Superlikes milenge!\n\n` +
                `👉 Download karo: https://play.google.com/store/apps/details?id=com.heartlink.app`
              );
              window.open(`https://wa.me/?text=${msg}`, '_blank');
            }}
            data-testid="whatsapp-share-btn"
            className="w-full mt-2 bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2"
          >
            <MessageCircle className="w-5 h-5" />
            Share on WhatsApp
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3" data-testid="referral-stats">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="w-9 h-9 bg-blue-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{referralData?.total_referrals || 0}</p>
            <p className="text-xs text-gray-500">Referred</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="w-9 h-9 bg-pink-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Star className="w-4 h-4 text-pink-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{referralData?.rewards_earned || 0}</p>
            <p className="text-xs text-gray-500">Earned</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <div className="w-9 h-9 bg-orange-100 rounded-lg flex items-center justify-center mx-auto mb-1.5">
              <Gift className="w-4 h-4 text-orange-600" />
            </div>
            <p className="text-xl font-bold text-gray-900">{referralData?.pending_referrals || 0}</p>
            <p className="text-xs text-gray-500">Pending</p>
          </div>
        </div>

        {/* How it works */}
        <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="how-it-works">
          <h3 className="font-semibold text-gray-900 mb-3">How It Works</h3>
          <div className="space-y-3">
            {[
              { step: 1, text: 'Share your referral code with friends', icon: Share2 },
              { step: 2, text: 'Friend signs up & enters your code', icon: Users },
              { step: 3, text: 'Every 3 referrals = 10 FREE Superlikes!', icon: Gift },
            ].map(({ step, text, icon: Icon }) => (
              <div key={step} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-gradient-to-r from-pink-500 to-orange-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                  {step}
                </div>
                <p className="text-sm text-gray-700">{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        {leaderboard.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm" data-testid="referral-leaderboard">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h3 className="font-semibold text-gray-900">Top Referrers</h3>
            </div>
            <div className="space-y-2">
              {leaderboard.map((leader) => (
                <div 
                  key={leader.rank} 
                  className={`flex items-center justify-between p-2.5 rounded-xl ${
                    leader.is_you ? 'bg-pink-50 border border-pink-200' : 'bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                      leader.rank === 1 ? 'bg-yellow-400 text-white' :
                      leader.rank === 2 ? 'bg-gray-300 text-white' :
                      leader.rank === 3 ? 'bg-orange-400 text-white' :
                      'bg-gray-200 text-gray-600'
                    }`}>
                      {leader.rank}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      {leader.name} {leader.is_you && '(You)'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-pink-600">{leader.referrals} refs</span>
                </div>
              ))}
            </div>
          </div>
        )}
        </>
        )}
      </div>

      <Navbar user={user} />
    </div>
  );
};

export default ReferralPage;
