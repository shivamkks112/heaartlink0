import { useEffect, useState } from 'react';
import adminApi from '@/utils/adminApi';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { RotateCcw, Save, Send, Wand2 } from 'lucide-react';

const PERSONALITIES = ['flirty_fun', 'sweet_caring', 'witty_smart', 'neutral_real'];
const area = 'w-full rounded-lg border border-gray-200 bg-white p-3 text-sm font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-purple-300';
const sel = 'h-9 rounded-lg border border-gray-200 bg-white px-2 text-sm';

const PromptEditor = ({ data, onSaved }) => {
  const keys = Object.keys(data.labels);
  const [key, setKey] = useState(keys[0]);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const isCustom = Boolean(data.overrides[key]);

  useEffect(() => { setText(data.overrides[key] || data.defaults[key] || ''); }, [key, data]);

  const save = async (value) => {
    setSaving(true);
    try {
      await adminApi.put('/admin/ai-prompts', { prompts: { [key]: value } });
      toast.success(value ? 'Prompt saved — 1 min mein live' : 'Default restore ho gaya');
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3" data-testid="ai-prompt-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-gray-900">Chat style & rules</h3>
        <div className="flex items-center gap-2">
          <select value={key} onChange={e => setKey(e.target.value)} className={sel} data-testid="ai-prompt-key-select">
            {keys.map(k => <option key={k} value={k}>{data.labels[k]}{data.overrides[k] ? ' (custom)' : ''}</option>)}
          </select>
          <span className={`text-xs px-2 py-1 rounded-full ${isCustom ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`} data-testid="ai-prompt-status">
            {isCustom ? 'Custom' : 'Default'}
          </span>
        </div>
      </div>
      {data.placeholders[key] && (
        <p className="text-xs text-gray-500">
          Placeholders: {data.placeholders[key].map(p => <code key={p} className="mx-0.5 bg-gray-100 px-1 rounded">{`{${p}}`}</code>)}
        </p>
      )}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={16} className={area} data-testid="ai-prompt-textarea" />
      <div className="flex gap-2">
        <Button onClick={() => save(text)} disabled={saving} className="bg-purple-500 hover:bg-purple-600" data-testid="ai-prompt-save">
          <Save className="w-4 h-4 mr-1" /> Save
        </Button>
        <Button variant="outline" onClick={() => save('')} disabled={saving || !isCustom} data-testid="ai-prompt-reset">
          <RotateCcw className="w-4 h-4 mr-1" /> Reset to default
        </Button>
      </div>
    </div>
  );
};

const PersonaEditor = ({ personas, onSaved }) => {
  const [id, setId] = useState(personas[0]?.id || '');
  const p = personas.find(x => x.id === id) || {};
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('hi kya kar rhi ho');
  const [reply, setReply] = useState('');
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => { if (!id && personas[0]?.id) setId(personas[0].id); }, [personas, id]);

  useEffect(() => {
    setForm({ ai_personality: p.ai_personality || 'sweet_caring', persona_context: p.persona_context || '', bio: p.bio || '' });
    setReply('');
  }, [id, personas]); // eslint-disable-line

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.put(`/admin/ai-personas/${id}`, form);
      toast.success(`${p.name} updated`);
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setPreviewing(true);
    setReply('');
    try {
      const r = await adminApi.post('/admin/ai-prompts/preview', { profile_id: id, message: msg });
      setReply(r.data.reply);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Preview failed');
    } finally {
      setPreviewing(false);
    }
  };

  if (!personas.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-3" data-testid="ai-persona-editor">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-bold text-gray-900">Persona context</h3>
        <select value={id} onChange={e => setId(e.target.value)} className={sel} data-testid="ai-persona-select">
          {personas.map(x => <option key={x.id} value={x.id}>{x.name}{x.is_active_ai === false ? ' (inactive)' : ''}</option>)}
        </select>
      </div>
      <label className="block text-xs font-semibold text-gray-600">Personality
        <select value={form.ai_personality || ''} onChange={e => setForm(f => ({ ...f, ai_personality: e.target.value }))} className={`${sel} w-full mt-1`} data-testid="ai-persona-personality">
          {PERSONALITIES.map(k => <option key={k} value={k}>{k.replace('_', ' ')}</option>)}
        </select>
      </label>
      <label className="block text-xs font-semibold text-gray-600">Bio
        <textarea value={form.bio || ''} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} rows={2} maxLength={500} className={`${area} mt-1 font-sans`} data-testid="ai-persona-bio" />
      </label>
      <label className="block text-xs font-semibold text-gray-600">Extra context (sirf is persona ke liye)
        <textarea value={form.persona_context || ''} onChange={e => setForm(f => ({ ...f, persona_context: e.target.value }))} rows={5} maxLength={4000}
          placeholder="jaise: B.Com final year, Indore mein PG mein rehti hai, chai lover, kabhi kabhi Marathi words bolti hai"
          className={`${area} mt-1 font-sans`} data-testid="ai-persona-context" />
      </label>
      <Button onClick={save} disabled={saving} className="bg-purple-500 hover:bg-purple-600" data-testid="ai-persona-save">
        <Save className="w-4 h-4 mr-1" /> Save persona
      </Button>
      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-semibold text-gray-600 flex items-center gap-1"><Wand2 className="w-3.5 h-3.5" /> Test reply (save karne ke baad)</p>
        <div className="flex gap-2">
          <input value={msg} onChange={e => setMsg(e.target.value)} className={`${sel} flex-1`} data-testid="ai-preview-input" />
          <Button onClick={preview} disabled={previewing} variant="outline" data-testid="ai-preview-btn">
            <Send className="w-4 h-4 mr-1" /> {previewing ? '...' : 'Try'}
          </Button>
        </div>
        {reply && <div className="rounded-xl bg-gray-100 px-3 py-2 text-sm w-fit max-w-full" data-testid="ai-preview-reply">{reply}</div>}
      </div>
    </div>
  );
};

export const AiStyleEditor = () => {
  const [data, setData] = useState(null);
  const [personas, setPersonas] = useState([]);

  const loadPrompts = () => adminApi.get('/admin/ai-prompts').then(r => setData(r.data)).catch(() => toast.error('Prompts load nahi hue'));
  const loadPersonas = () => adminApi.get('/admin/ai-personas').then(r => setPersonas(r.data)).catch(() => {});
  useEffect(() => { loadPrompts(); loadPersonas(); }, []);

  if (!data) return <div className="text-center py-10 text-gray-500">Loading...</div>;
  return (
    <div className="space-y-6" data-testid="admin-ai-style-panel">
      <div>
        <h2 className="text-xl font-bold text-gray-900">AI Chat Style</h2>
        <p className="text-sm text-gray-500 mt-1">AI personas aur auto-chat accounts ka style, rules aur context yahan se badlo. Changes ~1 min mein live.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PromptEditor data={data} onSaved={loadPrompts} />
        <PersonaEditor personas={personas} onSaved={loadPersonas} />
      </div>
    </div>
  );
};

export default AiStyleEditor;
