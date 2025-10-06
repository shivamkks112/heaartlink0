import { useState, useEffect } from 'react';
import axios from 'axios';
import { CheckCircle, XCircle, User, Shield, Search, Filter } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Toaster } from '@/components/ui/sonner';
import Navbar from '@/components/Navbar';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AdminDashboard = ({ user }) => {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [verifiedUsers, setVerifiedUsers] = useState([]);
  const [rejectedUsers, setRejectedUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending'); // pending, verified, rejected
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchUsers();
  }, [filter]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API}/admin/users?status=${filter}`);
      
      if (filter === 'pending') {
        setPendingUsers(response.data);
      } else if (filter === 'verified') {
        setVerifiedUsers(response.data);
      } else {
        setRejectedUsers(response.data);
      }
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (userId, action, reason = '') => {
    try {
      await axios.post(`${API}/admin/verify-user`, {
        user_id: userId,
        action: action, // 'approve' or 'reject'
        reason: reason,
        verified_by: user.id
      });

      toast.success(`User ${action === 'approve' ? 'verified' : 'rejected'} successfully`);
      fetchUsers();
    } catch (error) {
      toast.error('Verification failed');
    }
  };

  const handleApprove = (userId) => {
    if (window.confirm('Approve this user?')) {
      handleVerify(userId, 'approve');
    }
  };

  const handleReject = (userId) => {
    const reason = window.prompt('Reason for rejection:');
    if (reason) {
      handleVerify(userId, 'reject', reason);
    }
  };

  const filteredUsers = () => {
    let users = filter === 'pending' ? pendingUsers : 
                filter === 'verified' ? verifiedUsers : rejectedUsers;
    
    if (searchQuery) {
      users = users.filter(u => 
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    
    return users;
  };

  if (!user.is_admin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <Shield className="w-20 h-20 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Access Denied</h2>
          <p className="text-gray-600">You don't have admin privileges</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-orange-50">
      <Toaster position="top-center" />
      <Navbar user={user} />
      
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Admin Dashboard</h1>
          <p className="text-gray-600">Manage user verifications</p>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl shadow-lg p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            {/* Status Filter */}
            <div className="flex gap-2">
              <Button
                data-testid="filter-pending"
                onClick={() => setFilter('pending')}
                className={`px-6 py-3 rounded-xl font-semibold ${
                  filter === 'pending'
                    ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending ({pendingUsers.length})
              </Button>
              
              <Button
                data-testid="filter-verified"
                onClick={() => setFilter('verified')}
                className={`px-6 py-3 rounded-xl font-semibold ${
                  filter === 'verified'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Verified ({verifiedUsers.length})
              </Button>
              
              <Button
                data-testid="filter-rejected"
                onClick={() => setFilter('rejected')}
                className={`px-6 py-3 rounded-xl font-semibold ${
                  filter === 'rejected'
                    ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Rejected ({rejectedUsers.length})
              </Button>
            </div>

            {/* Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search users..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 py-3 rounded-xl border-2 border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Users List */}
        {loading ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading users...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {filteredUsers().length === 0 ? (
              <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
                <User className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-600">No users found</p>
              </div>
            ) : (
              filteredUsers().map((userItem) => (
                <div
                  key={userItem.id}
                  data-testid="user-verification-card"
                  className="bg-white rounded-2xl shadow-lg p-6 hover:shadow-xl transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      {/* Profile Picture */}
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-orange-400 flex items-center justify-center text-white font-bold text-xl overflow-hidden">
                        {userItem.profile_picture ? (
                          <img 
                            src={userItem.profile_picture} 
                            alt={userItem.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          userItem.name.charAt(0)
                        )}
                      </div>

                      {/* User Info */}
                      <div>
                        <h3 className="text-xl font-bold text-gray-900">
                          {userItem.name}, {userItem.age}
                        </h3>
                        <p className="text-gray-600">{userItem.email || userItem.phone}</p>
                        <p className="text-sm text-gray-500">{userItem.location}</p>
                        
                        {/* Status Badge */}
                        <div className="mt-2">
                          {userItem.verification_status === 'pending' && (
                            <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold">
                              Pending Review
                            </span>
                          )}
                          {userItem.verification_status === 'verified' && (
                            <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                              ✓ Verified
                            </span>
                          )}
                          {userItem.verification_status === 'rejected' && (
                            <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold">
                              ✗ Rejected
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {filter === 'pending' && (
                      <div className="flex gap-3">
                        <Button
                          data-testid="approve-user-btn"
                          onClick={() => handleApprove(userItem.id)}
                          className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                        >
                          <CheckCircle className="w-5 h-5" />
                          Approve
                        </Button>
                        
                        <Button
                          data-testid="reject-user-btn"
                          onClick={() => handleReject(userItem.id)}
                          className="bg-red-500 hover:bg-red-600 text-white px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
                        >
                          <XCircle className="w-5 h-5" />
                          Reject
                        </Button>
                      </div>
                    )}

                    {userItem.rejection_reason && (
                      <div className="ml-4">
                        <p className="text-sm text-red-600">
                          <strong>Reason:</strong> {userItem.rejection_reason}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* User Details */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Gender:</span>
                        <span className="ml-2 font-semibold">{userItem.gender}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Looking for:</span>
                        <span className="ml-2 font-semibold">{userItem.looking_for}</span>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Bio:</span>
                        <p className="mt-1 text-gray-700">{userItem.bio || 'No bio'}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="text-gray-500">Interests:</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {userItem.interests && userItem.interests.length > 0 ? (
                            userItem.interests.map((interest, idx) => (
                              <span
                                key={idx}
                                className="bg-gradient-to-r from-pink-100 to-orange-100 text-gray-800 px-3 py-1 rounded-full text-xs"
                              >
                                {interest}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-400 text-xs">No interests</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;
