import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Copy, Share2, Users, Award, ChevronRight, Check, Star, Zap, Crown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const ReferralPage = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [shareLink, setShareLink] = useState('');
  const [shareText, setShareText] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      // Get or create referral code
      const codeRes = await axios.get(`${API}/referral/${user.id}/code`);
      setReferralCode(codeRes.data.referral_code);
      setShareLink(codeRes.data.share_link);
      setShareText(codeRes.data.share_text);

      // Get stats
      const statsRes = await axios.get(`${API}/referral/${user.id}/stats`);
      setStats(statsRes.data);
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch referral data:', error);
      toast.error('Failed to load referral data');
      setLoading(false);
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`${shareText}\n\n${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareNative = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join HeartLink',
          text: shareText,
          url: shareLink
        });
      } catch (error) {
        console.log('Share cancelled');
      }
    } else {
      copyCode();
    }
  };

  const REWARDS = {
    1: { icon: Star, color: 'from-yellow-400 to-orange-500', reward: '5 Super Likes' },
    3: { icon: Zap, color: 'from-blue-400 to-purple-500', reward: '10 Super Likes + 20 Swipes' },
    5: { icon: Crown, color: 'from-purple-400 to-pink-500', reward: '3 Days Premium FREE' },
    10: { icon: Crown, color: 'from-pink-400 to-red-500', reward: '1 Week Premium FREE' },
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 pb-24">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center shadow-lg">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Invite Friends, Earn Rewards!</h1>
          <p className="text-gray-600">Share HeartLink with friends and get FREE Super Likes & Premium!</p>
        </div>

        {/* Referral Code Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <p className="text-sm text-gray-500 mb-2 text-center">Your Referral Code</p>
          <div className="bg-gradient-to-r from-pink-100 to-orange-100 rounded-2xl p-4 flex items-center justify-between mb-4">
            <span className="text-2xl font-bold tracking-widest text-gray-800" data-testid="referral-code">
              {referralCode}
            </span>
            <button
              onClick={copyCode}
              className="bg-white p-3 rounded-xl shadow-md hover:shadow-lg transition-all"
              data-testid="copy-code-btn"
            >
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5 text-gray-600" />}
            </button>
          </div>

          {/* Share Buttons */}
          <div className="grid grid-cols-2 gap-3">
            <Button
              onClick={shareOnWhatsApp}
              className="bg-green-500 hover:bg-green-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              data-testid="share-whatsapp-btn"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              WhatsApp
            </Button>
            <Button
              onClick={shareNative}
              className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white py-3 rounded-xl flex items-center justify-center gap-2"
              data-testid="share-native-btn"
            >
              <Share2 className="w-5 h-5" />
              Share
            </Button>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Users className="w-6 h-6 text-pink-500" />
            <h2 className="text-lg font-bold text-gray-800">Your Referrals</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-pink-600">{stats?.total_referrals || 0}</p>
              <p className="text-sm text-gray-600">Total Invites</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats?.successful_referrals || 0}</p>
              <p className="text-sm text-gray-600">Joined</p>
            </div>
          </div>

          {/* Progress to next reward */}
          {stats?.next_milestone && (
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium text-gray-700">Next Reward</span>
                <span className="text-sm text-purple-600 font-bold">{stats.next_reward}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                <div 
                  className="bg-gradient-to-r from-purple-500 to-pink-500 h-3 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (stats.successful_referrals / stats.next_milestone) * 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500 text-center">
                {stats.referrals_until_next} more friend{stats.referrals_until_next !== 1 ? 's' : ''} to unlock!
              </p>
            </div>
          )}
        </div>

        {/* Rewards Ladder */}
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Award className="w-6 h-6 text-yellow-500" />
            <h2 className="text-lg font-bold text-gray-800">Reward Milestones</h2>
          </div>
          
          <div className="space-y-3">
            {Object.entries(REWARDS).map(([count, data]) => {
              const IconComponent = data.icon;
              const isUnlocked = (stats?.successful_referrals || 0) >= parseInt(count);
              const isClaimed = stats?.rewards_claimed?.includes(parseInt(count));
              
              return (
                <div 
                  key={count}
                  className={`flex items-center gap-4 p-4 rounded-2xl transition-all ${
                    isUnlocked 
                      ? 'bg-gradient-to-r ' + data.color + ' text-white shadow-lg' 
                      : 'bg-gray-50'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                    isUnlocked ? 'bg-white/20' : 'bg-gray-200'
                  }`}>
                    <IconComponent className={`w-6 h-6 ${isUnlocked ? 'text-white' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1">
                    <p className={`font-bold ${isUnlocked ? 'text-white' : 'text-gray-800'}`}>
                      {count} Friend{parseInt(count) > 1 ? 's' : ''}
                    </p>
                    <p className={`text-sm ${isUnlocked ? 'text-white/80' : 'text-gray-500'}`}>
                      {data.reward}
                    </p>
                  </div>
                  {isClaimed && (
                    <div className="bg-white/20 p-2 rounded-full">
                      <Check className="w-5 h-5 text-white" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent Referrals */}
        {stats?.referred_users?.length > 0 && (
          <div className="bg-white rounded-3xl shadow-xl p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Recent Referrals</h2>
            <div className="space-y-3">
              {stats.referred_users.slice(0, 5).map((referral, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-300 to-orange-300 flex items-center justify-center overflow-hidden">
                    {referral.profile_picture ? (
                      <img src={referral.profile_picture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white font-bold">{referral.name[0]}</span>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800">{referral.name}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(referral.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    referral.status === 'successful' 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {referral.status === 'successful' ? 'Joined' : 'Pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* How it works */}
        <div className="mt-6 p-4 bg-white/50 rounded-2xl">
          <h3 className="font-bold text-gray-700 mb-3 text-center">How it works</h3>
          <div className="space-y-2 text-sm text-gray-600">
            <div className="flex items-start gap-2">
              <span className="bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">1</span>
              <span>Share your unique code with friends</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">2</span>
              <span>Friends sign up using your code</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="bg-pink-500 text-white w-5 h-5 rounded-full flex items-center justify-center text-xs flex-shrink-0">3</span>
              <span>Both of you get FREE rewards! 🎉</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
