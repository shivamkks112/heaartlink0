import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Send, Clock, Users, Calendar, 
  Trash2, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, Smartphone, AlertCircle, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || '';
const API = `${BACKEND_URL}/api`;

const NotificationManager = () => {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [target, setTarget] = useState('all');
  const [loading, setSending] = useState(false);
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [scheduled, setScheduled] = useState([]);
  const [activeTab, setActiveTab] = useState('send');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');
  const [onesignalStatus, setOnesignalStatus] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTemplates();
    fetchHistory();
    fetchScheduled();
    fetchOnesignalStatus();
  }, []);

  const fetchOnesignalStatus = async () => {
    try {
      const res = await axios.get(`${API}/admin/onesignal/status`);
      setOnesignalStatus(res.data);
    } catch (e) {
      console.error('Failed to fetch OneSignal status', e);
      // Fallback to FCM status
      try {
        const fcmRes = await axios.get(`${API}/admin/fcm-status`);
        setOnesignalStatus({
          configured: false,
          total_users: fcmRes.data?.total_users || 0,
          users_with_onesignal: fcmRes.data?.users_with_fcm_token || 0,
          can_send_notifications: fcmRes.data?.can_send_notifications || false,
          message: 'OneSignal not configured, using Firebase FCM'
        });
      } catch (e2) {
        console.error('FCM status also failed', e2);
      }
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/admin/notification-templates`);
      setTemplates(res.data || []);
    } catch (e) {
      console.error('Failed to fetch templates', e);
      // Default templates
      setTemplates([
        { id: 'welcome', title: '💕 Welcome!', body: 'Find your perfect match today!' },
        { id: 'new_feature', title: '🎉 New Feature!', body: 'Check out the new features in Heartlink!' },
        { id: 'reminder', title: '💝 Miss you!', body: 'Your matches are waiting for you!' },
      ]);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/admin/notification-history`);
      setHistory(res.data || []);
    } catch (e) {
      console.error('Failed to fetch history', e);
      setHistory([]);
    }
  };

  const fetchScheduled = async () => {
    try {
      const res = await axios.get(`${API}/admin/scheduled-notifications`);
      setScheduled(res.data || []);
    } catch (e) {
      console.error('Failed to fetch scheduled', e);
      setScheduled([]);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      fetchOnesignalStatus(),
      fetchHistory(),
      fetchScheduled()
    ]);
    setRefreshing(false);
    toast.success('Refreshed!');
  };

  // Send via OneSignal
  const handleSendViaOneSignal = async () => {
    if (!title || !body) {
      toast.error('Title aur Message dono required hai');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(`${API}/admin/onesignal/send`, {
        title,
        message: body,
        target
      });
      
      if (res.data.success) {
        toast.success(`✅ Notification sent to ${res.data.recipients || 'all'} users!`);
        setTitle('');
        setBody('');
        fetchHistory();
        fetchOnesignalStatus();
      } else {
        toast.error(res.data.error || 'Failed to send');
      }
    } catch (e) {
      console.error('OneSignal send error:', e);
      toast.error(e.response?.data?.detail || 'Notification send failed');
    } finally {
      setSending(false);
    }
  };

  // Send via Firebase (fallback)
  const handleSendViaFirebase = async () => {
    if (!title || !body) {
      toast.error('Title aur Body dono required hai');
      return;
    }

    setSending(true);
    try {
      const res = await axios.post(`${API}/admin/send-notification`, {
        title,
        body,
        target
      });
      
      if (res.data.success) {
        toast.success(`✅ ${res.data.success_count} users ko notification bheja!`);
        setTitle('');
        setBody('');
        fetchHistory();
      }
    } catch (e) {
      toast.error('Notification send failed');
    } finally {
      setSending(false);
    }
  };

  // Test OneSignal
  const handleTestOneSignal = async () => {
    setSending(true);
    try {
      const res = await axios.post(`${API}/admin/onesignal/test`);
      if (res.data.success) {
        toast.success('✅ Test notification sent!');
      } else {
        toast.error(res.data.error || 'Test failed');
      }
    } catch (e) {
      toast.error('Test notification failed');
    } finally {
      setSending(false);
    }
  };

  const handleSchedule = async () => {
    if (!title || !body || !scheduleDate || !scheduleTime) {
      toast.error('Sab fields required hai');
      return;
    }

    const scheduleDateTime = `${scheduleDate}T${scheduleTime}:00`;

    try {
      const res = await axios.post(`${API}/admin/schedule-notification`, {
        title,
        body,
        target,
        schedule_time: scheduleDateTime
      });
      
      if (res.data.success) {
        toast.success('✅ Notification scheduled!');
        setTitle('');
        setBody('');
        setScheduleDate('');
        setScheduleTime('');
        fetchScheduled();
      }
    } catch (e) {
      toast.error('Schedule failed');
    }
  };

  const handleCancelScheduled = async (id) => {
    try {
      await axios.delete(`${API}/admin/scheduled-notification/${id}`);
      toast.success('Notification cancelled');
      fetchScheduled();
    } catch (e) {
      toast.error('Cancel failed');
    }
  };

  const applyTemplate = (template) => {
    setTitle(template.title);
    setBody(template.body);
    toast.success('Template applied');
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-pink-100 rounded-full">
            <Bell className="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Push Notifications</h2>
            <p className="text-sm text-gray-500">OneSignal + Firebase</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
          <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* OneSignal Status Banner */}
      {onesignalStatus && (
        <div className={`mb-6 p-4 rounded-lg ${
          onesignalStatus.configured 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          <div className="flex items-start gap-3">
            {onesignalStatus.configured ? (
              <>
                <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800">
                    OneSignal Ready! ✅
                  </p>
                  <p className="text-sm text-green-600">
                    {onesignalStatus.users_with_onesignal || 0} users can receive notifications
                  </p>
                  <p className="text-xs text-green-500 mt-1">
                    Total users: {onesignalStatus.total_users || 0}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleTestOneSignal} disabled={loading}>
                  <Zap className="w-4 h-4 mr-1" />
                  Test
                </Button>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-800">
                    OneSignal Not Configured
                  </p>
                  <p className="text-sm text-yellow-600">
                    {onesignalStatus.message || 'Please set ONESIGNAL_APP_ID and ONESIGNAL_API_KEY'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'send' 
            ? 'text-pink-500 border-b-2 border-pink-500' 
            : 'text-gray-500'}`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Send Now
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'schedule' 
            ? 'text-pink-500 border-b-2 border-pink-500' 
            : 'text-gray-500'}`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium whitespace-nowrap ${activeTab === 'history' 
            ? 'text-pink-500 border-b-2 border-pink-500' 
            : 'text-gray-500'}`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Send Now Tab */}
      {activeTab === 'send' && (
        <div className="space-y-4">
          {/* Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {templates.map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition"
                >
                  {t.title}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="💕 Notification title..."
              maxLength={50}
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification message..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              rows={3}
              maxLength={200}
            />
            <p className="text-xs text-gray-400 text-right">{body.length}/200</p>
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target Users</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500"
            >
              <option value="all">📢 All Users</option>
              <option value="male">👨 Male Users Only</option>
              <option value="female">👩 Female Users Only</option>
              <option value="inactive">😴 Inactive Users (7+ days)</option>
            </select>
          </div>

          {/* Send Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              onClick={handleSendViaOneSignal}
              disabled={loading || !title || !body}
              className="bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600"
            >
              {loading ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-2" />
              )}
              {loading ? 'Sending...' : 'Send via OneSignal'}
            </Button>
            
            <Button
              onClick={handleSendViaFirebase}
              disabled={loading || !title || !body}
              variant="outline"
            >
              <Smartphone className="w-4 h-4 mr-2" />
              Send via Firebase
            </Button>
          </div>
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Notification title..."
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Notification message..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none"
              rows={3}
            />
          </div>

          {/* Target */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target</label>
            <select
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="all">All Users</option>
              <option value="male">Male Only</option>
              <option value="female">Female Only</option>
              <option value="inactive">Inactive Users</option>
            </select>
          </div>

          {/* Date & Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <Input
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>

          {/* Schedule Button */}
          <Button
            onClick={handleSchedule}
            className="w-full bg-blue-500 hover:bg-blue-600"
          >
            <Clock className="w-4 h-4 mr-2" />
            Schedule Notification
          </Button>

          {/* Scheduled List */}
          {scheduled.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-3">Pending Scheduled</h3>
              <div className="space-y-2">
                {scheduled.map(n => (
                  <div key={n.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(n.schedule_time).toLocaleString()} • {n.target}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelScheduled(n.id)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="space-y-3">
          <Button variant="outline" onClick={fetchHistory} className="mb-4">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh History
          </Button>

          {history.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No notifications sent yet</p>
            </div>
          ) : (
            history.map(h => (
              <div key={h.id} className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{h.title}</h4>
                    <p className="text-sm text-gray-600">{h.body}</p>
                  </div>
                  <span className="text-xs text-gray-400 whitespace-nowrap ml-2">
                    {new Date(h.sent_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {h.target}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-3 h-3 text-green-500" />
                    {h.success_count || h.result?.recipients || 0} sent
                  </span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-xs">
                    {h.provider || 'firebase'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
