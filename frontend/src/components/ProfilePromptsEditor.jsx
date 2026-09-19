import { useState, useEffect } from 'react';
import axios from 'axios';
import { MessageCircle, Plus, X, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { API } from '@/config/api';

const ProfilePromptsEditor = ({ userId, existingPrompts }) => {
  const [prompts, setPrompts] = useState(existingPrompts || []);
  const [questions, setQuestions] = useState([]);
  const [editing, setEditing] = useState(false);
  const [selectedQ, setSelectedQ] = useState('');
  const [answer, setAnswer] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios.get(`${API}/profile-prompts/questions`).then(r => setQuestions(r.data.questions || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (existingPrompts) setPrompts(existingPrompts);
  }, [existingPrompts]);

  const addPrompt = async () => {
    if (!selectedQ || !answer.trim()) { toast.error('Question aur answer dono fill karo'); return; }
    if (prompts.length >= 3) { toast.error('Maximum 3 prompts allowed'); return; }

    const updated = [...prompts, { question: selectedQ, answer: answer.trim() }];
    setSaving(true);
    try {
      await axios.post(`${API}/profile-prompts/${userId}`, { prompts: updated });
      setPrompts(updated);
      setSelectedQ('');
      setAnswer('');
      setEditing(false);
      toast.success('Prompt added!');
    } catch { toast.error('Save failed'); }
    setSaving(false);
  };

  const removePrompt = async (idx) => {
    const updated = prompts.filter((_, i) => i !== idx);
    try {
      await axios.post(`${API}/profile-prompts/${userId}`, { prompts: updated });
      setPrompts(updated);
      toast.success('Prompt removed');
    } catch { toast.error('Failed'); }
  };

  const unusedQuestions = questions.filter(q => !prompts.some(p => p.question === q));

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-4" data-testid="profile-prompts-editor">
      <div className="flex items-center gap-3 mb-3">
        <div className="bg-gradient-to-r from-blue-500 to-indigo-500 p-2.5 rounded-xl">
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div>
          <h4 className="font-bold text-gray-900">Conversation Starters</h4>
          <p className="text-xs text-gray-500">Help others start a chat with you ({prompts.length}/3)</p>
        </div>
      </div>

      {/* Existing Prompts */}
      {prompts.map((p, i) => (
        <div key={i} className="bg-white rounded-lg px-3 py-2.5 mb-2 relative group">
          <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wider">{p.question}</p>
          <p className="text-sm text-gray-800 mt-0.5">{p.answer}</p>
          <button
            onClick={() => removePrompt(i)}
            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-red-100 rounded-full p-1"
            data-testid={`remove-prompt-${i}`}
          >
            <X className="w-3 h-3 text-red-500" />
          </button>
        </div>
      ))}

      {/* Add New Prompt */}
      {prompts.length < 3 && !editing && (
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-blue-300 rounded-lg text-blue-500 text-sm font-medium hover:bg-blue-50 transition-colors mt-2"
          data-testid="add-prompt-btn"
        >
          <Plus className="w-4 h-4" /> Add Conversation Starter
        </button>
      )}

      {editing && (
        <div className="bg-white rounded-lg p-3 mt-2 space-y-2">
          <div className="relative">
            <select
              value={selectedQ}
              onChange={e => setSelectedQ(e.target.value)}
              className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 text-sm text-gray-700 appearance-none"
              data-testid="prompt-question-select"
            >
              <option value="">Pick a question...</option>
              {unusedQuestions.map((q, i) => <option key={i} value={q}>{q}</option>)}
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Your answer..."
            maxLength={300}
            rows={2}
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none"
            data-testid="prompt-answer-input"
          />
          <div className="flex gap-2">
            <button
              onClick={addPrompt}
              disabled={saving || !selectedQ || !answer.trim()}
              className="flex-1 bg-blue-500 text-white rounded-lg py-2 text-sm font-semibold disabled:opacity-50"
              data-testid="save-prompt-btn"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setEditing(false); setSelectedQ(''); setAnswer(''); }}
              className="px-4 bg-gray-100 text-gray-600 rounded-lg py-2 text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfilePromptsEditor;
