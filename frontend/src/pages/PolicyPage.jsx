import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const EMAIL = 'cs-heartlink@outlook.in';

const PAGES = {
  contact: {
    title: 'Contact Us',
    body: [
      ['Business', 'HeartLink — online dating & matchmaking app (com.heartlink.app)'],
      ['Email', EMAIL],
      ['Website', 'https://www.heartlink.co.in'],
      ['Support hours', 'Monday to Saturday, 10:00 AM – 6:00 PM IST. We reply within 24–48 hours.'],
      ['Country', 'India'],
    ],
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    body: [
      ['What you buy', 'HeartLink Premium is a digital service: ₹49 gives 30 days of Premium features (unlimited swipes, no ads, see who liked you, boosts). It does not auto-renew.'],
      ['Cancellation', 'Premium bought on our website/app payment page is a one-time 30-day pass, so there is nothing to cancel — it simply ends after 30 days. Subscriptions bought through Google Play can be cancelled anytime in Google Play → Payments & subscriptions.'],
      ['Refunds', `If you were charged but Premium was not activated, or you were charged twice, email ${EMAIL} within 7 days with your registered email and payment ID. Verified cases are refunded in full to the original payment method within 5–7 working days.`],
      ['Non-refundable', 'Once Premium is active and used, the unused days are not refundable, except where required by law. Accounts banned for violating our Terms are not eligible for a refund.'],
    ],
  },
  shipping: {
    title: 'Shipping & Delivery Policy',
    body: [
      ['Digital service only', 'HeartLink sells only digital Premium access. No physical goods are shipped.'],
      ['Delivery', 'Premium is activated on your HeartLink account instantly after successful payment (usually within 1 minute).'],
      ['Not received?', `If Premium is not active within 30 minutes of payment, email ${EMAIL} with your payment ID and we will activate it or refund you.`],
    ],
  },
};

export default function PolicyPage({ page }) {
  const navigate = useNavigate();
  const data = PAGES[page];
  return (
    <div className="min-h-screen bg-white px-5 py-6 max-w-2xl mx-auto" data-testid={`policy-page-${page}`}>
      <button onClick={() => navigate(-1)} className="mb-4 flex items-center gap-1 text-sm text-gray-500" data-testid="policy-back-btn">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-3xl font-bold text-gray-900 mb-6">{data.title}</h1>
      {data.body.map(([h, t]) => (
        <section key={h} className="mb-5">
          <h2 className="text-base font-semibold text-gray-900">{h}</h2>
          <p className="text-sm text-gray-600 mt-1 leading-6">{t}</p>
        </section>
      ))}
      <p className="text-xs text-gray-400 mt-8">Last updated: June 2026</p>
    </div>
  );
}
