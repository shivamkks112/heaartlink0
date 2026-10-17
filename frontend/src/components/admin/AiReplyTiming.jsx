import { useEffect, useState } from 'react';
import adminApi from '@/utils/adminApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

const SLOTS = [
  { key: 'night', label: 'Night', time: '11 PM – 7 AM' },
  { key: 'morning', label: 'Morning', time: '7 AM – 10 AM' },
  { key: 'day', label: 'Day', time: '10 AM – 7 PM' },
  { key: 'evening', label: 'Evening', time: '7 PM – 11 PM' },
];

export const AiReplyTiming = () => {
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    adminApi.get('/admin/ai-reply-timing').then(r => setCfg(r.data)).catch(() => toast.error('Reply timing load nahi hua'));
  }, []);

  const setVal = (slot, field, value) =>
    setCfg(c => ({ ...c, slots: { ...c.slots, [slot]: { ...c.slots[slot], [field]: value } } }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await adminApi.put('/admin/ai-reply-timing', cfg);
      setCfg(r.data);
      toast.success('AI reply timing saved');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!cfg) return null;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4" data-testid="ai-reply-timing-section">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-500" />
          <div>
            <h3 className="font-bold text-gray-900">AI Reply Timing</h3>
            <p className="text-xs text-gray-500">AI personas aur auto-chat accounts kitne minute mein reply karein (IST)</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-600">{cfg.enabled ? 'Custom' : 'Default'}</span>
          <Switch checked={cfg.enabled} onCheckedChange={v => setCfg(c => ({ ...c, enabled: v }))} data-testid="ai-reply-timing-toggle" />
        </div>
      </div>
      <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${cfg.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
        {SLOTS.map(s => (
          <div key={s.key} className="rounded-xl bg-gray-50 p-3" data-testid={`ai-reply-slot-${s.key}`}>
            <p className="text-sm font-semibold text-gray-800">{s.label} <span className="text-xs font-normal text-gray-500">{s.time}</span></p>
            <div className="flex items-center gap-2 mt-2">
              <Input type="number" step="0.5" min="0.1" max="180" value={cfg.slots[s.key].min}
                onChange={e => setVal(s.key, 'min', e.target.value)} className="h-9" data-testid={`ai-reply-${s.key}-min`} />
              <span className="text-xs text-gray-500">to</span>
              <Input type="number" step="0.5" min="0.1" max="180" value={cfg.slots[s.key].max}
                onChange={e => setVal(s.key, 'max', e.target.value)} className="h-9" data-testid={`ai-reply-${s.key}-max`} />
              <span className="text-xs text-gray-500">min</span>
            </div>
          </div>
        ))}
      </div>
      <Button onClick={save} disabled={saving} className="bg-purple-500 hover:bg-purple-600" data-testid="ai-reply-timing-save">
        {saving ? 'Saving...' : 'Save Timing'}
      </Button>
    </div>
  );
};

export default AiReplyTiming;
