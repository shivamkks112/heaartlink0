import { Heart } from 'lucide-react';

const TopBar = () => {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9998]"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        background: 'rgba(255,251,255,0.88)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid rgba(214,194,197,0.3)',
      }}
    >
      <div className="h-14 flex items-center justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#D6336C] to-[#E8590C] flex items-center justify-center shadow-sm">
            <Heart className="w-4 h-4 text-white" fill="white" />
          </div>
          <span className="text-[#1F1A1C] font-bold text-lg tracking-tight">HeartLink</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
