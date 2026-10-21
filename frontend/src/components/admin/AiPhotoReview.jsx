import { useEffect, useRef, useState } from 'react';
import adminApi from '@/utils/adminApi';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Check, RefreshCw, Star, Trash2 } from 'lucide-react';

const ver = (url) => (url && url.includes('v=') ? url.split('v=')[1].split('&')[0] : url);
const thumb = (url) => (url && url.includes('/api/photo/') ? url.replace(/&w=\d+/, '') + '&w=300' : url);

const PhotoTile = ({ profile, url, index, busy, onAction }) => {
  const isMain = Boolean(profile.profile_picture) && ver(profile.profile_picture) === ver(url);
  return (
    <div className="relative group rounded-xl overflow-hidden bg-gray-100 aspect-[3/4]" data-testid={`ai-photo-${profile.id}-${index}`}>
      <img src={thumb(url)} alt="" className={`w-full h-full object-cover ${busy ? 'opacity-40' : ''}`} loading="lazy" />
      {isMain && <span className="absolute top-1 left-1 text-[10px] font-bold bg-pink-500 text-white px-1.5 py-0.5 rounded">MAIN</span>}
      {busy && <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold text-gray-700"><RefreshCw className="w-4 h-4 animate-spin mr-1" /> Redo...</div>}
      {!busy && (
        <div className="absolute bottom-0 inset-x-0 flex justify-around bg-black/55 py-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button title="Redo" onClick={() => onAction('redo', index)} className="p-1 text-white" data-testid={`ai-photo-redo-${profile.id}-${index}`}><RefreshCw className="w-4 h-4" /></button>
          {!isMain && <button title="Set main" onClick={() => onAction('main', index)} className="p-1 text-white" data-testid={`ai-photo-main-${profile.id}-${index}`}><Star className="w-4 h-4" /></button>}
          <button title="Delete" onClick={() => onAction('delete', index)} className="p-1 text-white" data-testid={`ai-photo-delete-${profile.id}-${index}`}><Trash2 className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  );
};

const StoryToggle = ({ story, onChange }) => (
  <div className="flex flex-wrap items-center gap-3 bg-white rounded-2xl border border-gray-200 p-4" data-testid="ai-story-photos-settings">
    <div className="flex-1 min-w-[200px]">
      <p className="font-bold text-gray-900">Story-style photos</p>
      <p className="text-xs text-gray-500">AI girls har kuch din mein nayi casual photo daalengi (main photo ban jaati hai). Har 3 ghante max 3 girls.</p>
    </div>
    <label className="text-xs text-gray-600 flex items-center gap-1">Every
      <select value={story.every_days} onChange={e => onChange({ ...story, every_days: Number(e.target.value) })} className="h-8 rounded-md border border-gray-200 px-1" data-testid="ai-story-every-days">
        {[2, 3, 4, 5, 7, 10, 14].map(d => <option key={d} value={d}>{d}</option>)}
      </select> days
    </label>
    <Switch checked={story.enabled} onCheckedChange={v => onChange({ ...story, enabled: v })} data-testid="ai-story-toggle" />
  </div>
);

export const AiPhotoReview = () => {
  const [data, setData] = useState(null);
  const [pendingOnly, setPendingOnly] = useState(false);
  const timer = useRef(null);

  const load = () => adminApi.get(`/admin/ai-photos?pending_only=${pendingOnly}`).then(r => {
    setData(r.data);
    clearTimeout(timer.current);
    if (r.data.profiles.some(p => p.busy?.length)) timer.current = setTimeout(load, 8000);
  }).catch(() => toast.error('Photos load nahi hui'));
  useEffect(() => { load(); return () => clearTimeout(timer.current); }, [pendingOnly]); // eslint-disable-line

  const act = async (profile, action, index) => {
    try {
      if (action === 'redo') await adminApi.post(`/admin/ai-photos/${profile.id}/${index}/redo`);
      if (action === 'main') await adminApi.post(`/admin/ai-photos/${profile.id}/${index}/main`);
      if (action === 'delete') {
        if (!window.confirm('Ye photo delete karein?')) return;
        await adminApi.delete(`/admin/ai-photos/${profile.id}/${index}`);
      }
      if (action === 'approve') await adminApi.post(`/admin/ai-photos/${profile.id}/approve`);
      toast.success(action === 'redo' ? 'Nayi photo ban rahi hai (~30 sec)' : 'Done');
      setTimeout(load, action === 'redo' ? 1500 : 0);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed');
    }
  };

  const saveStory = async (story) => {
    try {
      const r = await adminApi.put('/admin/ai-story-photos', story);
      setData(d => ({ ...d, story: r.data }));
      toast.success(r.data.enabled ? `Story photos ON — har ${r.data.every_days} din` : 'Story photos OFF');
    } catch (e) { toast.error(e.response?.data?.detail || 'Save failed'); }
  };

  if (!data) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  return (
    <div className="space-y-5" data-testid="admin-ai-photos-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">AI Photo Review</h2>
          <p className="text-sm text-gray-500">{data.profiles.length} profiles — har photo ko Redo, Main ya Delete karo, phir Approve</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <Switch checked={pendingOnly} onCheckedChange={setPendingOnly} data-testid="ai-photos-pending-toggle" /> Sirf pending
        </label>
      </div>
      <StoryToggle story={data.story} onChange={saveStory} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.profiles.map(p => (
          <div key={p.id} className="bg-white rounded-2xl border border-gray-200 p-3" data-testid={`ai-photo-card-${p.id}`}>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-gray-900 text-sm">{p.name}{p.age ? `, ${p.age}` : ''}</p>
              {p.photos_approved
                ? <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><Check className="w-3.5 h-3.5" /> Approved</span>
                : <Button size="sm" onClick={() => act(p, 'approve')} className="h-7 bg-green-500 hover:bg-green-600 text-xs" data-testid={`ai-photo-approve-${p.id}`}>Approve</Button>}
            </div>
            <div className="grid grid-cols-3 gap-2">
              {(p.photos || []).map((url, i) => (
                <PhotoTile key={i} profile={p} url={url} index={i} busy={p.busy?.includes(i)} onAction={(a, idx) => act(p, a, idx)} />
              ))}
              {(p.photos || []).length < 5 && (
                <button onClick={() => act(p, 'redo', (p.photos || []).length)} className="aspect-[3/4] rounded-xl border-2 border-dashed border-gray-300 text-xs text-gray-500" data-testid={`ai-photo-add-${p.id}`}>
                  + Add photo
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AiPhotoReview;
