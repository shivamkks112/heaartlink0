import { useState, useEffect } from 'react';
import adminApi from '@/utils/adminApi';
import { 
  Bell, Send, Clock, Users, Calendar, 
  Trash2, RefreshCw, CheckCircle, AlertTriangle,
  Smartphone, AlertCircle, Zap, Plus, Edit2,
  FileText, Tag, X, Copy, Sparkles
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

// Category colors
const categoryColors = {
  daily: 'bg-blue-100 text-blue-700',
  engagement: 'bg-pink-100 text-pink-700',
  're-engagement': 'bg-purple-100 text-purple-700',
  promotion: 'bg-green-100 text-green-700',
  announcement: 'bg-yellow-100 text-yellow-700',
  safety: 'bg-red-100 text-red-700',
  urgency: 'bg-orange-100 text-orange-700',
  monetization: 'bg-amber-100 text-amber-700',
  custom: 'bg-gray-100 text-gray-700'
};

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
  
  // Template management
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [newTemplateTitle, setNewTemplateTitle] = useState('');
  const [newTemplateBody, setNewTemplateBody] = useState('');
  const [newTemplateCategory, setNewTemplateCategory] = useState('custom');
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchTemplates();
    fetchHistory();
    fetchScheduled();
    fetchOnesignalStatus();
  }, []);

  const fetchOnesignalStatus = async () => {
    try {
      const res = await adminApi.get(`/admin/onesignal/status`);
      setOnesignalStatus(res.data);
    } catch (e) {
      console.error('Failed to fetch OneSignal status', e);
      setOnesignalStatus({
        configured: false,
        message: 'FCM not configured'
      });
    }
  };

  const fetchTemplates = async () => {
    try {
      const res = await adminApi.get(`/admin/notification-templates`);
      // Handle both array format (from DB) and engagement templates format
      if (Array.isArray(res.data)) {
        setTemplates(res.data || []);
      } else if (res.data && res.data.templates) {
        // Convert engagement templates object to array format
        const engagementTemplates = Object.entries(res.data.templates).map(([key, value]) => ({
          id: key,
          title: value.title,
          body: value.message,
          category: value.data?.type || 'engagement',
          isEngagement: true
        }));
        
        // Also fetch custom templates from DB
        try {
          const dbRes = await adminApi.get(`/admin/custom-templates`);
          const dbTemplates = Array.isArray(dbRes.data) ? dbRes.data : [];
          setTemplates([...engagementTemplates, ...dbTemplates]);
        } catch {
          setTemplates(engagementTemplates);
        }
      } else {
        setTemplates([]);
      }
    } catch (e) {
      console.error('Failed to fetch templates', e);
      setTemplates([]);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await adminApi.get(`/admin/notification-history`);
      setHistory(res.data || []);
    } catch (e) {
      console.error('Failed to fetch history', e);
      setHistory([]);
    }
  };

  const fetchScheduled = async () => {
    try {
      const res = await adminApi.get(`/admin/scheduled-notifications`);
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
      fetchTemplates(),
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
      const res = await adminApi.post(`/admin/onesignal/send`, {
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
      console.error('Push send error:', e);
      toast.error(e.response?.data?.detail || 'Notification send failed');
    } finally {
      setSending(false);
    }
  };

  // Test OneSignal
  const handleTestOneSignal = async () => {
    setSending(true);
    try {
      const res = await adminApi.post(`/admin/onesignal/test`);
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

  // Schedule notification
  const handleSchedule = async () => {
    if (!title || !body || !scheduleDate || !scheduleTime) {
      toast.error('Sab fields required hai');
      return;
    }

    const scheduleDateTime = `${scheduleDate}T${scheduleTime}:00`;

    try {
      const res = await adminApi.post(`/admin/schedule-notification`, {
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
      await adminApi.delete(`/admin/scheduled-notification/${id}`);
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

  // Template CRUD
  const handleCreateTemplate = async () => {
    if (!newTemplateTitle || !newTemplateBody) {
      toast.error('Title aur Body required hai');
      return;
    }

    try {
      const res = await adminApi.post(`/admin/notification-templates`, {
        title: newTemplateTitle,
        body: newTemplateBody,
        category: newTemplateCategory
      });
      
      if (res.data.success) {
        toast.success('✅ Template created!');
        setShowTemplateModal(false);
        setNewTemplateTitle('');
        setNewTemplateBody('');
        setNewTemplateCategory('custom');
        fetchTemplates();
      }
    } catch (e) {
      toast.error('Template create failed');
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !newTemplateTitle || !newTemplateBody) {
      toast.error('Title aur Body required hai');
      return;
    }

    try {
      const res = await adminApi.put(`/admin/notification-templates/${editingTemplate.id}`, {
        title: newTemplateTitle,
        body: newTemplateBody,
        category: newTemplateCategory
      });
      
      if (res.data.success) {
        toast.success('✅ Template updated!');
        setShowTemplateModal(false);
        setEditingTemplate(null);
        setNewTemplateTitle('');
        setNewTemplateBody('');
        fetchTemplates();
      }
    } catch (e) {
      toast.error('Template update failed');
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!window.confirm('Delete this template?')) return;
    
    try {
      await adminApi.delete(`/admin/notification-templates/${templateId}`);
      toast.success('Template deleted');
      fetchTemplates();
    } catch (e) {
      toast.error('Delete failed');
    }
  };

  const openEditModal = (template) => {
    setEditingTemplate(template);
    setNewTemplateTitle(template.title);
    setNewTemplateBody(template.body);
    setNewTemplateCategory(template.category || 'custom');
    setShowTemplateModal(true);
  };

  // Filter templates by category
  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  // Get unique categories
  const categories = ['all', ...new Set(templates.map(t => t.category).filter(Boolean))];

  const sendTestPush = async () => {
    try { const { data } = await adminApi.post('/admin/test-push'); toast.success(data.message); }
    catch (e) { toast.error(e.response?.data?.detail || 'Test push fail'); }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <Button onClick={sendTestPush} className="mb-4 bg-pink-500" data-testid="admin-test-push-btn">
        <Bell className="w-4 h-4 mr-2" /> Test notification bhejo
      </Button>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-pink-100 to-orange-100 rounded-full">
            <Bell className="w-6 h-6 text-pink-500" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">Push Notifications</h2>
            <p className="text-sm text-gray-500">FCM Push Notifications</p>
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
                    FCM Push Ready! ✅
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
                    FCM Not Configured
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
      <div className="flex gap-2 mb-6 border-b border-gray-200 overflow-x-auto pb-2">
        <button
          onClick={() => setActiveTab('send')}
          className={`px-4 py-2 font-medium whitespace-nowrap rounded-lg transition ${activeTab === 'send' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Send className="w-4 h-4 inline mr-2" />
          Send Now
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={`px-4 py-2 font-medium whitespace-nowrap rounded-lg transition ${activeTab === 'templates' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          Templates
          <span className="ml-2 px-2 py-0.5 bg-white/20 rounded-full text-xs">
            {templates.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('schedule')}
          className={`px-4 py-2 font-medium whitespace-nowrap rounded-lg transition ${activeTab === 'schedule' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Clock className="w-4 h-4 inline mr-2" />
          Schedule
          {scheduled.length > 0 && (
            <span className="ml-2 px-2 py-0.5 bg-blue-500 text-white rounded-full text-xs">
              {scheduled.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium whitespace-nowrap rounded-lg transition ${activeTab === 'history' 
            ? 'bg-pink-500 text-white' 
            : 'text-gray-500 hover:bg-gray-100'}`}
        >
          <Calendar className="w-4 h-4 inline mr-2" />
          History
        </button>
      </div>

      {/* Send Now Tab */}
      {activeTab === 'send' && (
        <div className="space-y-4">
          {/* Quick Templates */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Quick Templates</label>
            <div className="flex flex-wrap gap-2">
              {templates.slice(0, 6).map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="px-3 py-1.5 text-sm bg-gradient-to-r from-gray-50 to-gray-100 hover:from-pink-50 hover:to-orange-50 border border-gray-200 rounded-full transition flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {t.title.substring(0, 20)}...
                </button>
              ))}
              <button
                onClick={() => setActiveTab('templates')}
                className="px-3 py-1.5 text-sm text-pink-600 hover:bg-pink-50 rounded-full transition"
              >
                View all →
              </button>
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

          {/* Send Button */}
          <Button
            onClick={handleSendViaOneSignal}
            disabled={loading || !title || !body}
            className="w-full bg-gradient-to-r from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600"
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

      {/* Templates Tab */}
      {activeTab === 'templates' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2 overflow-x-auto pb-2">
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1 text-sm rounded-full whitespace-nowrap transition ${
                    selectedCategory === cat 
                      ? 'bg-pink-500 text-white' 
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {cat === 'all' ? 'All' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
            </div>
            <Button 
              size="sm" 
              onClick={() => {
                setEditingTemplate(null);
                setNewTemplateTitle('');
                setNewTemplateBody('');
                setNewTemplateCategory('custom');
                setShowTemplateModal(true);
              }}
              className="bg-pink-500 hover:bg-pink-600"
            >
              <Plus className="w-4 h-4 mr-1" />
              New Template
            </Button>
          </div>

          {/* Templates Grid */}
          <div className="grid gap-3 md:grid-cols-2">
            {filteredTemplates.map(template => (
              <div 
                key={template.id}
                className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition group"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">{template.title}</h4>
                    <p className="text-sm text-gray-600 mt-1">{template.body}</p>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                    <button
                      onClick={() => applyTemplate(template)}
                      className="p-1.5 hover:bg-pink-100 rounded text-pink-600"
                      title="Use template"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    {template.is_custom && (
                      <>
                        <button
                          onClick={() => openEditModal(template)}
                          className="p-1.5 hover:bg-blue-100 rounded text-blue-600"
                          title="Edit"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-1.5 hover:bg-red-100 rounded text-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${categoryColors[template.category] || categoryColors.custom}`}>
                    {template.category || 'custom'}
                  </span>
                  {template.is_custom && (
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs">
                      Custom
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredTemplates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No templates in this category</p>
            </div>
          )}
        </div>
      )}

      {/* Schedule Tab */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          {/* Quick Templates for Schedule */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Template</label>
            <div className="flex flex-wrap gap-2">
              {templates.slice(0, 4).map(t => (
                <button
                  key={t.id}
                  onClick={() => applyTemplate(t)}
                  className="px-3 py-1.5 text-sm bg-gray-100 hover:bg-pink-100 rounded-full transition"
                >
                  {t.title.substring(0, 25)}...
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
                min={new Date().toISOString().split('T')[0]}
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
            disabled={!title || !body || !scheduleDate || !scheduleTime}
          >
            <Clock className="w-4 h-4 mr-2" />
            Schedule Notification
          </Button>

          {/* Scheduled List */}
          {scheduled.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-700 mb-3 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-500" />
                Pending Scheduled ({scheduled.length})
              </h3>
              <div className="space-y-2">
                {scheduled.map(n => (
                  <div key={n.id} className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg">
                    <div>
                      <p className="font-medium text-sm">{n.title}</p>
                      <p className="text-xs text-gray-500">
                        📅 {new Date(n.schedule_time).toLocaleString()} • 👥 {n.target}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleCancelScheduled(n.id)}
                      className="text-red-500 hover:bg-red-100"
                    >
                      <Trash2 className="w-4 h-4" />
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
                    {h.provider || h.type || 'onesignal'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {editingTemplate ? 'Edit Template' : 'Create Template'}
              </h3>
              <button onClick={() => setShowTemplateModal(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                <Input
                  value={newTemplateTitle}
                  onChange={(e) => setNewTemplateTitle(e.target.value)}
                  placeholder="💕 Template title..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Message</label>
                <textarea
                  value={newTemplateBody}
                  onChange={(e) => setNewTemplateBody(e.target.value)}
                  placeholder="Template message..."
                  className="w-full p-3 border border-gray-300 rounded-lg resize-none"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={newTemplateCategory}
                  onChange={(e) => setNewTemplateCategory(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-lg"
                >
                  <option value="daily">Daily</option>
                  <option value="engagement">Engagement</option>
                  <option value="re-engagement">Re-engagement</option>
                  <option value="promotion">Promotion</option>
                  <option value="announcement">Announcement</option>
                  <option value="safety">Safety</option>
                  <option value="urgency">Urgency</option>
                  <option value="monetization">Monetization</option>
                  <option value="custom">Custom</option>
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => setShowTemplateModal(false)}
                >
                  Cancel
                </Button>
                <Button 
                  className="flex-1 bg-pink-500 hover:bg-pink-600"
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                >
                  {editingTemplate ? 'Update' : 'Create'}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationManager;
