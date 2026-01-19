import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  CheckCircle, XCircle, User, Shield, Search, Trash2, 
  Ban, Eye, Camera, Users, AlertTriangle, ChevronLeft, 
  ChevronRight, RefreshCw, UserCheck, UserX
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';
import TopBar from '@/components/TopBar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || import.meta.env?.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

// Error boundary component
const ErrorFallback = ({ error, resetError }) => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-xl shadow-lg p-6 max-w-md text-center">
      <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
      <p className="text-gray-600 mb-4">{error?.message || 'An error occurred loading the admin dashboard'}</p>
      <Button onClick={resetError} className="bg-pink-500 hover:bg-pink-600">
        Try Again
      </Button>
    </div>
  </div>
);

const AdminDashboard = ({ user }) => {
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('users'); // users, verifications, reports
  const [users, setUsers] = useState([]);
  const [pendingVerifications, setPendingVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [blockPermanent, setBlockPermanent] = useState(false);

  useEffect(() => {
    if (activeTab === 'users') {
      fetchUsers();
    } else if (activeTab === 'verifications') {
      fetchPendingVerifications();
    }
  }, [activeTab, currentPage, searchQuery]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/all-users`, {
        params: { search: searchQuery, page: currentPage, limit: 15 }
      });
      
      // Handle both old format (array) and new format (object with users)
      if (Array.isArray(response.data)) {
        // Old API format - direct array
        setUsers(response.data);
        setTotalPages(1);
      } else {
        // New API format - object with users array
        setUsers(response.data.users || []);
        setTotalPages(response.data.pages || 1);
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      toast.error('Failed to load users');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingVerifications = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/pending-verifications`);
      setPendingVerifications(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load verifications:', error);
      toast.error('Failed to load verifications');
      setPendingVerifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    
    try {
      await axios.delete(`${API}/admin/user/${selectedUser.id}`);
      toast.success(`User ${selectedUser.name} deleted`);
      setShowDeleteModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (error) {
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
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const handleUnblockUser = async (userId, userName) => {
    try {
      await axios.post(`${API}/admin/user/${userId}/unblock`);
      toast.success(`User ${userName} unblocked`);
      fetchUsers();
    } catch (error) {
      toast.error('Failed to unblock user');
    }
  };

  const handleVerifySelfie = async (userId, action, reason = '') => {
    try {
      await axios.post(`${API}/admin/verify-selfie`, {
        user_id: userId,
        action: action,
        reason: reason
      });
      toast.success(`Verification ${action === 'approve' ? 'approved' : 'rejected'}`);
      fetchPendingVerifications();
    } catch (error) {
      toast.error('Failed to process verification');
    }
  };

  const UserCard = ({ u }) => (
    <div className="bg-white rounded-xl shadow-md p-4 flex items-start gap-4">
      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center overflow-hidden flex-shrink-0">
        {u.profile_picture ? (
          <img src={u.profile_picture} alt={u.name} className="w-full h-full object-cover" />
        ) : (
          <User className="w-8 h-8 text-white" />
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-bold text-gray-900">{u.name}</h3>
          {u.verified && <CheckCircle className="w-4 h-4 text-green-500" />}
          {u.is_shadow_banned && (
            <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 text-xs rounded-full">Shadow Banned</span>
          )}
          {u.is_permanently_banned && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-xs rounded-full">Banned</span>
          )}
        </div>
        <p className="text-sm text-gray-500 truncate">{u.email || u.phone || 'No contact'}</p>
        <p className="text-xs text-gray-400">{u.gender}, {u.age} • {u.location || 'Unknown'}</p>
        
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className={`px-2 py-0.5 text-xs rounded-full ${
            u.trust_badge_level === 'high' ? 'bg-green-100 text-green-700' :
            u.trust_badge_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
            'bg-gray-100 text-gray-600'
          }`}>
            {u.trust_badge_level || 'low'} trust
          </span>
          {u.is_online && (
            <span className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">Online</span>
          )}
        </div>
      </div>
      
      <div className="flex flex-col gap-2">
        {(u.is_shadow_banned || u.is_permanently_banned) ? (
          <Button
            size="sm"
            variant="outline"
            className="text-green-600 border-green-600"
            onClick={() => handleUnblockUser(u.id, u.name)}
          >
            <UserCheck className="w-4 h-4" />
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            className="text-yellow-600 border-yellow-600"
            onClick={() => { setSelectedUser(u); setShowBlockModal(true); }}
          >
            <Ban className="w-4 h-4" />
          </Button>
        )}
        <Button
          size="sm"
          variant="outline"
          className="text-red-600 border-red-600"
          onClick={() => { setSelectedUser(u); setShowDeleteModal(true); }}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const VerificationCard = ({ v }) => (
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
          <h3 className="font-bold text-gray-900">{v.name}</h3>
          <p className="text-sm text-gray-500">{v.email || v.phone}</p>
          <p className="text-xs text-gray-400 mt-1">
            Submitted: {new Date(v.selfie_submitted_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      
      <div className="flex gap-2 mt-4">
        <Button
          className="flex-1 bg-green-500 hover:bg-green-600"
          onClick={() => handleVerifySelfie(v.id, 'approve')}
        >
          <CheckCircle className="w-4 h-4 mr-2" />
          Approve
        </Button>
        <Button
          className="flex-1 bg-red-500 hover:bg-red-600"
          onClick={() => handleVerifySelfie(v.id, 'reject', 'Photo does not match')}
        >
          <XCircle className="w-4 h-4 mr-2" />
          Reject
        </Button>
      </div>
    </div>
  );

  // Show error fallback if there's a critical error
  if (error) {
    return <ErrorFallback error={error} resetError={() => { setError(null); fetchUsers(); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-20" style={{ paddingTop: '70px' }}>
      <TopBar />
      <Toaster position="top-center" richColors />
      <Navbar user={user} />

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage users and verifications</p>
          </div>
          <Button onClick={() => activeTab === 'users' ? fetchUsers() : fetchPendingVerifications()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <Button
            onClick={() => setActiveTab('users')}
            className={activeTab === 'users' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <Users className="w-4 h-4 mr-2" />
            All Users
          </Button>
          <Button
            onClick={() => setActiveTab('verifications')}
            className={activeTab === 'verifications' ? 'bg-pink-500' : 'bg-gray-200 text-gray-700'}
          >
            <Camera className="w-4 h-4 mr-2" />
            Verifications
            {pendingVerifications.length > 0 && (
              <span className="ml-2 bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                {pendingVerifications.length}
              </span>
            )}
          </Button>
        </div>

        {/* Users Tab */}
        {activeTab === 'users' && (
          <>
            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                placeholder="Search by name, email or phone..."
                value={searchQuery}
                onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                className="pl-10"
              />
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  {users && users.length > 0 ? (
                    users.map(u => u && u.id ? <UserCard key={u.id} u={u} /> : null)
                  ) : null}
                </div>

                {(!users || users.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No users found
                  </div>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-4 mt-6">
                    <Button
                      variant="outline"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(p => p - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <span className="text-gray-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(p => p + 1)}
                    >
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
                {pendingVerifications.map(v => v && v.id ? <VerificationCard key={v.id} v={v} /> : null)}
              </div>
            )}
          </>
        )}
      </div>

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
              Are you sure you want to delete <strong>{selectedUser.name}</strong>? 
              All their data including matches and messages will be permanently removed.
            </p>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowDeleteModal(false); setSelectedUser(null); }}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 bg-red-500 hover:bg-red-600"
                onClick={handleDeleteUser}
              >
                Delete
              </Button>
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
                <Input
                  placeholder="Enter reason for blocking..."
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                />
              </div>
              
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="permanent"
                  checked={blockPermanent}
                  onChange={(e) => setBlockPermanent(e.target.checked)}
                  className="w-4 h-4 text-red-500"
                />
                <label htmlFor="permanent" className="text-sm text-gray-700">
                  Permanent ban (user cannot be unblocked)
                </label>
              </div>
            </div>
            
            <div className="flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => { setShowBlockModal(false); setSelectedUser(null); setBlockReason(''); setBlockPermanent(false); }}
              >
                Cancel
              </Button>
              <Button
                className={`flex-1 ${blockPermanent ? 'bg-red-500 hover:bg-red-600' : 'bg-yellow-500 hover:bg-yellow-600'}`}
                onClick={handleBlockUser}
              >
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
