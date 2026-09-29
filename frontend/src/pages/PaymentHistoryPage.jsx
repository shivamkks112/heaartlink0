import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, Clock, Check, X, Receipt } from 'lucide-react';
import axios from 'axios';
import { API } from '@/config/api';

const PaymentHistoryPage = ({ user }) => {
  const navigate = useNavigate();
  const [payments, setPayments] = useState([]);
  const [subStatus, setSubStatus] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    // Fetch payment requests
    axios.get(`${API}/payment/history/${user.id}`).then(r => setPayments(r.data || [])).catch(() => {});
    // Fetch subscription status
    axios.get(`${API}/subscription/status/${user.id}`).then(r => setSubStatus(r.data)).catch(() => {});
  }, [user?.id]);

  const isGirl = user?.gender?.toLowerCase() === 'female';

  return (
    <div className="min-h-screen bg-gray-50" data-testid="payment-history-page">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 rounded-full active:bg-gray-100" data-testid="back-btn">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-lg font-bold text-gray-900">Premium & Payments</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Current Status */}
        <div className={`rounded-2xl p-5 ${(user?.is_premium || isGirl) ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-gray-800 to-gray-900'}`}>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
              <Crown className="w-6 h-6 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-lg">
                {isGirl ? 'Free Premium' : (user?.is_premium ? 'Premium Active' : 'Not Premium')}
              </p>
              <p className="text-white/70 text-sm">
                {isGirl ? 'Girls ko hamesha free premium milta hai' :
                 subStatus?.subscription_status === 'promo_code' ? 'Via Promo Code' :
                 subStatus?.subscription_status === 'manual_payment' ? 'Via UPI Payment' :
                 subStatus?.subscription_status === 'trialing' ? 'Trial Active' :
                 subStatus?.subscription_status === 'active' ? 'Google Play Subscription' :
                 'Upgrade for premium features'}
              </p>
            </div>
          </div>
          {subStatus?.expires_at && !isGirl && (
            <div className="mt-3 bg-white/10 rounded-lg px-3 py-2">
              <p className="text-xs text-white/70">Expires: {new Date(subStatus.expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</p>
            </div>
          )}
        </div>

        {/* Payment History */}
        <div>
          <h2 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Payment History
          </h2>
          {payments.length === 0 ? (
            <div className="bg-white rounded-xl p-8 text-center">
              <p className="text-gray-400 text-sm">No payment history yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {payments.map((p, i) => (
                <div key={i} className="bg-white rounded-xl p-4 flex items-center justify-between" data-testid={`payment-item-${i}`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${
                      p.status === 'approved' ? 'bg-green-100' :
                      p.status === 'pending' ? 'bg-amber-100' :
                      'bg-red-100'
                    }`}>
                      {p.status === 'approved' ? <Check className="w-4 h-4 text-green-600" /> :
                       p.status === 'pending' ? <Clock className="w-4 h-4 text-amber-600" /> :
                       <X className="w-4 h-4 text-red-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">₹{p.amount} — {p.payment_method}</p>
                      <p className="text-xs text-gray-400">
                        {new Date(p.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {p.utr_number && ` · UTR: ${p.utr_number}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                    p.status === 'approved' ? 'bg-green-50 text-green-600' :
                    p.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                    'bg-red-50 text-red-600'
                  }`}>
                    {p.status === 'approved' ? 'Verified' : p.status === 'pending' ? 'Pending' : 'Rejected'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentHistoryPage;
