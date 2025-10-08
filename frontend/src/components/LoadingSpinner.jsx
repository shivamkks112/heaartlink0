import React from 'react';
import { Heart } from 'lucide-react';

export const PulseLoader = () => {
  return (
    <div className="flex items-center justify-center">
      <div className="flex space-x-2">
        <div className="w-3 h-3 bg-pink-500 rounded-full animate-pulse" style={{animationDelay: '0s'}}></div>
        <div className="w-3 h-3 bg-rose-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
        <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
      </div>
    </div>
  );
};

export const HeartLoader = ({ size = "large", message = "Loading..." }) => {
  const sizeClasses = {
    small: "w-8 h-8",
    medium: "w-12 h-12", 
    large: "w-16 h-16"
  };

  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4">
        <Heart 
          className={`${sizeClasses[size]} text-pink-500 animate-heart-beat`} 
          fill="currentColor" 
        />
        <div className="absolute inset-0 rounded-full bg-pink-500 opacity-20 animate-ping"></div>
      </div>
      <p className="text-gray-600 font-medium animate-pulse">{message}</p>
    </div>
  );
};

export const SpinnerWithGradient = ({ message = "Loading..." }) => {
  return (
    <div className="flex flex-col items-center justify-center">
      <div className="relative mb-4">
        <div className="w-12 h-12 border-4 border-transparent rounded-full animate-spin">
          <div className="absolute inset-0 border-4 border-gradient-to-r from-pink-500 to-orange-500 rounded-full border-t-transparent"></div>
        </div>
        <div className="absolute inset-2 bg-gradient-to-r from-pink-500 to-orange-500 rounded-full opacity-20 animate-pulse"></div>
      </div>
      <p className="text-gray-600 font-medium">{message}</p>
    </div>
  );
};

export const DotsLoader = ({ color = "pink" }) => {
  const colorClasses = {
    pink: "bg-pink-500",
    orange: "bg-orange-500",
    blue: "bg-blue-500",
    green: "bg-green-500"
  };

  return (
    <div className="flex space-x-2">
      <div className={`w-2 h-2 ${colorClasses[color]} rounded-full animate-bounce`} style={{animationDelay: '0s'}}></div>
      <div className={`w-2 h-2 ${colorClasses[color]} rounded-full animate-bounce`} style={{animationDelay: '0.1s'}}></div>
      <div className={`w-2 h-2 ${colorClasses[color]} rounded-full animate-bounce`} style={{animationDelay: '0.2s'}}></div>
    </div>
  );
};

export default {
  PulseLoader,
  HeartLoader,
  SpinnerWithGradient,
  DotsLoader
};