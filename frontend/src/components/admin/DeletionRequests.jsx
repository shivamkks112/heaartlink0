import { useEffect, useState, useCallback } from 'react';
import adminApi from '@/utils/adminApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

export default function DeletionRequests() {
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(null);

  const load = useCallback(async () => {
    try { const { data } = await adminApi.get('/admin/deletion-requests'); setRows(data); }
    catch { toast.error('Requests load nahi hui'); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const remove = async (r) => {
    if (!window.confirm(`${r.email} ka account permanently delete karein? Ye wapas nahi hoga.`)) return;
    setBusy(r.id);
    try { await adminApi.post(`/admin/deletion-requests/${r.id}/complete`); toast.success('Account deleted'); load(); }
    catch (e) { toast.error(e.response?.data?.detail || 'Delete fail'); }
    finally { setBusy(null); }
  };

  return (
    <div className="bg-white rounded-2xl p-4 shadow" data-testid="deletion-requests-panel">
      <h2 className="text-lg font-bold mb-3">Account Delete Requests ({rows.filter(r => r.status !== 'completed').length} pending)</h2>
      {rows.length === 0 && <p className="text-sm text-gray-500">Koi request nahi</p>}
      <div className="space-y-2">
        {rows.map(r => (
          <div key={r.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border" data-testid={`deletion-row-${r.id}`}>
            <div className="min-w-0">
              <p className="font-semibold truncate">{r.user_name || '-'} · {r.email}</p>
              <p className="text-xs text-gray-500">{new Date(r.requested_at).toLocaleString('en-IN')} {r.reason ? `· ${r.reason}` : ''}</p>
            </div>
            {r.status === 'completed'
              ? <span className="text-xs font-semibold text-green-600">Deleted</span>
              : <Button size="sm" className="bg-red-600" disabled={busy === r.id} onClick={() => remove(r)} data-testid={`delete-account-btn-${r.id}`}>{busy === r.id ? '...' : 'Delete Account'}</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
