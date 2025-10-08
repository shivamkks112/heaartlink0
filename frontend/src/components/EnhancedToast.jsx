import React from 'react';
import { toast } from 'sonner';
import { Heart, CheckCircle, AlertCircle, Info, X, Sparkles } from 'lucide-react';

export const showMatchToast = (compatibilityScore, userName = '') => {
  toast.custom((t) => (
    <div className="bg-gradient-to-r from-pink-500 to-orange-500 text-white p-4 rounded-2xl shadow-2xl animate-bounce-in max-w-md">
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          <Heart className="w-8 h-8 animate-heart-beat" fill="white" />
        </div>
        <div className="flex-1">
          <h3 className="font-bold text-lg">It's a Match! 🎉</h3>
          <p className="text-pink-100">
            {compatibilityScore ? `${compatibilityScore}% Compatible` : 'Great compatibility!'} 
            {userName && ` with ${userName}`}
          </p>
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="flex-shrink-0 p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ), {
    duration: 5000,
  });
};

export const showSuperLikeToast = () => {
  toast.custom((t) => (
    <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-4 rounded-2xl shadow-2xl animate-bounce-in">
      <div className="flex items-center gap-3">
        <Sparkles className="w-6 h-6 animate-pulse" />
        <div>
          <h3 className="font-bold">Super Like Sent! ⭐</h3>
          <p className="text-blue-100 text-sm">They'll know you're really interested</p>
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="ml-auto p-1 hover:bg-white/20 rounded-full transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  ), {
    duration: 3000,
  });
};

export const showSuccessToast = (message, subtitle = '') => {
  toast.custom((t) => (
    <div className="bg-white border border-green-200 p-4 rounded-2xl shadow-xl animate-slide-in-up">
      <div className="flex items-center gap-3">
        <CheckCircle className="w-6 h-6 text-green-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{message}</h3>
          {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  ), {
    duration: 4000,
  });
};

export const showErrorToast = (message, subtitle = '') => {
  toast.custom((t) => (
    <div className="bg-white border border-red-200 p-4 rounded-2xl shadow-xl animate-slide-in-up">
      <div className="flex items-center gap-3">
        <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{message}</h3>
          {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  ), {
    duration: 4000,
  });
};

export const showInfoToast = (message, subtitle = '') => {
  toast.custom((t) => (
    <div className="bg-white border border-blue-200 p-4 rounded-2xl shadow-xl animate-slide-in-up">
      <div className="flex items-center gap-3">
        <Info className="w-6 h-6 text-blue-500 flex-shrink-0" />
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">{message}</h3>
          {subtitle && <p className="text-gray-600 text-sm">{subtitle}</p>}
        </div>
        <button 
          onClick={() => toast.dismiss(t)}
          className="flex-shrink-0 p-1 hover:bg-gray-100 rounded-full transition-colors"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      </div>
    </div>
  ), {
    duration: 4000,
  });
};

export const showUploadProgressToast = (progress, fileName = 'File') => {
  toast.custom((t) => (
    <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-xl">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-pink-500 border-t-transparent rounded-full animate-spin flex-shrink-0"></div>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">Uploading {fileName}...</h3>
          <div className="mt-2 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-pink-500 to-orange-500 h-2 rounded-full transition-all duration-300"
              style={{width: `${progress}%`}}
            ></div>
          </div>
          <p className="text-gray-600 text-sm mt-1">{progress}% complete</p>
        </div>
      </div>
    </div>
  ), {
    duration: Infinity,
    id: 'upload-progress'
  });
};

export default {
  showMatchToast,
  showSuperLikeToast,
  showSuccessToast,
  showErrorToast,
  showInfoToast,
  showUploadProgressToast
};