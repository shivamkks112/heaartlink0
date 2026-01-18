/**
 * PremiumPage - Subscription plans and premium features
 * Shows different plans and handles subscription logic
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { 
  Crown, 
  Check, 
  Zap, 
  Eye, 
  MessageCircle, 
  Ban, 
  Sparkles,
  ArrowLeft,
  Star,
  Shield,
  Heart
} from 'lucide-react';
import { toast } from 'sonner';

const API_URL = process.env.REACT_APP_BACKEND_URL;

const PREMIUM_PLANS = [
  {
    id: 'monthly',
    name: 'Premium Monthly',
    price: 299,
    currency: '₹',
    period: 'month',
    popular: false,
    savings: null,
    features: [
      'Unlimited Swipes',
      'No Ads',
      '1 Profile Boost/Day',
      'See Who Liked You',
      '5 Super Likes/Day',
      'Rewind Last Swipe',
    ],
  },
  {
    id: 'quarterly',
    name: 'Premium Quarterly',
    price: 699,
    currency: '₹',
    period: '3 months',
    popular: true,
    savings: '22% OFF',
    features: [
      'Unlimited Swipes',
      'No Ads',
      '3 Profile Boosts/Day',
      'See Who Liked You',
      '10 Super Likes/Day',
      'Rewind Last Swipe',
      'Priority Support',
    ],
  },
  {
    id: 'yearly',
    name: 'Premium Yearly',
    price: 1999,
    currency: '₹',
    period: 'year',
    popular: false,
    savings: '44% OFF',
    features: [
      'Unlimited Swipes',
      'No Ads',
      'Unlimited Profile Boosts',
      'See Who Liked You',
      'Unlimited Super Likes',
      'Rewind Last Swipe',
      'Priority Support',
      'Verified Badge',
    ],
  },
];

const PREMIUM_BENEFITS = [
  {
    icon: Ban,
    title: 'Ad-Free Experience',
    description: 'No interruptions while you find your match',
    color: 'text-red-500',
    bgColor: 'bg-red-50',
  },
  {
    icon: Zap,
    title: 'Unlimited Swipes',
    description: 'Swipe as much as you want, no daily limits',
    color: 'text-amber-500',
    bgColor: 'bg-amber-50',
  },
  {
    icon: Eye,
    title: 'See Who Liked You',
    description: 'Know who likes you before you swipe',
    color: 'text-blue-500',
    bgColor: 'bg-blue-50',
  },
  {
    icon: Sparkles,
    title: 'Profile Boost',
    description: 'Get 10x more profile views',
    color: 'text-purple-500',
    bgColor: 'bg-purple-50',
  },
  {
    icon: MessageCircle,
    title: 'Priority Messages',
    description: 'Your messages appear first',
    color: 'text-green-500',
    bgColor: 'bg-green-50',
  },
  {
    icon: Shield,
    title: 'Verified Badge',
    description: 'Stand out with premium verification',
    color: 'text-pink-500',
    bgColor: 'bg-pink-50',
  },
];

const PremiumPage = ({ user }) => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState('quarterly');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSubscribe = async (planId) => {
    setIsProcessing(true);
    
    try {
      // For now, show a message about payment integration
      // This would integrate with Razorpay/Stripe in production
      toast.info('Payment Coming Soon', {
        description: 'Premium subscriptions will be available soon!',
        duration: 5000,
      });
      
      // Simulate subscription for demo
      // In production, this would call payment gateway
      /*
      const response = await fetch(`${API_URL}/api/subscription/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.id,
          plan_id: planId,
        }),
      });
      
      const data = await response.json();
      if (data.payment_url) {
        window.location.href = data.payment_url;
      }
      */
    } catch (error) {
      console.error('Subscription error:', error);
      toast.error('Failed to process subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  const isPremium = user?.is_premium || user?.isPremium;

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 via-white to-rose-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur-lg border-b border-pink-100">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate(-1)}
            className="mr-3"
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-amber-500" />
            <h1 className="text-xl font-bold text-gray-800">HeartLink Premium</h1>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Already Premium Banner */}
        {isPremium && (
          <Card className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0" data-testid="premium-active-banner">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="p-3 bg-white/20 rounded-full">
                <Crown className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-lg font-bold">You're Premium!</h2>
                <p className="text-white/90">Enjoy unlimited access to all features</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Hero Section */}
        {!isPremium && (
          <div className="text-center space-y-4 pt-4">
            <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-amber-400 to-orange-500 rounded-full shadow-lg">
              <Crown className="w-12 h-12 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800">Upgrade to Premium</h2>
            <p className="text-gray-600 max-w-md mx-auto">
              Get more matches, no ads, and exclusive features to find your perfect partner faster
            </p>
          </div>
        )}

        {/* Benefits Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {PREMIUM_BENEFITS.map((benefit, index) => (
            <div 
              key={index}
              className={`p-4 rounded-xl ${benefit.bgColor} border border-gray-100 text-center`}
            >
              <benefit.icon className={`w-8 h-8 ${benefit.color} mx-auto mb-2`} />
              <h3 className="font-semibold text-gray-800 text-sm">{benefit.title}</h3>
              <p className="text-xs text-gray-600 mt-1">{benefit.description}</p>
            </div>
          ))}
        </div>

        {/* Pricing Plans */}
        {!isPremium && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-center text-gray-800">Choose Your Plan</h3>
            
            <div className="grid md:grid-cols-3 gap-4">
              {PREMIUM_PLANS.map((plan) => (
                <Card 
                  key={plan.id}
                  className={`relative cursor-pointer transition-all ${
                    selectedPlan === plan.id 
                      ? 'border-2 border-pink-500 shadow-lg scale-[1.02]' 
                      : 'border-gray-200 hover:border-pink-300'
                  }`}
                  onClick={() => setSelectedPlan(plan.id)}
                  data-testid={`plan-card-${plan.id}`}
                >
                  {plan.popular && (
                    <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-gradient-to-r from-pink-500 to-rose-500">
                      <Star className="w-3 h-3 mr-1" />
                      Most Popular
                    </Badge>
                  )}
                  
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {plan.savings && (
                      <Badge variant="secondary" className="w-fit mx-auto bg-green-100 text-green-700">
                        {plan.savings}
                      </Badge>
                    )}
                  </CardHeader>
                  
                  <CardContent className="text-center space-y-4">
                    <div>
                      <span className="text-3xl font-bold text-gray-800">
                        {plan.currency}{plan.price}
                      </span>
                      <span className="text-gray-500">/{plan.period}</span>
                    </div>
                    
                    <ul className="space-y-2 text-sm text-left">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                          <span className="text-gray-600">{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className={`w-full ${
                        selectedPlan === plan.id
                          ? 'bg-gradient-to-r from-pink-500 to-rose-500'
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSubscribe(plan.id);
                      }}
                      disabled={isProcessing}
                      data-testid={`subscribe-btn-${plan.id}`}
                    >
                      {isProcessing ? 'Processing...' : 'Subscribe Now'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="text-center space-y-3 pt-4">
          <div className="flex items-center justify-center gap-4 text-gray-500 text-sm">
            <div className="flex items-center gap-1">
              <Shield className="w-4 h-4" />
              <span>Secure Payment</span>
            </div>
            <div className="flex items-center gap-1">
              <Heart className="w-4 h-4" />
              <span>Cancel Anytime</span>
            </div>
          </div>
          <p className="text-xs text-gray-400">
            By subscribing, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};

export default PremiumPage;
