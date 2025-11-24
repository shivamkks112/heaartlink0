import { useState, useEffect } from 'react';
import axios from 'axios';
import { ArrowLeft, UserX, BellOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const SettingsPage = ({ user }) => {
  const navigate = useNavigate();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [mutedUsers, setMutedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const response = await axios.get(`${API}/profile/${user.id}`);
      const userData = response.data;
      
      // Fetch blocked users details
      const blockedIds = userData.blocked_users || [];
      const blockedUsersData = await Promise.all(
        blockedIds.map(async (userId) => {
          try {
            const userResponse = await axios.get(`${API}/user/${userId}`);
            return userResponse.data;
          } catch (error) {
            return null;
          }
        })
      );
      setBlockedUsers(blockedUsersData.filter(u => u !== null));

      // Fetch muted users details
      const mutedIds = userData.muted_users || [];
      const mutedUsersData = await Promise.all(
        mutedIds.map(async (userId) => {
          try {
            const userResponse = await axios.get(`${API}/user/${userId}`);
            return userResponse.data;
          } catch (error) {
            return null;
          }
        })
      );
      setMutedUsers(mutedUsersData.filter(u => u !== null));
      
      setLoading(false);
    } catch (error) {
      toast.error('Failed to load settings');
      setLoading(false);
      console.error('Settings error:', error);
    }
  };

  const handleUnblock = async (blockedUserId) => {
    try {
      await axios.post(`${API}/user/${user.id}/unblock`, {
        blocked_user_id: blockedUserId
      });
      setBlockedUsers(prev => prev.filter(u => u.id !== blockedUserId));
      toast.success('User unblocked');
    } catch (error) {
      toast.error('Failed to unblock user');
      console.error('Unblock error:', error);
    }
  };

  const handleUnmute = async (mutedUserId) => {
    try {
      await axios.post(`${API}/user/${user.id}/unmute`, {
        muted_user_id: mutedUserId
      });
      setMutedUsers(prev => prev.filter(u => u.id !== mutedUserId));
      toast.success('User unmuted');
    } catch (error) {
      toast.error('Failed to unmute user');
      console.error('Unmute error:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center page-with-bottom-nav status-bar-spacing">
        <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 page-with-bottom-nav status-bar-spacing">
      <Toaster position="top-center" />
      
      {/* Header */}
      <div className="bg-white shadow-md px-4 py-4 flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-full transition-all"
        >
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-xl font-bold text-gray-900">Privacy Settings</h1>
      </div>

      {/* Content */}
      <div className="p-4">
        <Tabs defaultValue="blocked" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="blocked">
              Blocked ({blockedUsers.length})
            </TabsTrigger>
            <TabsTrigger value="muted">
              Muted ({mutedUsers.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="blocked" className="space-y-3">
            {blockedUsers.length === 0 ? (
              <div className="text-center py-12">
                <UserX className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No blocked users</p>
              </div>
            ) : (
              blockedUsers.map((blockedUser) => (
                <div
                  key={blockedUser.id}
                  className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {blockedUser.profile_picture ? (
                        <img 
                          src={blockedUser.profile_picture} 
                          alt={blockedUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        blockedUser.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{blockedUser.name}</h3>
                      <p className="text-sm text-gray-500">{blockedUser.age} years old</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnblock(blockedUser.id)}
                    variant="outline"
                    size="sm"
                    className="border-red-200 text-red-600 hover:bg-red-50"
                  >
                    Unblock
                  </Button>
                </div>
              ))
            )}
          </TabsContent>

          <TabsContent value="muted" className="space-y-3">
            {mutedUsers.length === 0 ? (
              <div className="text-center py-12">
                <BellOff className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No muted users</p>
              </div>
            ) : (
              mutedUsers.map((mutedUser) => (
                <div
                  key={mutedUser.id}
                  className="bg-white rounded-xl p-4 shadow-sm flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-lg overflow-hidden">
                      {mutedUser.profile_picture ? (
                        <img 
                          src={mutedUser.profile_picture} 
                          alt={mutedUser.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        mutedUser.name.charAt(0)
                      )}
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{mutedUser.name}</h3>
                      <p className="text-sm text-gray-500">Notifications muted</p>
                    </div>
                  </div>
                  <Button
                    onClick={() => handleUnmute(mutedUser.id)}
                    variant="outline"
                    size="sm"
                    className="border-blue-200 text-blue-600 hover:bg-blue-50"
                  >
                    Unmute
                  </Button>
                </div>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default SettingsPage;
