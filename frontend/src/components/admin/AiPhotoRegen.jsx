import { useEffect, useRef, useState } from 'react';
import adminApi from '@/utils/adminApi';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ImagePlus } from 'lucide-react';

export const AiPhotoRegen = () => {
  const [status, setStatus] = useState(null);
  const timer = useRef(null);

  const poll = () => adminApi.get('/admin/ai-profiles/regenerate-photos/status').then(r => {
    setStatus(r.data);
    clearTimeout(timer.current);
    if (r.data.running) timer.current = setTimeout(poll, 8000);
  }).catch(() => {});

  useEffect(() => { poll(); return () => clearTimeout(timer.current); }, []); // eslint-disable-line

  const start = async () => {
    if (!window.confirm('Saari AI girls ki photos naye natural style mein replace hongi (har profile 2 photos). Ye Universal Key balance use karega. Continue?')) return;
    try {
      const r = await adminApi.post('/admin/ai-profiles/regenerate-photos', { photos_per_profile: 2 });
      toast.success(r.data.started ? 'Photo regeneration shuru ho gaya' : 'Pehle se chal raha hai');
      setTimeout(poll, 1500);
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Start nahi hua');
    }
  };

  const running = status?.running;
  return (
    <div className="flex items-center gap-3" data-testid="ai-photo-regen">
      <Button onClick={start} disabled={running} variant="outline" data-testid="ai-photo-regen-btn">
        <ImagePlus className="w-4 h-4 mr-2" /> {running ? 'Regenerating...' : 'Natural Photos'}
      </Button>
      {running && <span className="text-xs text-gray-600" data-testid="ai-photo-regen-progress">{status.done}/{status.total} profiles</span>}
    </div>
  );
};

export default AiPhotoRegen;
