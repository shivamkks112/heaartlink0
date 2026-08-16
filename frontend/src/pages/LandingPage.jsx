import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Shield, Sparkles, MessageCircle, Users, Award, Star, CheckCircle, ArrowRight, Download, Play, ChevronDown, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';

const LandingPage = () => {
  const navigate = useNavigate();
  const [openFaq, setOpenFaq] = useState(null);

  const stats = [
    { number: "50,000+", label: "Happy Users", icon: Users },
    { number: "25,000+", label: "Matches Made", icon: Heart },
    { number: "4.5★", label: "App Rating", icon: Star },
    { number: "100%", label: "Verified Profiles", icon: Shield },
  ];

  const testimonials = [
    {
      name: "Priya S.",
      location: "Mumbai",
      text: "Found my partner within 2 weeks! The AI matching is really accurate. Finally an app that understands Indian values.",
      rating: 5
    },
    {
      name: "Rahul M.",
      location: "Delhi",
      text: "Best dating app for serious relationships. Profile verification gives confidence that profiles are real.",
      rating: 5
    },
    {
      name: "Sneha K.",
      location: "Bangalore",
      text: "As a woman, I feel safe using HeartLink. The safety features are excellent and support team is responsive.",
      rating: 5
    }
  ];

  const faqs = [
    {
      q: "Is HeartLink free to use?",
      a: "Yes! HeartLink is completely free to download and use. Basic features like profile creation, swiping, and chatting are free forever. We offer optional premium features for enhanced experience."
    },
    {
      q: "How does HeartLink verify profiles?",
      a: "We use AI-powered photo verification, phone/email verification, and manual review. Verified profiles get a blue checkmark badge, so you know you're talking to real people."
    },
    {
      q: "Is HeartLink safe for women?",
      a: "Absolutely! HeartLink is designed with women's safety as priority. Features include profile verification, instant block & report, screenshot detection alerts, and 24/7 safety support team."
    },
    {
      q: "How is HeartLink different from Tinder/Bumble?",
      a: "HeartLink is built specifically for Indians - our AI understands Indian preferences, we support regional languages, and our safety features are designed for Indian dating culture. Plus, we focus on meaningful connections, not just casual dating."
    },
    {
      q: "Can I use HeartLink for serious relationships?",
      a: "Yes! HeartLink is perfect for both casual dating and serious relationships. Our AI matching considers relationship intent, so you'll be matched with people looking for the same thing as you."
    }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="relative min-h-screen flex items-center justify-center overflow-hidden" role="banner">
        {/* Hero background image */}
        <div className="absolute inset-0">
          <img src="/assets/hero_banner.png" alt="HeartLink - Find Love" className="w-full h-full object-cover opacity-15" loading="eager" />
          <div className="absolute inset-0 bg-gradient-to-br from-pink-50/90 via-rose-50/90 to-orange-50/90"></div>
        </div>
        
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob"></div>
        <div className="absolute top-20 right-10 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-rose-300 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000"></div>
        
        <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex justify-center mb-8 animate-bounce-in">
            <div className="bg-gradient-to-r from-pink-500 to-orange-500 p-4 rounded-3xl shadow-2xl animate-glow hover-lift">
              <Heart className="w-16 h-16 text-white animate-heart-beat" fill="white" />
            </div>
          </div>
          
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-pink-600 via-rose-600 to-orange-600 bg-clip-text text-transparent animate-slide-in-down">
            HeartLink
          </h1>
          
          <p className="text-xl sm:text-2xl lg:text-3xl text-gray-700 mb-4 font-medium animate-fade-in" style={{animationDelay: '0.2s'}}>
            India's #1 Safe Dating App
          </p>
          
          <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-2xl mx-auto animate-fade-in" style={{animationDelay: '0.4s'}}>
            Find your perfect match with <strong>AI-powered matchmaking</strong>, <strong>verified profiles</strong>, and <strong>women-first safety</strong>. Join 50,000+ Indians finding love!
          </p>

          {/* Trust badges */}
          <div className="flex flex-wrap justify-center gap-4 mb-10 animate-fade-in" style={{animationDelay: '0.5s'}}>
            <span className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-sm text-gray-700 shadow-sm">
              <CheckCircle className="w-4 h-4 text-green-500" /> 100% Free Download
            </span>
            <span className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-sm text-gray-700 shadow-sm">
              <Shield className="w-4 h-4 text-blue-500" /> Verified Profiles
            </span>
            <span className="inline-flex items-center gap-2 bg-white/80 backdrop-blur px-4 py-2 rounded-full text-sm text-gray-700 shadow-sm">
              <Star className="w-4 h-4 text-yellow-500" /> 4.5★ Rating
            </span>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center animate-slide-in-up" style={{animationDelay: '0.6s'}}>
            <Button
              data-testid="get-started-btn"
              onClick={() => navigate('/auth')}
              className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-full shadow-glow transform hover:scale-110 transition-all duration-300 hover-lift relative overflow-hidden group"
            >
              <span className="relative z-10 flex items-center gap-2">
                Get Started Free <ArrowRight className="w-5 h-5" />
              </span>
            </Button>
            <Button
              data-testid="download-btn"
              onClick={() => window.open('https://play.google.com/store/apps/details?id=com.heartlink.app', '_blank')}
              className="bg-white hover:bg-gray-50 text-gray-800 px-8 py-6 text-lg rounded-full shadow-soft border-2 border-gray-200 transform hover:scale-110 transition-all duration-300 hover-lift"
            >
              <span className="flex items-center gap-2">
                <Play className="w-5 h-5" /> Download App
              </span>
            </Button>
          </div>

          {/* Scroll indicator */}
          <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
            <div className="w-6 h-10 border-2 border-gray-400 rounded-full flex justify-center">
              <div className="w-1 h-3 bg-gray-400 rounded-full mt-2 animate-pulse"></div>
            </div>
            <p className="text-gray-500 text-sm mt-2">Scroll to explore</p>
          </div>
        </div>
      </header>

      {/* Stats Section */}
      <section className="py-16 bg-white border-b" aria-label="Statistics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center group">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-pink-100 to-orange-100 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
                  <stat.icon className="w-8 h-8 text-pink-600" />
                </div>
                <div className="text-3xl sm:text-4xl font-bold text-gray-900 mb-1">{stat.number}</div>
                <div className="text-gray-600">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-gradient-to-b from-white to-gray-50" aria-labelledby="features-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <img src="/assets/features_banner.png" alt="HeartLink Features" className="w-full max-w-2xl mx-auto rounded-2xl shadow-lg mb-8" loading="lazy" />
            <h2 id="features-heading" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
              Why Choose HeartLink?
            </h2>
            <p className="text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
              Advanced features designed specifically for Indian dating culture
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              { icon: Sparkles, title: "AI Matchmaking", desc: "Our advanced AI analyzes profiles, interests, and preferences to find your perfect match with compatibility scores up to 95% accuracy.", color: "pink" },
              { icon: Shield, title: "Women Safety First", desc: "Designed with women's safety as priority - profile verification, screenshot alerts, instant block, and 24/7 safety support team.", color: "purple" },
              { icon: Award, title: "Verified Profiles", desc: "AI-powered photo verification ensures all profiles are real. Look for the blue checkmark to connect with genuine users only.", color: "green" },
              { icon: MessageCircle, title: "Real-Time Chat", desc: "Instant messaging with matched users. Express yourself with text, emojis, and voice messages. Connect seamlessly anytime.", color: "orange" },
              { icon: Users, title: "Smart Discovery", desc: "Browse profiles based on location, interests, education, and more. Find people who share your values and relationship goals.", color: "blue" },
              { icon: Heart, title: "Trust Score System", desc: "Every user gets a trust score based on profile completion, verification status, and behavior. Connect with trustworthy people.", color: "red" },
            ].map((feature, index) => (
              <article key={index} className={`bg-gradient-to-br from-${feature.color}-50 to-white p-8 rounded-3xl shadow-soft hover:shadow-elevated transition-all duration-500 transform hover:-translate-y-2 group`}>
                <div className={`bg-gradient-to-br from-${feature.color}-500 to-${feature.color}-600 w-14 h-14 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900">{feature.title}</h3>
                <p className="text-gray-600 leading-relaxed">{feature.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-24 bg-white" aria-labelledby="how-it-works">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 id="how-it-works" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
              How HeartLink Works
            </h2>
            <p className="text-lg text-gray-600">Find your match in 3 simple steps</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { step: "1", title: "Create Profile", desc: "Sign up free and create your profile. Add photos, interests, and what you're looking for. Get verified for more matches!" },
              { step: "2", title: "Discover Matches", desc: "Our AI suggests compatible matches based on your preferences. Swipe right to like, left to pass. It's that simple!" },
              { step: "3", title: "Start Chatting", desc: "When you both like each other, it's a match! Start chatting instantly and plan your first date. Love awaits!" },
            ].map((item, index) => (
              <div key={index} className="text-center relative">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-pink-500 to-orange-500 text-white text-3xl font-bold rounded-full mb-6 shadow-lg">
                  {item.step}
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-10 left-[60%] w-[80%] h-0.5 bg-gradient-to-r from-pink-300 to-orange-300"></div>
                )}
                <h3 className="text-xl font-bold mb-3 text-gray-900">{item.title}</h3>
                <p className="text-gray-600">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 bg-gradient-to-b from-gray-50 to-white" aria-labelledby="testimonials">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 id="testimonials" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
              Love Stories from HeartLink
            </h2>
            <p className="text-lg text-gray-600">Real reviews from real couples</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <article key={index} className="bg-white p-8 rounded-3xl shadow-soft hover:shadow-elevated transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-yellow-400 fill-yellow-400" />
                  ))}
                </div>
                <blockquote className="text-gray-700 mb-6 italic">"{testimonial.text}"</blockquote>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-pink-400 to-orange-400 rounded-full flex items-center justify-center text-white font-bold">
                    {testimonial.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-semibold text-gray-900">{testimonial.name}</div>
                    <div className="text-sm text-gray-500">{testimonial.location}</div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-24 bg-white" aria-labelledby="faq">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 id="faq" className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4 text-gray-900">
              Frequently Asked Questions
            </h2>
            <p className="text-lg text-gray-600">Everything you need to know about HeartLink</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="border border-gray-200 rounded-2xl overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === index ? null : index)}
                  className="w-full px-6 py-5 text-left flex items-center justify-between bg-white hover:bg-gray-50 transition-colors"
                  aria-expanded={openFaq === index}
                >
                  <span className="font-semibold text-gray-900">{faq.q}</span>
                  <ChevronDown className={`w-5 h-5 text-gray-500 transition-transform ${openFaq === index ? 'rotate-180' : ''}`} />
                </button>
                {openFaq === index && (
                  <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                    <p className="text-gray-600">{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* SEO Content - Dating in Indian Cities */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white" aria-labelledby="cities-heading">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 id="cities-heading" className="text-3xl sm:text-4xl font-bold mb-4 text-gray-900">
              Find Love in Your City
            </h2>
            <p className="text-lg text-gray-600">HeartLink connects singles across India's top cities</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {[
              { city: "Delhi", tag: "NCR Singles" },
              { city: "Mumbai", tag: "Local Matches" },
              { city: "Bangalore", tag: "IT Hub Dating" },
              { city: "Hyderabad", tag: "City of Pearls" },
              { city: "Chennai", tag: "South Indian" },
              { city: "Kolkata", tag: "Cultural City" },
              { city: "Pune", tag: "Young Professionals" },
              { city: "Jaipur", tag: "Pink City Love" },
              { city: "Lucknow", tag: "Nawabi Tehzeeb" },
              { city: "Ahmedabad", tag: "Gujarat Singles" },
              { city: "Chandigarh", tag: "City Beautiful" },
              { city: "Goa", tag: "Beach Vibes" },
            ].map((item, index) => (
              <div key={index} className="bg-white rounded-xl p-4 text-center shadow-sm hover:shadow-md transition-all hover:-translate-y-1 cursor-pointer border border-gray-100">
                <MapPin className="w-5 h-5 text-pink-500 mx-auto mb-2" />
                <h3 className="font-semibold text-gray-900 text-sm">{item.city}</h3>
                <p className="text-xs text-gray-500 mt-1">{item.tag}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <img src="/assets/safety_badge.png" alt="HeartLink Verified & Safe" className="w-32 h-32 rounded-xl object-cover flex-shrink-0" loading="lazy" />
              <div>
                <h3 className="text-xl font-bold text-gray-900 mb-4">Why HeartLink is India's Best Dating App</h3>
                <div className="text-gray-600 space-y-3 text-sm leading-relaxed">
                  <p>
                    HeartLink is India's fastest growing dating app designed specifically for Indian singles looking for meaningful relationships. 
                    Unlike international apps like Tinder or Bumble, HeartLink understands Indian dating culture, family values, and regional preferences.
                  </p>
                  <p>
                    Our AI-powered matchmaking considers your interests, relationship goals, location, and lifestyle to suggest the most compatible matches. 
                    Whether you're in Delhi NCR, Mumbai, Bangalore, or any city across India, HeartLink helps you find genuine connections nearby.
                  </p>
                  <p>
                    Safety is our top priority. Every profile goes through verification, and our women safety features include night quiet hours, 
                    screenshot alerts, and instant blocking. HeartLink is the safest dating app for Indian women.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 text-white" aria-label="Call to action">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
            Ready to Find Your Perfect Match?
          </h2>
          <p className="text-xl mb-10 opacity-90">
            Join 50,000+ Indians finding meaningful connections every day. Your love story starts here!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              data-testid="cta-signup-btn"
              onClick={() => navigate('/auth')}
              className="bg-white text-pink-600 hover:bg-gray-100 px-10 py-6 text-lg rounded-full shadow-xl transform hover:scale-105 transition-all duration-300"
            >
              Sign Up Free Now
            </Button>
            <Button
              onClick={() => window.open('https://play.google.com/store/apps/details?id=com.heartlink.app', '_blank')}
              className="bg-transparent border-2 border-white text-white hover:bg-white/10 px-10 py-6 text-lg rounded-full transform hover:scale-105 transition-all duration-300"
            >
              <Download className="w-5 h-5 mr-2" /> Download App
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-16" role="contentinfo">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
            <div>
              <h3 className="font-bold text-lg mb-4">HeartLink</h3>
              <p className="text-gray-400 text-sm">India's safest AI-powered dating app. Find real love with verified profiles.</p>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Company</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/about" className="hover:text-white transition-colors">About Us</a></li>
                <li><a href="/contact" className="hover:text-white transition-colors">Contact</a></li>
                <li><a href="/careers" className="hover:text-white transition-colors">Careers</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Legal</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white transition-colors">Terms of Service</a></li>
                <li><a href="/child-safety-standards" className="hover:text-white transition-colors">Safety Standards</a></li>
              </ul>
            </div>
            <div>
              <h3 className="font-bold text-lg mb-4">Support</h3>
              <ul className="space-y-2 text-gray-400 text-sm">
                <li><a href="/data-deletion" className="hover:text-white transition-colors">Delete Data</a></li>
                <li><a href="/account-deletion" className="hover:text-white transition-colors">Delete Account</a></li>
                <li><a href="mailto:support@heartlink.co.in" className="hover:text-white transition-colors">Email Support</a></li>
              </ul>
            </div>
          </div>
          {/* SEO City Links */}
          <div className="border-t border-gray-800 pt-6 pb-4">
            <h3 className="font-semibold text-sm text-gray-400 mb-3">Dating by City</h3>
            <div className="flex flex-wrap gap-2">
              {['Mumbai','Delhi','Bangalore','Hyderabad','Chennai','Pune','Kolkata','Jaipur','Lucknow','Ahmedabad','Noida','Gurgaon','Chandigarh','Indore'].map(c => (
                <a key={c} href={`/dating/${c.toLowerCase()}`} className="text-xs text-gray-500 hover:text-pink-400 transition-colors">
                  Dating in {c}
                </a>
              ))}
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center">
            <p className="text-gray-400">
              © 2026 HeartLink India. Made with ❤️ in India for Indians.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
