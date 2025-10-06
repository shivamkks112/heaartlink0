import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shield, Sparkles, MessageCircle, Users, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50"></div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-rose-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-4 rounded-3xl shadow-2xl">
              <Heart className="w-16 h-16 text-white" fill="white" />
            </div>
          </div>
          
          <h1 className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-6 bg-gradient-to-r from-pink-600 via-rose-600 to-orange-600 bg-clip-text text-transparent">
            HeartLink
          </h1>
          
          <p className="text-xl sm:text-2xl lg:text-3xl text-gray-700 mb-4 font-medium">
            Where Hearts Meet, Powered by AI
          </p>
          
          <p className="text-base sm:text-lg text-gray-600 mb-10 max-w-2xl mx-auto">
            India's most advanced dating platform with AI matchmaking, real-time chat, and complete privacy control
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              data-testid="get-started-btn"
              onClick={() => navigate('/auth')}
              className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-full shadow-lg transform hover:scale-105 transition-all duration-300"
            >
              Get Started Free
            </Button>
            <Button
              data-testid="learn-more-btn"
              onClick={() => document.getElementById('features').scrollIntoView({ behavior: 'smooth' })}
              className="bg-white hover:bg-gray-50 text-gray-800 px-8 py-6 text-lg rounded-full shadow-lg border-2 border-gray-200 transform hover:scale-105 transition-all duration-300"
            >
              Learn More
            </Button>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-gray-900">
              Why Choose HeartLink?
            </h2>
            <p className="text-xl text-gray-600">
              Advanced features designed for Indian dating
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <div className="bg-gradient-to-br from-pink-50 to-rose-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-pink-500 to-rose-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Sparkles className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">AI Matchmaking</h3>
              <p className="text-gray-700">
                Our advanced AI analyzes profiles and interests to find your perfect match with compatibility scores
              </p>
            </div>

            <div className="bg-gradient-to-br from-orange-50 to-amber-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-orange-500 to-amber-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <MessageCircle className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Real-Time Chat</h3>
              <p className="text-gray-700">
                Instant messaging with matched users. Connect and chat seamlessly in real-time
              </p>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-pink-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-purple-500 to-pink-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Shield className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Privacy Control</h3>
              <p className="text-gray-700">
                Complete control over your profile visibility with incognito mode and privacy settings
              </p>
            </div>

            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-blue-500 to-cyan-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Smart Discovery</h3>
              <p className="text-gray-700">
                Browse profiles based on preferences, location, and interests with intelligent filtering
              </p>
            </div>

            <div className="bg-gradient-to-br from-green-50 to-emerald-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-green-500 to-emerald-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Profile Verification</h3>
              <p className="text-gray-700">
                AI-powered profile verification ensures authentic users and safer connections
              </p>
            </div>

            <div className="bg-gradient-to-br from-red-50 to-pink-50 p-8 rounded-3xl shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2">
              <div className="bg-gradient-to-br from-red-500 to-pink-500 w-14 h-14 rounded-2xl flex items-center justify-center mb-4">
                <Heart className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-2xl font-bold mb-3 text-gray-900">Block & Report</h3>
              <p className="text-gray-700">
                Safety first! Block users and report inappropriate behavior instantly
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Find Your Match?
          </h2>
          <p className="text-xl mb-10 opacity-90">
            Join thousands of Indians finding meaningful connections every day
          </p>
          <Button
            data-testid="cta-signup-btn"
            onClick={() => navigate('/auth')}
            className="bg-white text-pink-600 hover:bg-gray-100 px-10 py-6 text-lg rounded-full shadow-xl transform hover:scale-105 transition-all duration-300"
          >
            Sign Up Now
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <p className="text-gray-400">
            © 2025 HeartLink. Made with ❤️ in India
          </p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
