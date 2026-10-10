import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bug, Lightbulb, CreditCard, Megaphone, MessageSquare, Send, CheckCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { API } from '@/config/api';
import axios from 'axios';
import { toast, Toaster } from 'sonner';

const CATEGORIES = [
  { id: 'bug_report', label: 'Bug Report', icon: Bug, color: 'text-red-500 bg-red-50', desc: 'Something not working?' },
  { id: 'feature_suggestion', label: 'Feature Idea', icon: Lightbulb, color: 'text-amber-500 bg-amber-50', desc: 'What should we add?' },
  { id: 'payment_issue', label: 'Payment Issue', icon: CreditCard, color: 'text-blue-500 bg-blue-50', desc: 'Subscription or billing' },
  { id: 'ad_experience', label: 'Ad Experience', icon: Megaphone, color: 'text-purple-500 bg-purple-50', desc: 'Issues with ads' },
  { id: 'general', label: 'General', icon: MessageSquare, color: 'text-gray-500 bg-gray-50', desc: 'Anything else' },
];

const FeedbackPage = ({ user }) => {
  const navigate = useNavigate();
  const [category, setCategory] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!category) { toast.error('Please select a category'); return; }
    if (message.trim().length < 10) { toast.error('Message must be at least 10 characters'); return; }

    setSubmitting(true);
    try {
      await axios.post(`${API}/feedback/submit`, {
        user_id: user?.id,
        category,
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to submit. Please try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6" style={{ background: 'linear-gradient(to bottom right, #FFF1F2, #FFF7ED)' }}>
        <div className="text-center space-y-4">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold text-gray-900">Thank You!</h2>
          <p className="text-gray-500 text-sm">Your feedback has been submitted. We'll look into it.</p>
          <Button onClick={() => navigate('/settings')} className="mt-4">Back to Settings</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'linear-gradient(to bottom right, #FFF1F2, #FFF7ED)', paddingTop: 'var(--safe-top, 24px)', paddingBottom: '24px' }}>
      <Toaster position="top-center" />
      <div className="max-w-lg mx-auto px-4 py-4">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 mb-4" data-testid="feedback-back-btn">
          <ArrowLeft className="w-5 h-5" />
          <span className="text-sm">Back</span>
        </button>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Send Feedback</h1>
        <p className="text-sm text-gray-500 mb-6">Help us improve HeartLink</p>

        {/* Category Selection */}
        <div className="space-y-2 mb-6">
          <p className="text-sm font-semibold text-gray-700">What's this about?</p>
          <div className="grid grid-cols-2 gap-2">
            {CATEGORIES.map(cat => {
              const Icon = cat.icon;
              const selected = category === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setCategory(cat.id)}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${
                    selected ? 'border-pink-500 bg-pink-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                  data-testid={`feedback-cat-${cat.id}`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cat.color}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div>
                    <p className={`text-xs font-bold ${selected ? 'text-pink-700' : 'text-gray-800'}`}>{cat.label}</p>
                    <p className="text-[10px] text-gray-400">{cat.desc}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Message */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-gray-700 mb-2">Your message</p>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            placeholder="Describe your issue or suggestion in detail..."
            maxLength={2000}
            rows={5}
            className="w-full rounded-xl border-2 border-gray-200 focus:border-pink-500 focus:outline-none p-3 text-sm resize-none"
            data-testid="feedback-message"
          />
          <p className="text-[10px] text-gray-400 text-right mt-1">{message.length}/2000</p>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSubmit}
          disabled={submitting || !category || message.trim().length < 10}
          className="w-full py-3 rounded-xl font-bold text-sm"
          style={{ background: 'linear-gradient(135deg, #ec4899, #f43f5e)' }}
          data-testid="feedback-submit-btn"
        >
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          {submitting ? 'Submitting...' : 'Submit Feedback'}
        </Button>
      </div>
    </div>
  );
};

export default FeedbackPage;
