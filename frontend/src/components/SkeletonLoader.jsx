import React from 'react';

export const ProfileCardSkeleton = () => {
  return (
    <div className="bg-white rounded-3xl shadow-elevated overflow-hidden animate-pulse">
      {/* Photo skeleton */}
      <div className="h-96 bg-gradient-to-br from-gray-200 to-gray-300 animate-shimmer"></div>
      
      {/* Content skeleton */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-8 bg-gray-200 rounded-lg w-48 animate-shimmer"></div>
        </div>
        
        <div className="flex items-center gap-2 mb-4">
          <div className="h-4 w-4 bg-gray-200 rounded animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-32 animate-shimmer"></div>
        </div>

        <div className="space-y-2 mb-4">
          <div className="h-4 bg-gray-200 rounded w-full animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-3/4 animate-shimmer"></div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="h-8 bg-gray-200 rounded-full w-20 animate-shimmer"></div>
          <div className="h-8 bg-gray-200 rounded-full w-24 animate-shimmer"></div>
          <div className="h-8 bg-gray-200 rounded-full w-16 animate-shimmer"></div>
        </div>
      </div>

      {/* Action buttons skeleton */}
      <div className="p-6 flex justify-center items-center gap-8">
        <div className="w-16 h-16 bg-gray-200 rounded-full animate-shimmer"></div>
        <div className="w-16 h-16 bg-gray-200 rounded-full animate-shimmer"></div>
        <div className="w-20 h-20 bg-gray-200 rounded-full animate-shimmer"></div>
      </div>
    </div>
  );
};

export const MatchCardSkeleton = () => {
  return (
    <div className="bg-white rounded-2xl shadow-soft overflow-hidden animate-pulse">
      <div className="h-64 bg-gradient-to-br from-gray-200 to-gray-300 animate-shimmer"></div>
      <div className="p-5">
        <div className="h-6 bg-gray-200 rounded w-3/4 mb-2 animate-shimmer"></div>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-gray-200 rounded animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-24 animate-shimmer"></div>
        </div>
        <div className="h-4 bg-gray-200 rounded w-full mb-2 animate-shimmer"></div>
        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4 animate-shimmer"></div>
        <div className="h-12 bg-gray-200 rounded-xl w-full animate-shimmer"></div>
      </div>
    </div>
  );
};

export const ProfileSkeleton = () => {
  return (
    <div className="bg-white rounded-3xl shadow-2xl overflow-hidden animate-pulse">
      {/* Header skeleton */}
      <div className="bg-gradient-to-r from-gray-200 to-gray-300 px-8 py-12 text-center relative animate-shimmer">
        <div className="w-32 h-32 mx-auto bg-white rounded-full mb-4 animate-shimmer"></div>
        <div className="h-8 bg-white/50 rounded w-48 mx-auto mb-2 animate-shimmer"></div>
        <div className="h-6 bg-white/30 rounded w-32 mx-auto animate-shimmer"></div>
      </div>

      {/* Content skeleton */}
      <div className="p-8 space-y-6">
        <div>
          <div className="h-6 bg-gray-200 rounded w-16 mb-2 animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-full animate-shimmer"></div>
        </div>
        <div>
          <div className="h-6 bg-gray-200 rounded w-20 mb-2 animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-32 animate-shimmer"></div>
        </div>
        <div>
          <div className="h-6 bg-gray-200 rounded w-24 mb-2 animate-shimmer"></div>
          <div className="h-4 bg-gray-200 rounded w-40 animate-shimmer"></div>
        </div>
        <div>
          <div className="h-6 bg-gray-200 rounded w-20 mb-3 animate-shimmer"></div>
          <div className="flex flex-wrap gap-2">
            <div className="h-8 bg-gray-200 rounded-full w-20 animate-shimmer"></div>
            <div className="h-8 bg-gray-200 rounded-full w-24 animate-shimmer"></div>
            <div className="h-8 bg-gray-200 rounded-full w-16 animate-shimmer"></div>
          </div>
        </div>
        <div className="h-12 bg-gray-200 rounded-xl w-full animate-shimmer"></div>
      </div>
    </div>
  );
};

export default {
  ProfileCardSkeleton,
  MatchCardSkeleton,
  ProfileSkeleton
};