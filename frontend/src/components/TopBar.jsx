import React from 'react';
import { Heart } from 'lucide-react';

const TopBar = () => {
  return (
    <div 
      className="fixed top-0 left-0 right-0 z-[9998] bg-gradient-to-r from-pink-500 via-rose-500 to-orange-500 shadow-lg"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0)',
        minHeight: '60px'
      }}
    >
      <div className="h-16 flex items-center justify-center px-4">
        <div className="flex items-center gap-2">
          <div className="bg-white/20 backdrop-blur-sm p-2 rounded-xl">
            <Heart className="w-6 h-6 text-white" fill="white" />
          </div>
          <span className="text-white font-bold text-xl tracking-wide">HeartLink</span>
        </div>
      </div>
    </div>
  );
};

export default TopBar;
