import { useState, useEffect, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import { 
  CheckCircle, XCircle, User, Search, Trash2, 
  Ban, Camera, Users, AlertTriangle, ChevronLeft, 
  ChevronRight, RefreshCw, UserCheck, Bell,
  TrendingUp, UserPlus, Clock, Calendar, Filter,
  Eye, MessageCircle, Heart, Shield, Crown,
  Activity, BarChart3, PieChart, ClipboardCheck, Settings,
  Bot, Power, RotateCcw, KeyRound
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';
import NotificationManager from '@/components/admin/NotificationManager';
import ProfileApprovals from '@/components/admin/ProfileApprovals';
import GrowthAcquisition from '@/components/admin/GrowthAcquisition';

import { BACKEND_URL } from '@/config/api';

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
const UserCard = ({ u, onBlock, onUnblock, onDelete, onView, onResetPassword }) => {
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
        <Button size="sm" variant="outline" className="text-blue-600 border-blue-600" onClick={() => onResetPassword(u)} data-testid={`reset-password-btn-${u.id}`}>
            <KeyRound className="w-4 h-4" />
          </Button>
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
  const [featureFlags, setFeatureFlags] = useState({ referral_system: true, daily_rewards: true });
  const [flagsLoading, setFlagsLoading] = useState(false);
  const [aiProfiles, setAiProfiles] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsError, setStatsError] = useState(null);

  // Fetch feature flags
  const fetchFeatureFlags = useCallback(async () => {
    try {
      const res = await adminApi.get(`/admin/feature-flags`);
      setFeatureFlags(res.data);
    } catch (e) {
      console.error('Feature flags fetch error:', e);
    }
  }, []);

  const toggleFeatureFlag = async (flagName, value) => {
    setFlagsLoading(true);
    try {
      const res = await adminApi.put(`/admin/feature-flags`, { [flagName]: value });
      setFeatureFlags(res.data);
      toast.success(`${flagName.replace('_', ' ')} ${value ? 'enabled' : 'disabled'}!`);
    } catch (e) {
      toast.error('Failed to update feature flag');
    } finally {
      setFlagsLoading(false);
    }
  };

  // AI Profiles Management
  const fetchAiProfiles = useCallback(async () => {
    setAiLoading(true);
    try {
      const res = await adminApi.get(`/admin/ai-profiles`);
      setAiProfiles(res.data);
    } catch (e) {
      console.error('AI profiles fetch error:', e);
    } finally {
      setAiLoading(false);
    }
  }, []);

  const toggleAiProfile = async (profileId, isActive) => {
    try {
      await adminApi.put(`/admin/ai-profiles/${profileId}/toggle`, { is_active: isActive });
      toast.success(`AI profile ${isActive ? 'activated' : 'deactivated'}`);
      fetchAiProfiles();
    } catch (e) {
      toast.error('Failed to toggle AI profile');
    }
  };

  const deleteAiProfile = async (profileId, name) => {
    if (!window.confirm(`Kya aap "${name}" AI profile delete karna chahte ho? Iske saare matches aur messages bhi delete ho jayenge.`)) return;
    try {
      await adminApi.delete(`/admin/ai-profiles/${profileId}`);
      toast.success(`${name} deleted successfully`);
      fetchAiProfiles();
    } catch (e) {
      toast.error('Failed to delete AI profile');
    }
  };

  const reseedAiProfiles = async () => {
    try {
      await adminApi.post(`/admin/ai-profiles/reseed`);
      toast.success('AI profiles re-seeded!');
      fetchAiProfiles();
    } catch (e) {
      toast.error('Failed to reseed AI profiles');
    }
  };

  // Fetch dashboard stats — always fresh
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      const res = await adminApi.get(`/admin/dashboard-stats`, {
        params: { _t: Date.now() },
        headers: { 'Cache-Control': 'no-cache' }
      });
      setStats(res.data);
      setLastRefreshed(new Date());
    } catch (e) {
      console.error('Stats fetch error:', e);
      setStatsError(e.response?.data?.detail || e.message || 'Failed to load stats');
      toast.error('Failed to load dashboard stats: ' + (e.response?.data?.detail || e.message));
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch users with filters
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await adminApi.get(`/admin/all-users`, {
        params: { 
          search: searchQuery, 
          page: currentPage, 
          limit: 15,
          gender: genderFilter !== 'all' ? genderFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sort: sortBy,
          _t: Date.now()
        },
        headers: { 'Cache-Control': 'no-cache' }
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
      const response = await adminApi.get(`/admin/pending-verifications`);
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
      const response = await adminApi.get(`/admin/verified-users`);
      setVerifiedUsers(Array.isArray(response.data) ? response.data : []);
    } catch (err) {
      console.error('Failed to load verified users:', err);
      setVerifiedUsers([]);
    }
  }, []);

  const handleRequestReverify = async (userId) => {
    try {
      const res = await adminApi.post(`/admin/request-reverify`, {
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
    // Auto-refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'verifications') {
      fetchPendingVerifications();
      fetchVerifiedUsers();
    } else if (activeTab === 'settings') {
      fetchFeatureFlags();
    } else if (activeTab === 'ai-profiles') {
      fetchAiProfiles();
    }
  }, [activeTab, fetchUsers, fetchPendingVerifications, fetchVerifiedUsers, fetchFeatureFlags, fetchAiProfiles]);

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.delete(`/admin/user/${selectedUser.id}`);
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
      await adminApi.post(`/admin/user/${selectedUser.id}/block`, null, {
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
      await adminApi.post(`/admin/user/${userId}/unblock`);
      toast.success(`User ${userName} unblocked`);
      fetchUsers();
    } catch (err) {
      toast.error('Failed to unblock user');
    }
  };

  const handleVerifySelfie = async (userId, action, reason = '') => {
    try {
      await adminApi.post(`/admin/verify-selfie`, { user_id: userId, action, reason });
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

  const handleResetPassword = async () => {
    if (!selectedUser || !resetNewPassword) return;
    setResetPasswordLoading(true);
    try {
      await adminApi.post(`/admin/reset-user-password`, {
        user_id: selectedUser.id,
        new_password: resetNewPassword
      });
      toast.success(`${selectedUser.name} ka password reset ho gaya!`);
      setShowResetPasswordModal(false);
      setResetNewPassword('');
      setSelectedUser(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Password reset failed');
    } finally {
      setResetPasswordLoading(false);
    }
  };

  if (error) {
    return <ErrorFallback error={error} resetError={() => { setError(null); fetchUsers(); }} />;
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface-container-low)', paddingTop: 'calc(var(--safe-top, 24px) + 100px)', paddingBottom: 'calc(var(--nav-total, 86px) + 16px)' }}>
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
          <div className="flex items-center gap-3">
            {lastRefreshed && (
              <span className="text-xs text-gray-400">
                Last: {lastRefreshed.toLocaleTimeString('en-IN')}
              </span>
            )}
            <Button 
              onClick={() => { fetchStats(); if (activeTab === 'users') fetchUsers(); }}
              disabled={statsLoading}
              data-testid="admin-refresh-btn"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${statsLoading ? 'animate-spin' : ''}`} /> 
              {statsLoading ? 'Loading...' : 'Refresh'}
            </Button>
          </div>
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
          <Button
            onClick={() => setActiveTab('settings')}
            className={activeTab === 'settings' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
            data-testid="admin-settings-tab"
          >
            <Settings className="w-4 h-4 mr-2" /> Settings
          </Button>
          <Button
            onClick={() => setActiveTab('ai-profiles')}
            className={activeTab === 'ai-profiles' ? 'bg-purple-500' : 'bg-gray-200 text-gray-700'}
            data-testid="admin-ai-profiles-tab"
          >
            <Bot className="w-4 h-4 mr-2" /> AI Girls
          </Button>
          <Button
            onClick={() => setActiveTab('growth')}
            className={activeTab === 'growth' ? 'bg-green-600' : 'bg-gray-200 text-gray-700'}
            data-testid="admin-growth-tab"
          >
            <TrendingUp className="w-4 h-4 mr-2" /> Growth
          </Button>
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            {/* Error Banner */}
            {statsError && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3" data-testid="stats-error-banner">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-red-800">Failed to load stats</p>
                  <p className="text-xs text-red-600">{statsError}</p>
                </div>
                <Button size="sm" className="ml-auto bg-red-500 hover:bg-red-600" onClick={fetchStats}>Retry</Button>
              </div>
            )}
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
                label="🟢 Online Now" 
                value={stats?.online_now || 0}
                subValue="Last 5 min"
                color="bg-emerald-500" 
                bgColor="bg-emerald-50" 
              />
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard 
                icon={Activity} 
                label="Active Today" 
                value={stats?.active_today || 0}
                color="bg-green-500" 
                bgColor="bg-green-50" 
              />
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
                        onResetPassword={(usr) => { setSelectedUser(usr); setShowResetPasswordModal(true); }}
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
            {/* Toggle between pending and verified */}
            <div className="flex gap-2 mb-6">
              <Button
                onClick={() => setShowVerifiedTab(false)}
                className={!showVerifiedTab ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
              >
                Pending ({pendingVerifications?.length || 0})
              </Button>
              <Button
                onClick={() => setShowVerifiedTab(true)}
                className={showVerifiedTab ? 'bg-green-500' : 'bg-gray-200 text-gray-700'}
              >
                ✓ Verified ({verifiedUsers?.length || 0})
              </Button>
            </div>

            {!showVerifiedTab ? (
              // Pending Verifications
              loading ? (
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
              )
            ) : (
              // Verified Users - Re-verify option
              verifiedUsers.length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-gray-600">No verified users</h3>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {verifiedUsers.map(v => (
                    <div key={v.id} className="bg-white rounded-xl shadow-lg p-4 border border-green-200">
                      <div className="flex items-center gap-3 mb-3">
                        <img
                          src={v.profile_picture || '/default-avatar.png'}
                          alt={v.name}
                          className="w-14 h-14 rounded-full object-cover border-2 border-green-500"
                          onError={(e) => { e.target.src = '/default-avatar.png'; }}
                        />
                        <div>
                          <h4 className="font-semibold text-gray-900 flex items-center gap-1">
                            {v.name}
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          </h4>
                          <p className="text-xs text-gray-500">
                            Verified: {v.selfie_verified_at ? new Date(v.selfie_verified_at).toLocaleDateString() : 'N/A'}
                          </p>
                        </div>
                      </div>
                      
                      {/* Selfie comparison */}
                      {v.selfie_verification_url && (
                        <div className="flex gap-2 mb-3">
                          <img
                            src={v.profile_picture}
                            alt="Profile"
                            className="w-16 h-16 rounded object-cover"
                          />
                          <img
                            src={v.selfie_verification_url}
                            alt="Selfie"
                            className="w-16 h-16 rounded object-cover"
                          />
                        </div>
                      )}
                      
                      {/* Re-verify button */}
                      <div className="space-y-2">
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={reverifyReason}
                          onChange={(e) => setReverifyReason(e.target.value)}
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                        <Button
                          onClick={() => handleRequestReverify(v.id)}
                          className="w-full bg-yellow-500 hover:bg-yellow-600 text-white"
                          size="sm"
                        >
                          🔄 Request Re-verification
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && <NotificationManager />}

        {/* Profile Approvals Tab */}
        {activeTab === 'approvals' && <ProfileApprovals />}

        {/* AI Girls Tab */}
        {activeTab === 'ai-profiles' && (
          <div className="space-y-6" data-testid="admin-ai-profiles-panel">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900">AI Girl Profiles</h2>
                <p className="text-sm text-gray-500 mt-1">Manage AI chatbot profiles that auto-match with new users</p>
              </div>
              <Button onClick={reseedAiProfiles} variant="outline" data-testid="reseed-ai-btn">
                <RotateCcw className="w-4 h-4 mr-2" /> Re-seed Profiles
              </Button>
            </div>

            {aiLoading ? (
              <div className="text-center py-10 text-gray-500">Loading AI profiles...</div>
            ) : aiProfiles.length === 0 ? (
              <div className="text-center py-10 text-gray-500">No AI profiles found. Click Re-seed to create them.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {aiProfiles.map((profile) => (
                  <div key={profile.id} className={`bg-white rounded-xl border-2 shadow-sm overflow-hidden transition-all ${profile.is_active_ai ? 'border-green-200' : 'border-red-200 opacity-75'}`} data-testid={`ai-profile-card-${profile.id}`}>
                    <div className="relative">
                      <div className="h-40 bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center">
                        {profile.photos && profile.photos[0] ? (
                          <img src={profile.photos[0]} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                          <Bot className="w-16 h-16 text-white/60" />
                        )}
                      </div>
                      <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-semibold ${profile.is_active_ai ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {profile.is_active_ai ? 'Active' : 'Inactive'}
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-900 text-lg">{profile.name}</h3>
                        <span className="text-sm text-gray-500">{profile.age}</span>
                      </div>
                      <p className="text-sm text-gray-500">{profile.location}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{profile.bio}</p>

                      <div className="flex gap-3 mt-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1"><Heart className="w-3 h-3" /> {profile.total_matches || 0} matches</span>
                        <span className="flex items-center gap-1"><MessageCircle className="w-3 h-3" /> {profile.total_messages_sent || 0} msgs</span>
                      </div>

                      <div className="flex gap-2 mt-4">
                        <button
                          onClick={() => toggleAiProfile(profile.id, !profile.is_active_ai)}
                          data-testid={`toggle-ai-${profile.id}`}
                          className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                            profile.is_active_ai
                              ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                              : 'bg-green-100 text-green-700 hover:bg-green-200'
                          }`}
                        >
                          <Power className="w-4 h-4" />
                          {profile.is_active_ai ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          onClick={() => deleteAiProfile(profile.id, profile.name)}
                          data-testid={`delete-ai-${profile.id}`}
                          className="flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-sm text-purple-800">
              <strong>How it works:</strong> AI girls auto-match with new male users (2-3 random matches). They send a greeting message and reply in Hinglish using AI. Deactivating a profile stops new matches and replies but keeps existing chats. Deleting removes all data.
            </div>
          </div>
        )}
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

      {/* Reset Password Modal */}
      {showResetPasswordModal && selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <KeyRound className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900" data-testid="reset-password-modal-title">Reset Password</h3>
                <p className="text-sm text-gray-500">{selectedUser.name} ({selectedUser.email})</p>
              </div>
            </div>
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                <Input 
                  type="password" 
                  placeholder="Enter new password..." 
                  value={resetNewPassword} 
                  onChange={(e) => setResetNewPassword(e.target.value)} 
                  data-testid="reset-password-input"
                />
                <p className="text-xs text-gray-400 mt-1">Min 6 chars, mix of letters, numbers & special chars recommended</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => { setShowResetPasswordModal(false); setSelectedUser(null); setResetNewPassword(''); }} data-testid="reset-password-cancel-btn">Cancel</Button>
              <Button 
                className="flex-1 bg-blue-500 hover:bg-blue-600" 
                onClick={handleResetPassword} 
                disabled={!resetNewPassword || resetPasswordLoading}
                data-testid="reset-password-confirm-btn"
              >
                {resetPasswordLoading ? 'Resetting...' : 'Reset Password'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Growth & Acquisition Tab */}
      {activeTab === 'growth' && (
        <GrowthAcquisition />
      )}

      {/* Settings Tab - Feature Toggles */}
      {activeTab === 'settings' && (
        <div className="space-y-6" data-testid="admin-settings-panel">
          <h2 className="text-xl font-bold text-gray-900">Feature Settings</h2>
          
          <div className="bg-white rounded-xl border p-5 space-y-5">
            <h3 className="font-semibold text-gray-800 text-lg">Feature Toggles</h3>
            <p className="text-sm text-gray-500">Enable or disable features for all users.</p>
            
            {/* Referral System Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl" data-testid="referral-toggle-row">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Referral System</h4>
                  <p className="text-sm text-gray-500">Invite 3 friends = 10 Superlikes reward</p>
                </div>
              </div>
              <button
                onClick={() => toggleFeatureFlag('referral_system', !featureFlags.referral_system)}
                disabled={flagsLoading}
                data-testid="referral-toggle-btn"
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                  featureFlags.referral_system ? 'bg-green-500' : 'bg-gray-300'
                } ${flagsLoading ? 'opacity-50' : ''}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                  featureFlags.referral_system ? 'translate-x-7' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* Daily Rewards Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl" data-testid="daily-rewards-toggle-row">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center">
                  <Crown className="w-5 h-5 text-pink-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Daily Login Rewards</h4>
                  <p className="text-sm text-gray-500">7-day streak with Superlikes & Boost rewards</p>
                </div>
              </div>
              <button
                onClick={() => toggleFeatureFlag('daily_rewards', !featureFlags.daily_rewards)}
                disabled={flagsLoading}
                data-testid="daily-rewards-toggle-btn"
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                  featureFlags.daily_rewards ? 'bg-green-500' : 'bg-gray-300'
                } ${flagsLoading ? 'opacity-50' : ''}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                  featureFlags.daily_rewards ? 'translate-x-7' : 'translate-x-0.5'
                }`} />
              </button>
            </div>

            {/* AI Chatbot Toggle */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl" data-testid="ai-chatbot-toggle-row">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Bot className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">AI Girl Chatbot</h4>
                  <p className="text-sm text-gray-500">Auto-match AI girls with new users & reply in Hinglish</p>
                </div>
              </div>
              <button
                onClick={() => toggleFeatureFlag('ai_chatbot', !featureFlags.ai_chatbot)}
                disabled={flagsLoading}
                data-testid="ai-chatbot-toggle-btn"
                className={`relative w-14 h-7 rounded-full transition-colors duration-200 ${
                  featureFlags.ai_chatbot ? 'bg-green-500' : 'bg-gray-300'
                } ${flagsLoading ? 'opacity-50' : ''}`}
              >
                <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform duration-200 ${
                  featureFlags.ai_chatbot ? 'translate-x-7' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>

          {/* Status Legend */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-800">
            <strong>Note:</strong> Disabling a feature will immediately prevent users from accessing it. Existing data (streaks, referral codes) will be preserved and available when re-enabled.
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
