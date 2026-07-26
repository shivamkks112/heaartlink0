import { useState, useEffect } from 'react';
import axios from 'axios';
import { Eye, ArrowLeft, User, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

import { BACKEND_URL, API } from '@/config/api';

const ProfileViewersPage = ({ user }) => {
  const navigate = useNavigate();
  const [viewers, setViewers] = useState([]);
  const [totalViews, setTotalViews] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      fetchViewers();
    }
  }, [user?.id]);

  const fetchViewers = async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    
    try {
      const response = await axios.get(`${API}/user/${user.id}/profile-viewers`);
      setViewers(response.data.viewers || []);
      setTotalViews(response.data.total_views || 0);
    } catch (error) {
      console.error('Profile viewers load error:', error);
      toast.error('Failed to load profile viewers');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Recently';
    
    const now = new Date();
    const viewedAt = new Date(timestamp);
    const diffMs = now - viewedAt;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return viewedAt.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 60px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
      <TopBar />
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-white/50 rounded-full transition-all"
          >
            <ArrowLeft className="w-6 h-6 text-gray-700" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Profile Viewers</h1>
            <p className="text-gray-600">People who viewed your profile</p>
          </div>
        </div>

        {/* Stats Card */}
        <div className="bg-gradient-to-r from-orange-500 to-pink-500 rounded-2xl p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-100 text-sm">Total Profile Views</p>
              <h2 className="text-4xl font-bold">{totalViews}</h2>
            </div>
            <div className="bg-white/20 p-4 rounded-2xl">
              <Eye className="w-8 h-8" />
            </div>
          </div>
        </div>

        {/* Recent Viewers */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900">Recent Viewers (Last 5)</h3>
          </div>
          
          {viewers.length === 0 ? (
            <div className="p-12 text-center">
              <div className="bg-gray-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
                <Eye className="w-10 h-10 text-gray-400" />
              </div>
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No viewers yet</h3>
              <p className="text-gray-500">
                When someone views your profile, they will appear here.
                <br />
                <span className="text-sm">(Incognito viewers will not be shown)</span>
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {viewers.map((viewer, index) => (
                <div 
                  key={viewer.id || index}
                  className="p-4 flex items-center gap-4 hover:bg-gray-50 transition-all cursor-pointer"
                  onClick={() => navigate(`/user/${viewer.id}`)}
                  data-testid={`viewer-${index}`}
                >
                  <div className="w-14 h-14 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                    {viewer.profile_picture ? (
                      <img 
                        src={viewer.profile_picture} 
                        alt={viewer.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <User className="w-7 h-7" />
                    )}
                  </div>
                  
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{viewer.name}</h4>
                    {viewer.age && (
                      <p className="text-sm text-gray-500">{viewer.age} years old</p>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 text-gray-400 text-sm">
                    <Clock className="w-4 h-4" />
                    <span>{formatTime(viewer.viewed_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div className="mt-6 bg-blue-50 rounded-xl p-4 border border-blue-200">
          <p className="text-sm text-blue-800">
            <strong>Note:</strong> Users browsing in Incognito Mode will not appear in your viewers list.
            Enable Incognito Mode in Privacy settings to browse privately.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ProfileViewersPage;
