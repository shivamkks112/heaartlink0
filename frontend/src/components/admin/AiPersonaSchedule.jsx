import { useState } from 'react';
import adminApi from '@/utils/adminApi';
import { toast } from 'sonner';

const SPEEDS = {
  default: { label: 'Default', min: null, max: null },
  quick: { label: 'Quick (0.3–1 min)', min: 0.3, max: 1 },
  normal: { label: 'Normal (1–4 min)', min: 1, max: 4 },
  busy: { label: 'Busy (8–25 min)', min: 8, max: 25 },
  custom: { label: 'Custom' },
};
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const fmt = h => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`;

const detectSpeed = (min, max) => {
  if (min == null || max == null) return 'default';
  const hit = Object.entries(SPEEDS).find(([, v]) => v.min === min && v.max === max);
  return hit ? hit[0] : 'custom';
};

export const AiPersonaSchedule = ({ profile }) => {
  const [speed, setSpeed] = useState(detectSpeed(profile.reply_delay_min, profile.reply_delay_max));
  const [min, setMin] = useState(profile.reply_delay_min ?? 2);
  const [max, setMax] = useState(profile.reply_delay_max ?? 6);
  const [always, setAlways] = useState(!profile.online_hours);
  const [start, setStart] = useState(profile.online_hours?.start ?? 9);
  const [end, setEnd] = useState(profile.online_hours?.end ?? 23);
  const [saving, setSaving] = useState(false);
  const id = profile.id;

  const save = async () => {
    const preset = SPEEDS[speed];
    const body = {
      reply_delay_min: speed === 'custom' ? min : preset.min,
      reply_delay_max: speed === 'custom' ? max : preset.max,
      online_start: always ? null : start,
      online_end: always ? null : end,
    };
    setSaving(true);
    try {
      await adminApi.put(`/admin/ai-profiles/${id}/schedule`, body);
      toast.success(`${profile.name} schedule saved`);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const sel = 'h-8 rounded-md border border-gray-200 bg-white px-2 text-xs';
  return (
    <div className="mt-3 rounded-lg bg-gray-50 p-3 space-y-2 text-xs" data-testid={`ai-schedule-${id}`}>
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-700">Reply speed</span>
        <select value={speed} onChange={e => setSpeed(e.target.value)} className={sel} data-testid={`ai-speed-${id}`}>
          {Object.entries(SPEEDS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {speed === 'custom' && (
        <div className="flex items-center gap-1 justify-end">
          <input type="number" step="0.5" min="0.1" max="180" value={min} onChange={e => setMin(e.target.value)} className={`${sel} w-16`} data-testid={`ai-speed-min-${id}`} />
          <span>to</span>
          <input type="number" step="0.5" min="0.1" max="180" value={max} onChange={e => setMax(e.target.value)} className={`${sel} w-16`} data-testid={`ai-speed-max-${id}`} />
          <span>min</span>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-gray-700 flex items-center gap-1.5">
          Online hours
          <span className={`w-2 h-2 rounded-full ${profile.is_online ? 'bg-green-500' : 'bg-gray-400'}`} data-testid={`ai-online-dot-${id}`} />
          <span className="font-normal text-gray-500">{profile.is_online ? 'online now' : 'offline'}</span>
        </span>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={always} onChange={e => setAlways(e.target.checked)} data-testid={`ai-always-online-${id}`} />
          Always
        </label>
      </div>
      {!always && (
        <div className="flex items-center gap-1 justify-end">
          <select value={start} onChange={e => setStart(Number(e.target.value))} className={sel} data-testid={`ai-online-start-${id}`}>
            {HOURS.map(h => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
          <span>to</span>
          <select value={end} onChange={e => setEnd(Number(e.target.value))} className={sel} data-testid={`ai-online-end-${id}`}>
            {HOURS.map(h => <option key={h} value={h}>{fmt(h)}</option>)}
          </select>
        </div>
      )}
      {!always && start === end && <p className="text-amber-600 text-right">Same start & end = always online</p>}
      <button onClick={save} disabled={saving} className="w-full h-8 rounded-md bg-purple-500 text-white font-semibold hover:bg-purple-600 disabled:opacity-60" data-testid={`ai-schedule-save-${id}`}>
        {saving ? 'Saving...' : 'Save schedule'}
      </button>
    </div>
  );
};

export default AiPersonaSchedule;
