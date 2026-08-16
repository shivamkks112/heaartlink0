import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Heart, Shield, Users, Star, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CITY_DATA = {
  'mumbai': { name: 'Mumbai', state: 'Maharashtra', tagline: 'Maximum City, Maximum Love', users: '5,000+' },
  'delhi': { name: 'Delhi', state: 'NCR', tagline: 'Dil Waalon Ki Dating App', users: '4,500+' },
  'bangalore': { name: 'Bangalore', state: 'Karnataka', tagline: 'Tech City Love Stories', users: '3,800+' },
  'hyderabad': { name: 'Hyderabad', state: 'Telangana', tagline: 'Biryani & Love', users: '2,200+' },
  'chennai': { name: 'Chennai', state: 'Tamil Nadu', tagline: 'Find Your Marina Match', users: '1,800+' },
  'pune': { name: 'Pune', state: 'Maharashtra', tagline: 'Young, Fun & In Love', users: '2,500+' },
  'kolkata': { name: 'Kolkata', state: 'West Bengal', tagline: 'City of Joy, City of Love', users: '1,500+' },
  'jaipur': { name: 'Jaipur', state: 'Rajasthan', tagline: 'Pink City Romance', users: '1,200+' },
  'lucknow': { name: 'Lucknow', state: 'Uttar Pradesh', tagline: 'Nawabi Style Dating', users: '1,000+' },
  'ahmedabad': { name: 'Ahmedabad', state: 'Gujarat', tagline: 'Heritage Meets Modern Love', users: '1,100+' },
  'chandigarh': { name: 'Chandigarh', state: 'Punjab', tagline: 'City Beautiful Love Stories', users: '800+' },
  'indore': { name: 'Indore', state: 'Madhya Pradesh', tagline: 'Cleanest City, Purest Connections', users: '700+' },
  'bhopal': { name: 'Bhopal', state: 'Madhya Pradesh', tagline: 'City of Lakes, City of Love', users: '600+' },
  'noida': { name: 'Noida', state: 'Uttar Pradesh', tagline: 'NCR Love Connections', users: '2,000+' },
  'gurgaon': { name: 'Gurgaon', state: 'Haryana', tagline: 'Millennium City Dating', users: '2,500+' },
};

const CityDatingPage = () => {
  const { city } = useParams();
  const navigate = useNavigate();
  const data = CITY_DATA[city?.toLowerCase()] || { name: city || 'Your City', state: 'India', tagline: 'Find Love Near You', users: '500+' };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-rose-500 via-pink-500 to-orange-400 text-white">
        <div className="max-w-3xl mx-auto px-4 py-16 text-center">
          <div className="flex items-center justify-center gap-2 mb-4">
            <MapPin className="w-5 h-5" />
            <span className="text-white/80">{data.name}, {data.state}</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Dating in {data.name}
          </h1>
          <p className="text-xl text-white/90 mb-2">{data.tagline}</p>
          <p className="text-white/70 mb-8">{data.users} singles already on HeartLink</p>
          <Button
            onClick={() => navigate('/')}
            data-testid="city-cta-btn"
            className="bg-white text-pink-600 hover:bg-gray-100 px-8 py-4 rounded-full text-lg font-bold shadow-xl"
          >
            Join HeartLink Free <ArrowRight className="w-5 h-5 ml-2 inline" />
          </Button>
        </div>
      </div>

      {/* Features */}
      <div className="max-w-3xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-center text-gray-900 mb-8">
          Why {data.name} Singles Choose HeartLink
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {[
            { icon: Shield, title: 'Verified Profiles', desc: 'Every profile is verified. No fake accounts, no catfishing.', color: 'bg-blue-100 text-blue-600' },
            { icon: Heart, title: 'AI Matchmaking', desc: 'Smart algorithm finds your best matches based on interests & values.', color: 'bg-pink-100 text-pink-600' },
            { icon: Users, title: `${data.users} Local Singles`, desc: `Connect with real people in ${data.name}. Active community growing daily.`, color: 'bg-green-100 text-green-600' },
            { icon: Star, title: 'Women Safety First', desc: 'Built-in safety features, phone masking & scam detection.', color: 'bg-orange-100 text-orange-600' },
          ].map(({ icon: Icon, title, desc, color }) => (
            <div key={title} className="bg-white rounded-2xl p-5 shadow-sm">
              <div className={`w-12 h-12 ${color} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{title}</h3>
              <p className="text-sm text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="bg-white py-12">
        <div className="max-w-lg mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Start Dating in {data.name} Today
          </h2>
          <p className="text-gray-600 mb-6">100% Free. No credit card needed. Join thousands of singles in {data.name}.</p>
          <Button
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-pink-500 to-orange-500 text-white px-8 py-4 rounded-full text-lg font-bold shadow-lg hover:shadow-xl"
          >
            Get Started Free
          </Button>
          <p className="text-xs text-gray-400 mt-4">Also available on <a href="https://play.google.com/store/apps/details?id=com.heartlink.app" className="underline">Google Play Store</a></p>
        </div>
      </div>

      {/* SEO Footer */}
      <div className="bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          <h3 className="font-semibold text-gray-900 mb-3">Dating in Other Cities</h3>
          <div className="flex flex-wrap gap-2">
            {Object.entries(CITY_DATA).filter(([k]) => k !== city?.toLowerCase()).slice(0, 10).map(([slug, c]) => (
              <a
                key={slug}
                href={`/dating/${slug}`}
                className="px-3 py-1.5 bg-white rounded-full text-sm text-gray-700 hover:text-pink-600 hover:bg-pink-50 transition-colors shadow-sm"
              >
                Dating in {c.name}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-6">HeartLink - India's #1 Safe Dating App. Find genuine connections in {data.name} and across India.</p>
        </div>
      </div>
    </div>
  );
};

export default CityDatingPage;
