import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { 
  CheckCircle, XCircle, User, Search, Trash2, 
  Ban, Camera, Users, AlertTriangle, ChevronLeft, 
  ChevronRight, RefreshCw, UserCheck, Bell,
  TrendingUp, UserPlus, Clock, Calendar, Filter,
  Eye, MessageCircle, Heart, Shield, Crown,
  Activity, BarChart3, PieChart, ClipboardCheck
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import NotificationManager from '@/components/admin/NotificationManager';
import ProfileApprovals from '@/components/admin/ProfileApprovals';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Stats Card Component
const StatCard = ({ icon: Icon, label, value, subValue, color, bgColor }) => (
  <div className={`${bgColor} rounded-xl p-4 shadow-sm`}>
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{label}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subValue && <p className="text-xs text-gray-500 mt-1">{subValue}</p>}
      </div>
      <div className={`p-3 ${color} rounded-full`}>
        <Icon className="w-6 h-6 text-white" />
      </div>
    </div>
  </div>
);

// UserCard Component
const UserCard = ({ u, onBlock, onUnblock, onDelete, onView }) => {
  if (!u) return null;
  
  const lastActive = u.last_active ? new Date(u.last_active) : null;
  const isOnline = lastActive && (Date.now() - lastActive.getTime()) < 5 * 60 * 1000; // 5 min
  const daysSinceActive = lastActive ? Math.floor((Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)) : null;
  
  return (
    <div className="bg-white rounded-xl shadow-md p-4 flex items-start gap-4">
      <div className="relative">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center overflow-hidden flex-shrink-0">
          {u.profile_picture ? (
            <img src={u.profile_picture} alt={u.name || 'User'} className="w-full h-full object-cover" />
          ) : (
            <User className="w-8 h-8 text-white" />
          )}
        </div>
        {isOnline && (
          <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-gray-900">{u.name || 'Unknown'}</h3>
          {u.verified && <CheckCircle className="w-4 h-4 text-blue-500" />}
          {u.is_premium && <Crown className="w-4 h-4 text-amber-500" />}
          {u.is_admin && <Shield className="w-4 h-4 text-purple-500" />}
        </div>
        
        <p className="text-sm text-gray-500 truncate">{u.email || u.phone || 'No contact'}</p>
        
        <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
          <span className={`px-2 py-0.5 rounded-full ${
            u.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
          }`}>
            {u.gender || 'Unknown'}
          </span>
          <span>{u.age || '?'} yrs</span>
          <span>• {u.location || 'Unknown'}</span>
        </div>
        
        <div className="flex items-center gap-3 mt-2 text-xs">
          {lastActive && (
            <span className={`flex items-center gap-1 ${isOnline ? 'text-green-600' : 'text-gray-400'}`}>
              <Clock className="w-3 h-3" />
              {isOnline ? 'Online' : daysSinceActive === 0 ? 'Today' : `${daysSinceActive}d ago`}
            </span>
          )}
          <span className={`px-2 py-0.5 rounded-full ${
            u.trust_badge_level === 'high' ? 'bg-green-100 text-green-700' :
            u.trust_badge_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {u.trust_badge_level || 'low'} trust
          </span>
        </div>

        {/* Status badges */}
        <div className="flex flex-wrap gap-1 mt-2">
          {u.is_shadow_banned && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Shadow Banned</span>
          )}
          {u.is_permanently_banned && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Banned</span>
          )}
          {u.profile_complete === false && (
            <span className="px-2 py-0.5 bg-orange-100 text-orange-700 text-xs rounded-full">Incomplete</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={() => onView(u)}>
          <Eye className="w-4 h-4" />
        </Button>
        {(u.is_shadow_banned || u.is_permanently_banned) ? (
          <Button size="sm" variant="outline" className="text-green-600 border-green-600" onClick={() => onUnblock(u.id, u.name)}>
            <UserCheck className="w-4 h-4" />
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="text-yellow-600 border-yellow-600" onClick={() => onBlock(u)}>
            <Ban className="w-4 h-4" />
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-red-600 border-red-600" onClick={() => onDelete(u)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};

// VerificationCard Component
const VerificationCard = ({ v, onVerify }) => {
  if (!v) return null;
  
  return (
    <div className="bg-white rounded-xl shadow-md p-4">
      <div className="flex items-start gap-4">
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
          {v.profile_picture ? (
            <img src={v.profile_picture} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-10 h-10 text-gray-400" />
            </div>
          )}
        </div>
        <div className="w-20 h-20 rounded-lg overflow-hidden bg-gray-100 border-2 border-blue-500">
          {v.selfie_verification_url ? (
            <img src={v.selfie_verification_url} alt="Selfie" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Camera className="w-10 h-10 text-gray-400" />
            </div>
          )}
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-gray-900">{v.name || 'Unknown'}</h3>
          <p className="text-sm text-gray-500">{v.email || v.phone || 'No contact'}</p>
          <p className="text-xs text-gray-400 mt-1">
            Submitted: {v.selfie_submitted_at ? new Date(v.selfie_submitted_at).toLocaleDateString() : 'Unknown'}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <Button className="flex-1 bg-green-500 hover:bg-green-600" onClick={() => onVerify(v.id, 'approve')}>
          <CheckCircle className="w-4 h-4 mr-2" /> Approve
        </Button>
        <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={() => onVerify(v.id, 'reject', 'Photo does not match')}>
          <XCircle className="w-4 h-4 mr-2" /> Reject
        </Button>
      </div>
    </div>
  );
};

// User Detail Modal
const UserDetailModal = ({ user, onClose }) => {
  if (!user) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-start gap-4 mb-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center overflow-hidden">
            {user.profile_picture ? (
              <img src={user.profile_picture} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-white" />
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold">{user.name}</h2>
            <p className="text-gray-500">{user.email || user.phone}</p>
            <div className="flex gap-2 mt-2">
              {user.verified && <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">Verified</span>}
              {user.is_premium && <span className="px-2 py-1 bg-amber-100 text-amber-700 text-xs rounded-full">Premium</span>}
              {user.is_admin && <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">Admin</span>}
            </div>
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Gender</p>
            <p className="font-medium">{user.gender || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Age</p>
            <p className="font-medium">{user.age || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Location</p>
            <p className="font-medium">{user.location || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Looking For</p>
            <p className="font-medium">{user.looking_for || 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Joined</p>
            <p className="font-medium">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Last Active</p>
            <p className="font-medium">{user.last_active ? new Date(user.last_active).toLocaleString() : 'N/A'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg col-span-2">
            <p className="text-gray-500">Bio</p>
            <p className="font-medium">{user.bio || 'No bio'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Trust Level</p>
            <p className="font-medium">{user.trust_badge_level || 'low'}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Risk Score</p>
            <p className="font-medium">{user.risk_score || 0}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Total Matches</p>
            <p className="font-medium">{user.total_matches || 0}</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-500">Total Likes</p>
            <p className="font-medium">{user.total_likes_received || 0}</p>
          </div>
        </div>
        
        <div className="mt-4">
          <p className="text-gray-500 text-sm mb-2">Interests</p>
          <div className="flex flex-wrap gap-2">
            {user.interests?.length > 0 ? user.interests.map((interest, i) => (
              <span key={i} className="px-3 py-1 bg-pink-100 text-pink-700 rounded-full text-sm">{interest}</span>
            )) : <span className="text-gray-400">No interests</span>}
          </div>
        </div>
        
        <Button onClick={onClose} className="w-full mt-6" variant="outline">Close</Button>
      </div>
    </div>
  );
};

// Error Fallback Component
const ErrorFallback = ({ error, resetError }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-4">{error?.message || 'An error occurred'}</p>
      <Button onClick={resetError} className="bg-pink-500 hover:bg-pink-600">Try Again</Button>
    </div>
  </div>
);

// Main AdminDashboard Component
const AdminDashboard = ({ user }) => {
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [verifiedUsers, setVerifiedUsers] = useState([]);
  const [showVerifiedTab, setShowVerifiedTab] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [showUserDetail, setShowUserDetail] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockPermanent, setBlockPermanent] = useState(false);
  const [genderFilter, setGenderFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [reverifyReason, setReverifyReason] = useState('');

  // Fetch dashboard stats
  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/admin/dashboard-stats`);
      setStats(res.data);
    } catch (e) {
      console.error('Stats fetch error:', e);
    }
  }, []);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/all-users`, {
        params: { 
          search: searchQuery, 
          page: currentPage, 
          limit: 15,
          gender: genderFilter !== 'all' ? genderFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sort: sortBy
        }
      });
      
      if (Array.isArray(response.data)) {
        setUsers(response.data);
        setTotalPages(1);
      } else {
        setUsers(response.data.users || []);
        setTotalPages(response.data.pages || 1);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, currentPage, genderFilter, statusFilter, sortBy]);

  const fetchPendingVerifications = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pending-verifications`);
      setPendingVerifications(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load verifications:', err);
      setPendingVerifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVerifiedUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/verified-users`);
      setVerifiedUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load verified users:', err);
      setVerifiedUsers([]);
    }
  }, []);

  const handleRequestReverify = async (userId) => {
    try {
      const res = await axios.post(`${API}/admin/request-reverify`, {
        user_id: userId,
        reason: reverifyReason
      });
      if (res.data.success) {
        toast.success('Re-verification requested');
        setReverifyReason('');
        fetchVerifiedUsers();
        fetchPendingVerifications();
      }
    } catch (err) {
      toast.error('Failed to request re-verification');
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'verifications') {
      fetchPendingVerifications();
      fetchVerifiedUsers();
    }
  }, [activeTab, fetchUsers, fetchPendingVerifications, fetchVerifiedUsers]);

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.delete(`${API}/admin/user/${selectedUser.id}`);
      toast.success(`User ${selectedUser.name} deleted`);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
      fetchStats();
    } catch (err) {
      toast.error('Failed to delete user');
    }
  };

  const handleBlockUser = async () => {
    if (!selectedUser) return;
    try {
      await axios.post(`${API}/admin/user/${selectedUser.id}/block`, null, {
        params: { permanent: blockPermanent, reason: blockReason }
      });
      toast.success(`User ${selectedUser.name} ${blockPermanent ? 'permanently banned' : 'shadow banned'}`);
      setShowBlockModal(false);
      setSelectedUser(null);
      setBlockReason('');
      setBlockPermanent(false);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to block user');
    }
  };

  const handleUnblockUser = async (userId, userName) => {
    try {
      await axios.post(`${API}/admin/user/${userId}/unblock`);
      toast.success(`User ${userName} unblocked`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to unblock user');
    }
  };

  const handleVerifySelfie = async (userId, action, reason = '') => {
    try {
      await axios.post(`${API}/admin/verify-selfie`, { user_id: userId, action, reason });
      toast.success(`Verification ${action === 'approve' ? 'approved' : 'rejected'}`);
      fetchPendingVerifications();
    } catch (err) {
      toast.error('Failed to process verification');
    }
  };

  const handleViewUser = (user) => {
    setSelectedUser(user);
    setShowUserDetail(true);
  };

  if (error) {
    return <ErrorFallback error={error} resetError={() => { setError(null); fetchUsers(); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" style={{ paddingTop: '120px' }}>
      <TopBar />
      <Toaster position="top-center" richColors />
      <Navbar user={user} />

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage users, verifications & notifications</p>
          </div>
          <Button onClick={() => { fetchStats(); fetchUsers(); }}>
            <RefreshCw className="w-4 h-4 mr-2" /> Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <Button
            onClick={() => setActiveTab('overview')}
            className={activeTab === 'overview' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <BarChart3 className="w-4 h-4 mr-2" /> Overview
          </Button>
          <Button
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <Users className="w-4 h-4 mr-2" /> All Users
          </Button>
          <Button
            onClick={() => setActiveTab('verifications')}
            className={activeTab === 'verifications' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <Camera className="w-4 h-4 mr-2" /> Verifications
            {pendingVerifications?.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingVerifications.length}
              </span>
            )}
          </Button>
          <Button
            onClick={() => setActiveTab('approvals')}
            className={activeTab === 'approvals' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <ClipboardCheck className="w-4 h-4 mr-2" /> Approvals
          </Button>
          <Button
            onClick={() => setActiveTab('notifications')}
            className={activeTab === 'notifications' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <Bell className="w-4 h-4 mr-2" /> Notifications
          </Button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={Users} 
                label="Total Users" 
                value={stats?.total_users || 0}
                subValue={`+${stats?.new_today || 0} today`}
                color="bg-blue-500" 
                bgColor="bg-blue-50" 
              />
              <StatCard 
                icon={User} 
                label="Male Users" 
                value={stats?.male_users || 0}
                subValue={`${stats?.total_users ? Math.round((stats.male_users / stats.total_users) * 100) : 0}%`}
                color="bg-sky-500" 
                bgColor="bg-sky-50" 
              />
              <StatCard 
                icon={User} 
                label="Female Users" 
                value={stats?.female_users || 0}
                subValue={`${stats?.total_users ? Math.round((stats.female_users / stats.total_users) * 100) : 0}%`}
                color="bg-pink-500" 
                bgColor="bg-pink-50" 
              />
              <StatCard 
                icon={Activity} 
                label="Active Today" 
                value={stats?.active_today || 0}
                color="bg-green-500" 
                bgColor="bg-green-50" 
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={UserPlus} 
                label="New This Week" 
                value={stats?.new_this_week || 0}
                color="bg-purple-500" 
                bgColor="bg-purple-50" 
              />
              <StatCard 
                icon={Heart} 
                label="Total Matches" 
                value={stats?.total_matches || 0}
                color="bg-red-500" 
                bgColor="bg-red-50" 
              />
              <StatCard 
                icon={Crown} 
                label="Premium Users" 
                value={stats?.premium_users || 0}
                color="bg-amber-500" 
                bgColor="bg-amber-50" 
              />
              <StatCard 
                icon={CheckCircle} 
                label="Verified Users" 
                value={stats?.verified_users || 0}
                color="bg-teal-500" 
                bgColor="bg-teal-50" 
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={Clock} 
                label="Inactive (7+ days)" 
                value={stats?.inactive_users || 0}
                color="bg-gray-500" 
                bgColor="bg-gray-100" 
              />
              <StatCard 
                icon={Ban} 
                label="Banned Users" 
                value={stats?.banned_users || 0}
                color="bg-red-600" 
                bgColor="bg-red-50" 
              />
              <StatCard 
                icon={Camera} 
                label="Pending Verifications" 
                value={stats?.pending_verifications || 0}
                color="bg-orange-500" 
                bgColor="bg-orange-50" 
              />
              <StatCard 
                icon={MessageCircle} 
                label="Total Messages" 
                value={stats?.total_messages || 0}
                color="bg-indigo-500" 
                bgColor="bg-indigo-50" 
              />
            </div>

            {/* Recent Activity */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pink-500" />
                Recent Signups
              </h3>
              <div className="space-y-3">
                {stats?.recent_signups?.map((user, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center">
                        {user.profile_picture ? (
                          <img src={user.profile_picture} alt={user.name} className="w-full h-full rounded-full object-cover" />
                        ) : (
                          <User className="w-5 h-5 text-white" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{user.name}</p>
                        <p className="text-xs text-gray-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        user.gender?.toLowerCase() === 'male' ? 'bg-blue-100 text-blue-700' : 'bg-pink-100 text-pink-700'
                      }`}>
                        {user.gender}
                      </span>
                      <p className="text-xs text-gray-400 mt-1">
                        {user.created_at ? new Date(user.created_at).toLocaleDateString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
                {(!stats?.recent_signups || stats.recent_signups.length === 0) && (
                  <p className="text-center text-gray-500 py-4">No recent signups</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {/* Filters */}
            <div className="bg-white rounded-xl shadow-md p-4 mb-4">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      placeholder="Search by name, email or phone..."
                      value={searchQuery}
                      onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                      className="pl-10"
                    />
                  </div>
                </div>
                
                <select
                  value={genderFilter}
                  onChange={(e) => { setGenderFilter(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Genders</option>
                  <option value="male">Male Only</option>
                  <option value="female">Female Only</option>
                </select>

                <select
                  value={statusFilter}
                  onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active (7 days)</option>
                  <option value="inactive">Inactive (7+ days)</option>
                  <option value="premium">Premium</option>
                  <option value="verified">Verified</option>
                  <option value="banned">Banned</option>
                </select>

                <select
                  value={sortBy}
                  onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="newest">Newest First</option>
                  <option value="oldest">Oldest First</option>
                  <option value="last_active">Last Active</option>
                  <option value="name">Name A-Z</option>
                </select>
              </div>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {users?.length > 0 && users.map(u => (
                    u?.id ? (
                      <UserCard 
                        key={u.id} 
                        u={u} 
                        onBlock={(usr) => { setSelectedUser(usr); setShowBlockModal(true); }}
                        onUnblock={handleUnblockUser}
                        onDelete={(usr) => { setSelectedUser(usr); setShowDeleteModal(true); }}
                        onView={handleViewUser}
                      />
                    ) : null
                  ))}
                </div>

                {(!users || users.length === 0) && (
                  <div className="text-center py-12 text-gray-500">No users found</div>
                )}

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-6">
                    <Button variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage(p => p - 1)}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-gray-600">Page {currentPage} of {totalPages}</span>
                    <Button variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => p + 1)}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Verifications Tab */}
        {activeTab === 'verifications' && (
          <>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (!pendingVerifications || pendingVerifications.length === 0) ? (
              <div className="text-center py-12">
                <Camera className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-600">No pending verifications</h3>
                <p className="text-gray-400">All caught up!</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {pendingVerifications.map(v => (
                  v?.id ? <VerificationCard key={v.id} v={v} onVerify={handleVerifySelfie} /> : null
                ))}
              </div>
            )}
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && <NotificationManager />}

        {/* Profile Approvals Tab */}
        {activeTab === 'approvals' && <ProfileApprovals />}
      </div>

      {/* User Detail Modal */}
      {showUserDetail && <UserDetailModal user={selectedUser} onClose={() => { setShowUserDetail(false); setSelectedUser(null); }} />}

      {/* Delete Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Delete User</h3>
                <p className="text-sm text-gray-500">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-gray-700 mb-6">
              Delete <strong>{selectedUser.name}</strong>? All their data will be permanently removed.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}>Cancel</Button>
              <Button className="flex-1 bg-red-500 hover:bg-red-600" onClick={handleDeleteUser}>Delete</Button>
            </div>
          </div>
        </div>
      )}

      {/* Block Modal */}
      {showBlockModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center">
                <Ban className="w-6 h-6 text-yellow-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Block User</h3>
                <p className="text-sm text-gray-500">{selectedUser.name}</p>
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <Input placeholder="Enter reason..." value={blockReason} onChange={(e) => setBlockReason(e.target.value)} />
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="permanent" checked={blockPermanent} onChange={(e) => setBlockPermanent(e.target.checked)} className="w-4 h-4" />
                <label htmlFor="permanent" className="text-sm text-gray-700">Permanent ban</label>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowBlockModal(false); setSelectedUser(null); setBlockReason(''); setBlockPermanent(false); }}>Cancel</Button>
              <Button className={`flex-1 ${blockPermanent ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'}`} onClick={handleBlockUser}>
                {blockPermanent ? 'Permanent Ban' : 'Shadow Ban'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
