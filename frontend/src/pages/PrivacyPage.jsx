import { useState, useEffect } from 'react';
import axios from 'axios';
import { Shield, Eye, EyeOff, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const PrivacyPage = ({ user }) => {
  const [settings, setSettings] = useState({
    show_profile: true,
    show_photos: true,
    incognito_mode: false
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user.privacy_settings) {
      setSettings(user.privacy_settings);
    }
  }, [user]);

  const handleUpdate = async (key, value) => {
    setLoading(true);
    try {
      const updates = { [key]: value };
      await axios.put(`${API}/privacy/${user.id}`, updates);
      setSettings({ ...settings, [key]: value });
      toast.success('Privacy settings updated');
    } catch (error) {
      toast.error('Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Privacy & Safety</h1>
          <p className="text-gray-600">Control who sees your profile and content</p>
        </div>

        <div className="space-y-6">
          {/* Show Profile */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-gradient-to-br from-pink-100 to-orange-100 p-3 rounded-xl">
                    <Eye className="w-6 h-6 text-pink-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Show Profile</h3>
                </div>
                <p className="text-gray-600 ml-[60px]">
                  Allow others to discover your profile in their feed
                </p>
              </div>
              <Switch
                data-testid="show-profile-toggle"
                checked={settings.show_profile}
                onCheckedChange={(checked) => handleUpdate('show_profile', checked)}
                disabled={loading}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-pink-500 data-[state=checked]:to-orange-500"
              />
            </div>
          </div>

          {/* Show Photos */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-gradient-to-br from-purple-100 to-pink-100 p-3 rounded-xl">
                    <Users className="w-6 h-6 text-purple-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Show Photos</h3>
                </div>
                <p className="text-gray-600 ml-[60px]">
                  Display your photos to matched users only
                </p>
              </div>
              <Switch
                data-testid="show-photos-toggle"
                checked={settings.show_photos}
                onCheckedChange={(checked) => handleUpdate('show_photos', checked)}
                disabled={loading}
                className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-purple-500 data-[state=checked]:to-pink-500"
              />
            </div>
          </div>

          {/* Incognito Mode */}
          <div className="bg-white rounded-2xl shadow-lg p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="bg-gradient-to-br from-gray-100 to-gray-200 p-3 rounded-xl">
                    <EyeOff className="w-6 h-6 text-gray-700" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900">Incognito Mode</h3>
                </div>
                <p className="text-gray-600 ml-[60px]">
                  Browse profiles without others knowing you viewed them
                </p>
              </div>
              <Switch
                data-testid="incognito-toggle"
                checked={settings.incognito_mode}
                onCheckedChange={(checked) => handleUpdate('incognito_mode', checked)}
                disabled={loading}
                className="data-[state=checked]:bg-gray-700"
              />
            </div>
          </div>

          {/* Safety Info */}
          <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl shadow-lg p-6 border-2 border-blue-200">
            <div className="flex items-start gap-3">
              <Shield className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-lg font-bold text-blue-900 mb-2">Safety First</h3>
                <ul className="text-blue-800 space-y-2 text-sm">
                  <li>• Block and report users who make you uncomfortable</li>
                  <li>• Never share personal information like address or financial details</li>
                  <li>• Meet in public places for first dates</li>
                  <li>• Trust your instincts - if something feels wrong, it probably is</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPage;
