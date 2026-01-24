import { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Bell, Send, Clock, Users, Calendar, 
  Trash2, RefreshCw, CheckCircle, AlertTriangle,
  ChevronDown, Smartphone, AlertCircle
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
  const [fcmStatus, setFcmStatus] = useState(null);

  useEffect(() => {
    fetchTemplates();
    fetchHistory();
    fetchScheduled();
    fetchFcmStatus();
  }, []);

  const fetchFcmStatus = async () => {
    try {
      const res = await axios.get(`${API}/admin/fcm-status`);
      setFcmStatus(res.data);
    } catch (e) {
      console.error('Failed to fetch FCM status', e);
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await axios.get(`${API}/admin/notification-templates`);
      setTemplates(res.data);
    } catch (e) {
      console.error('Failed to fetch templates', e);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${API}/admin/notification-history`);
      setHistory(res.data);
    } catch (e) {
      console.error('Failed to fetch history', e);
    }
  };

  const fetchScheduled = async () => {
    try {
      const res = await axios.get(`${API}/admin/scheduled-notifications`);
      setScheduled(res.data);
    } catch (e) {
      console.error('Failed to fetch scheduled', e);
    }
  };

  const handleSendNow = async () => {
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
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 bg-pink-100 rounded-full">
          <Bell className="w-6 h-6 text-pink-500" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-gray-900">Push Notifications</h2>
          <p className="text-sm text-gray-500">Send notifications to users</p>
        </div>
      </div>

      {/* FCM Status Banner */}
      {fcmStatus && (
        <div className={`mb-6 p-4 rounded-lg flex items-start gap-3 ${
          fcmStatus.can_send_notifications 
            ? 'bg-green-50 border border-green-200' 
            : 'bg-yellow-50 border border-yellow-200'
        }`}>
          {fcmStatus.can_send_notifications ? (
            <>
              <CheckCircle className="w-5 h-5 text-green-500 mt-0.5" />
              <div>
                <p className="font-medium text-green-800">
                  {fcmStatus.users_with_fcm_token} users can receive notifications
                </p>
                <p className="text-sm text-green-600">
                  {fcmStatus.users_without_token} users haven't enabled notifications yet
                </p>
              </div>
            </>
          ) : (
            <>
              <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium text-yellow-800">
                  No users can receive notifications yet
                </p>
                <p className="text-sm text-yellow-600">
                  Users need to login from Android app and allow notifications first.
                  Total users: {fcmStatus.total_users}
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium ${activeTab === 'send' 
            ? 'text-pink-500 border-b-2 border-pink-500' 
            : 'text-gray-500'}`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Send Now
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium ${activeTab === 'schedule' 
            ? 'text-pink-500 border-b-2 border-pink-500' 
            : 'text-gray-500'}`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Schedule
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium ${activeTab === 'history' 
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
                  className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full"
                >
                  {t.title.split(' ')[0]} {t.id.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="💕 Notification title..."
              maxLength={50}
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
              className="w-full p-3 border border-gray-300 rounded-lg"
            >
              <option value="all">📢 All Users</option>
              <option value="male">👨 Male Users Only</option>
              <option value="female">👩 Female Users Only</option>
              <option value="inactive">😴 Inactive Users (7+ days)</option>
            </select>
          </div>

          {/* Send Button */}
          <Button
            onClick={handleSendNow}
            disabled={loading || !title || !body}
            className="w-full bg-pink-500 hover:bg-pink-600"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {loading ? 'Sending...' : 'Send Notification'}
          </Button>
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
            Refresh
          </Button>

          {history.length === 0 ? (
            <p className="text-center text-gray-500 py-8">No notifications sent yet</p>
          ) : (
            history.map(h => (
              <div key={h.id} className="p-4 border border-gray-200 rounded-lg">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900">{h.title}</h4>
                    <p className="text-sm text-gray-600">{h.body}</p>
                  </div>
                  <span className="text-xs text-gray-400">
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
                    {h.success_count} sent
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
