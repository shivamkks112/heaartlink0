```powershell
# HeartLink Feature Addition Script
# Run in PowerShell as: .\add-features.ps1

$projectPath = "D:\heaartlink"
$frontendPath = "$projectPath\frontend"

Write-Host "=== Adding Referral System + Facebook SDK ===" -ForegroundColor Green

# 1. Install Facebook SDK package
Write-Host "Installing Facebook SDK..." -ForegroundColor Yellow
Set-Location $frontendPath
npm install @capacitor-community/facebook-login@5.0.0 --legacy-peer-deps

# 2. Create ReferralPage.jsx
Write-Host "Creating ReferralPage.jsx..." -ForegroundColor Yellow
$referralPage = @'
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Gift, Copy, Share2, Users, Award, Check, Star, Zap, Crown } from 'lucide-react';
import { toast } from 'sonner';
import Navbar from '../components/Navbar';

const API = process.env.REACT_APP_BACKEND_URL + '/api';

const ReferralPage = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [stats, setStats] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => { fetchReferralData(); }, []);

  const fetchReferralData = async () => {
    try {
      const codeRes = await axios.get(`${API}/referral/${user.id}/code`);
      setReferralCode(codeRes.data.referral_code);
      const statsRes = await axios.get(`${API}/referral/${user.id}/stats`);
      setStats(statsRes.data);
    } catch (error) { console.error(error); }
    setLoading(false);
  };

  const copyCode = () => {
    navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast.success('Code copied!');
    setTimeout(() => setCopied(false), 2000);
  };

  const shareOnWhatsApp = () => {
    const text = encodeURIComponent(`HeartLink pe aao! Use my code ${referralCode} and get FREE Super Likes!`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-12 w-12 border-b-2 border-pink-500 rounded-full"></div></div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-orange-50 pb-24">
      <Navbar user={user} />
      <div className="max-w-lg mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <div className="w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <Gift className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">Invite Friends, Earn Rewards!</h1>
        </div>
        <div className="bg-white rounded-3xl shadow-xl p-6 mb-6">
          <p className="text-sm text-gray-500 mb-2 text-center">Your Referral Code</p>
          <div className="bg-pink-100 rounded-2xl p-4 flex items-center justify-between mb-4">
            <span className="text-2xl font-bold tracking-widest">{referralCode || 'Loading...'}</span>
            <button onClick={copyCode} className="bg-white p-3 rounded-xl shadow">
              {copied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button onClick={shareOnWhatsApp} className="bg-green-500 text-white py-3 rounded-xl">WhatsApp</button>
            <button onClick={copyCode} className="bg-pink-500 text-white py-3 rounded-xl">Copy Code</button>
          </div>
        </div>
        <div className="bg-white rounded-3xl shadow-xl p-6">
          <h2 className="font-bold mb-4">Your Stats</h2>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-pink-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-pink-600">{stats?.total_referrals || 0}</p>
              <p className="text-sm">Invited</p>
            </div>
            <div className="bg-green-50 p-4 rounded-xl text-center">
              <p className="text-2xl font-bold text-green-600">{stats?.successful_referrals || 0}</p>
              <p className="text-sm">Joined</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReferralPage;
'@
Set-Content -Path "$frontendPath\src\pages\ReferralPage.jsx" -Value $referralPage

# 3. Create FacebookService.js
Write-Host "Creating FacebookService.js..." -ForegroundColor Yellow
$facebookService = @'
const FACEBOOK_APP_ID = '1667563904230292';
class FacebookService {
  constructor() { this.initialized = false; }
  isNative() { return typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.(); }
  async initialize() {
    if (this.initialized || !this.isNative()) return false;
    try {
      const { FacebookLogin } = await import('@capacitor-community/facebook-login');
      await FacebookLogin.initialize({ appId: FACEBOOK_APP_ID });
      this.initialized = true;
      return true;
    } catch (e) { return false; }
  }
}
const facebookService = new FacebookService();
export default facebookService;
'@
Set-Content -Path "$frontendPath\src\services\FacebookService.js" -Value $facebookService

Write-Host "=== Files Created! ===" -ForegroundColor Green
Write-Host ""
Write-Host "NOW MANUALLY ADD THESE LINES:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. In App.js - Add import:" -ForegroundColor Yellow
Write-Host "   import ReferralPage from './pages/ReferralPage';"
Write-Host ""
Write-Host "2. In App.js - Add route inside Routes:" -ForegroundColor Yellow
Writ
e-Host "   <Route path='/referral' element={user ? <ReferralPage user={user} /> : <Navigate to='/' />} />"
Write-Host ""
Write-Host "3. Build and sync:" -ForegroundColor Yellow
Write-Host "   npm run build"
Write-Host "   npx cap sync android"
Write-Host ""
Write-Host "=== DONE! ===" -ForegroundColor Green