import { useState, useEffect } from 'react';
import adminApi from '@/utils/adminApi';
import { 
  UserCheck, UserX, RefreshCw, Clock, CheckCircle, 
  XCircle, Eye, ChevronDown, ChevronUp, Users,
  Image, MapPin, Calendar, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';


const ProfileApprovals = () => {
  const [pendingProfiles, setPendingProfiles] = useState([]);
  const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedProfile, setExpandedProfile] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const ITEMS_PER_PAGE = 20;

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async (pageNum = 1, append = false) => {
    try {
      const [profilesRes, statsRes] = await Promise.all([
        adminApi.get(`/admin/pending-profiles?page=${pageNum}&limit=${ITEMS_PER_PAGE}`),
        adminApi.get(`/admin/profile-approval-stats`)
      ]);
      
      const newProfiles = profilesRes.data || [];
      if (append) {
        setPendingProfiles(prev => [...prev, ...newProfiles]);
      } else {
        setPendingProfiles(newProfiles);
      }
      
      setHasMore(newProfiles.length === ITEMS_PER_PAGE);
      setStats(statsRes.data || { pending: 0, approved: 0, rejected: 0 });
    } catch (e) {
      console.error('Failed to fetch data', e);
      toast.error('Failed to load profiles');
    } finally {
      setLoading(false);
    }
  };

  const loadMore = async () => {
    const nextPage = page + 1;
    setPage(nextPage);
    await fetchData(nextPage, true);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    setPage(1);
    await fetchData(1, false);
    setRefreshing(false);
    toast.success('Refreshed!');
  };

  const handleApprove = async (userId) => {
    setProcessingId(userId);
    try {
      const res = await adminApi.post(`/admin/approve-profile`, {
        user_id: userId,
        action: 'approve'
      });
      if (res.data.success) {
        toast.success('✅ Profile approved!');
        setPendingProfiles(prev => prev.filter(p => p.id !== userId));
        setStats(prev => ({ ...prev, pending: prev.pending - 1, approved: prev.approved + 1 }));
      }
    } catch (e) {
      toast.error('Failed to approve profile');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (userId) => {
    if (!rejectReason.trim()) {
      toast.error('Please provide a reason for rejection');
      return;
    }
    
    setProcessingId(userId);
    try {
      const res = await adminApi.post(`/admin/approve-profile`, {
        user_id: userId,
        action: 'reject',
        reason: rejectReason
      });
      if (res.data.success) {
        toast.success('Profile rejected');
        setPendingProfiles(prev => prev.filter(p => p.id !== userId));
        setStats(prev => ({ ...prev, pending: prev.pending - 1, rejected: prev.rejected + 1 }));
        setRejectReason('');
        setExpandedProfile(null);
      }
    } catch (e) {
      toast.error('Failed to reject profile');
    } finally {
      setProcessingId(null);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedProfiles.length === 0) {
      toast.error('Select profiles to approve');
      return;
    }
    
    try {
      const res = await adminApi.post(`/admin/bulk-approve-profiles`, selectedProfiles);
      if (res.data.success) {
        toast.success(`✅ ${res.data.approved_count} profiles approved!`);
        setPendingProfiles(prev => prev.filter(p => !selectedProfiles.includes(p.id)));
        setSelectedProfiles([]);
        fetchData();
      }
    } catch (e) {
      toast.error('Bulk approve failed');
    }
  };

  const toggleSelectProfile = (userId) => {
    setSelectedProfiles(prev => 
      prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const selectAllProfiles = () => {
    if (selectedProfiles.length === pendingProfiles.length) {
      setSelectedProfiles([]);
    } else {
      setSelectedProfiles(pendingProfiles.map(p => p.id));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="w-8 h-8 animate-spin text-pink-500" />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-green-100 to-blue-100 rounded-full">
            <UserCheck className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Profile Approvals</h2>
            <p className="text-sm text-gray-500">Review and approve new profiles</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <Clock className="w-6 h-6 text-yellow-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-yellow-700">{stats.pending}</p>
          <p className="text-sm text-yellow-600">Pending</p>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
          <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-green-700">{stats.approved}</p>
          <p className="text-sm text-green-600">Approved</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <XCircle className="w-6 h-6 text-red-600 mx-auto mb-2" />
          <p className="text-2xl font-bold text-red-700">{stats.rejected}</p>
          <p className="text-sm text-red-600">Rejected</p>
        </div>
      </div>

      {/* Bulk Actions */}
      {pendingProfiles.length > 0 && (
        <div className="flex items-center justify-between bg-gray-50 rounded-lg p-3 mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedProfiles.length === pendingProfiles.length && pendingProfiles.length > 0}
              onChange={selectAllProfiles}
              className="w-4 h-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
            />
            <span className="text-sm text-gray-600">
              {selectedProfiles.length > 0 
                ? `${selectedProfiles.length} selected`
                : 'Select all'}
            </span>
          </label>
          
          {selectedProfiles.length > 0 && (
            <Button 
              size="sm" 
              onClick={handleBulkApprove}
              className="bg-green-500 hover:bg-green-600"
            >
              <UserCheck className="w-4 h-4 mr-1" />
              Approve Selected ({selectedProfiles.length})
            </Button>
          )}
        </div>
      )}

      {/* Profiles List */}
      {pendingProfiles.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg">No pending profiles</p>
          <p className="text-gray-400 text-sm">All profiles have been reviewed</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pendingProfiles.map(profile => (
            <div 
              key={profile.id}
              className={`border rounded-xl overflow-hidden transition-all ${
                selectedProfiles.includes(profile.id) 
                  ? 'border-pink-300 bg-pink-50/30' 
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {/* Profile Header */}
              <div className="flex items-center gap-4 p-4">
                <input
                  type="checkbox"
                  checked={selectedProfiles.includes(profile.id)}
                  onChange={() => toggleSelectProfile(profile.id)}
                  className="w-4 h-4 rounded border-gray-300 text-pink-500 focus:ring-pink-500"
                />
                
                <img
                  src={profile.profile_picture || '/default-avatar.png'}
                  alt={profile.name}
                  className="w-14 h-14 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => { e.target.src = '/default-avatar.png'; }}
                />
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-gray-900">{profile.name}</h3>
                    {profile.age && <span className="text-gray-500">{profile.age}</span>}
                    {profile.gender && (
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        profile.gender.toLowerCase() === 'male' 
                          ? 'bg-blue-100 text-blue-700' 
                          : 'bg-pink-100 text-pink-700'
                      }`}>
                        {profile.gender}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                    {profile.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {profile.location}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {formatDate(profile.created_at)}
                    </span>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    {expandedProfile === profile.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    size="sm"
                    onClick={() => handleApprove(profile.id)}
                    disabled={processingId === profile.id}
                    className="bg-green-500 hover:bg-green-600"
                  >
                    {processingId === profile.id ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <UserCheck className="w-4 h-4" />
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setExpandedProfile(expandedProfile === profile.id ? null : profile.id)}
                    className="text-red-500 border-red-200 hover:bg-red-50"
                  >
                    <UserX className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              
              {/* Expanded Details */}
              {expandedProfile === profile.id && (
                <div className="border-t border-gray-100 bg-gray-50 p-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    {/* Photos */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Image className="w-4 h-4" />
                        Photos ({(profile.photos || []).length})
                      </h4>
                      <div className="flex gap-2 flex-wrap">
                        {profile.profile_picture && (
                          <img
                            src={profile.profile_picture}
                            alt="Profile"
                            className="w-20 h-20 rounded-lg object-cover border"
                          />
                        )}
                        {(profile.photos || []).slice(0, 4).map((photo, idx) => (
                          <img
                            key={idx}
                            src={photo}
                            alt={`Photo ${idx + 1}`}
                            className="w-20 h-20 rounded-lg object-cover border"
                          />
                        ))}
                      </div>
                    </div>
                    
                    {/* Info */}
                    <div>
                      <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1">
                        <Info className="w-4 h-4" />
                        Details
                      </h4>
                      <div className="space-y-2 text-sm">
                        <p><span className="text-gray-500">Email:</span> {profile.email || 'N/A'}</p>
                        <p><span className="text-gray-500">Phone:</span> {profile.phone || 'N/A'}</p>
                        {profile.bio && (
                          <p><span className="text-gray-500">Bio:</span> {profile.bio}</p>
                        )}
                        {profile.interests?.length > 0 && (
                          <div>
                            <span className="text-gray-500">Interests:</span>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {profile.interests.map((interest, idx) => (
                                <span key={idx} className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                                  {interest}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Reject Section */}
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <h4 className="text-sm font-medium text-red-600 mb-2">Reject Profile</h4>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="Reason for rejection (required)..."
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleReject(profile.id)}
                        disabled={processingId === profile.id || !rejectReason.trim()}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        {processingId === profile.id ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <UserX className="w-4 h-4 mr-1" />
                            Reject
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {['Inappropriate photo', 'Fake profile', 'Incomplete info', 'Spam/scam'].map(reason => (
                        <button
                          key={reason}
                          onClick={() => setRejectReason(reason)}
                          className="px-2 py-1 text-xs bg-gray-100 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded transition"
                        >
                          {reason}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
          
          {/* Load More Button */}
          {hasMore && pendingProfiles.length > 0 && (
            <div className="text-center py-4">
              <Button
                variant="outline"
                onClick={loadMore}
                className="px-8"
              >
                Load More
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ProfileApprovals;
