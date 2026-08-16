import { useState, useRef, useEffect } from 'react';
import { Share2, Download, ArrowLeft, X, Heart } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const MatchShareCard = ({ user }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const matchData = location.state?.matchData;
  const canvasRef = useRef(null);
  const [cardReady, setCardReady] = useState(false);

  const myName = user?.name || 'You';
  const matchName = matchData?.name || 'Your Match';

  useEffect(() => {
    drawCard();
  }, []);

  const drawCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 1080;
    canvas.height = 1920;

    // Background gradient
    const grad = ctx.createLinearGradient(0, 0, 1080, 1920);
    grad.addColorStop(0, '#D6336C');
    grad.addColorStop(0.5, '#E8590C');
    grad.addColorStop(1, '#F59E0B');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1920);

    // Decorative circles
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath(); ctx.arc(200, 400, 300, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(880, 1400, 250, 0, Math.PI * 2); ctx.fill();

    // Heart icon
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.font = 'bold 200px serif';
    ctx.textAlign = 'center';
    ctx.fillText('♥', 540, 650);

    // "We Matched!" text
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 80px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('We Matched!', 540, 850);

    // Names
    ctx.font = '50px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(`${myName} & ${matchName}`, 540, 950);

    // Divider
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(340, 1020);
    ctx.lineTo(740, 1020);
    ctx.stroke();

    // HeartLink branding
    ctx.font = 'bold 60px system-ui, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('HeartLink', 540, 1150);

    ctx.font = '35px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText("India's #1 Safe Dating App", 540, 1210);

    // CTA
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.beginPath();
    ctx.roundRect(290, 1350, 500, 80, 40);
    ctx.fill();

    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 32px system-ui, sans-serif';
    ctx.fillText('Download Now on Play Store', 540, 1402);

    setCardReady(true);
  };

  const shareCard = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
      const file = new File([blob], 'heartlink-match.png', { type: 'image/png' });

      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: 'We Matched on HeartLink!',
          text: `${myName} & ${matchName} matched on HeartLink! Download now.`,
          files: [file],
        });
      } else {
        // Fallback: download
        downloadCard();
      }
    } catch (e) {
      downloadCard();
    }
  };

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'heartlink-match.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    toast.success('Card downloaded! Share it on Instagram Stories.');
  };

  const shareWhatsApp = () => {
    const msg = encodeURIComponent(
      `${myName} & ${matchName} matched on HeartLink! India ka safest dating app.\n\n` +
      `Download: https://play.google.com/store/apps/details?id=com.heartlink.app`
    );
    window.open(`https://wa.me/?text=${msg}`, '_blank');
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--m3-surface)' }}>
      <div className="sticky top-0 z-10 bg-white/80 dark:bg-gray-900/80 backdrop-blur-md border-b border-gray-100 dark:border-gray-800 px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold" style={{ color: 'var(--m3-on-surface)' }}>Share Your Match</h1>
      </div>

      <div className="max-w-sm mx-auto px-4 py-6 space-y-5">
        {/* Canvas Preview */}
        <div className="rounded-2xl overflow-hidden shadow-xl">
          <canvas
            ref={canvasRef}
            className="w-full"
            style={{ aspectRatio: '9/16', display: 'block' }}
            data-testid="match-share-canvas"
          />
        </div>

        {/* Share Buttons */}
        <div className="space-y-3">
          <Button
            onClick={shareCard}
            data-testid="share-story-btn"
            className="w-full bg-gradient-to-r from-purple-500 via-pink-500 to-orange-500 text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"
          >
            <Share2 className="w-5 h-5" /> Share to Instagram Story
          </Button>

          <Button
            onClick={shareWhatsApp}
            data-testid="share-whatsapp-match-btn"
            className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white rounded-xl py-3 font-bold flex items-center justify-center gap-2"
          >
            Share on WhatsApp
          </Button>

          <Button
            onClick={downloadCard}
            variant="outline"
            data-testid="download-card-btn"
            className="w-full rounded-xl py-3 font-bold flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" /> Download Card
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MatchShareCard;
