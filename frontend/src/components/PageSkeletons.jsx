import { Skeleton } from '@/components/ui/skeleton';

// Discover page skeleton — shows card placeholder
export const DiscoverSkeleton = () => (
  <div className="flex flex-col h-full" style={{ background: 'var(--m3-surface)', paddingTop: 'var(--safe-top, 20px)' }}>
    <div className="flex items-center justify-between px-4 py-3">
      <Skeleton className="h-7 w-28 rounded-lg" />
      <Skeleton className="h-9 w-9 rounded-full" />
    </div>
    <div className="flex-1 px-4 pb-4">
      <Skeleton className="w-full h-[65vh] rounded-3xl" />
      <div className="flex items-center justify-center gap-4 mt-4">
        <Skeleton className="w-14 h-14 rounded-full" />
        <Skeleton className="w-16 h-16 rounded-full" />
        <Skeleton className="w-14 h-14 rounded-full" />
      </div>
    </div>
  </div>
);

// Matches/Chat list skeleton
export const MatchesSkeleton = () => (
  <div className="flex flex-col h-full" style={{ background: 'var(--m3-surface)', paddingTop: 'var(--safe-top, 20px)' }}>
    <div className="px-4 py-3">
      <Skeleton className="h-8 w-40 rounded-lg mb-4" />
      <div className="flex gap-2 mb-4">
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-full" />
        <Skeleton className="h-9 w-20 rounded-full" />
      </div>
    </div>
    <div className="px-4 space-y-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-2xl" style={{ background: 'var(--m3-surface-container)' }}>
          <Skeleton className="w-14 h-14 rounded-full flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 rounded mb-2" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
          <Skeleton className="h-3 w-10 rounded" />
        </div>
      ))}
    </div>
  </div>
);

// Chat page skeleton
export const ChatSkeleton = () => (
  <div className="flex flex-col h-full" style={{ background: 'var(--m3-surface)', paddingTop: 'var(--safe-top, 20px)' }}>
    <div className="flex items-center gap-3 px-4 py-3 border-b" style={{ borderColor: 'var(--m3-outline-variant)' }}>
      <Skeleton className="w-5 h-5 rounded" />
      <Skeleton className="w-10 h-10 rounded-full" />
      <div>
        <Skeleton className="h-4 w-24 rounded mb-1" />
        <Skeleton className="h-3 w-16 rounded" />
      </div>
    </div>
    <div className="flex-1 px-4 py-4 space-y-4">
      <div className="flex justify-start"><Skeleton className="h-10 w-48 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-10 w-40 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-10 w-56 rounded-2xl" /></div>
      <div className="flex justify-end"><Skeleton className="h-10 w-36 rounded-2xl" /></div>
      <div className="flex justify-start"><Skeleton className="h-10 w-44 rounded-2xl" /></div>
    </div>
    <div className="px-4 py-3 border-t" style={{ borderColor: 'var(--m3-outline-variant)' }}>
      <Skeleton className="h-12 w-full rounded-full" />
    </div>
  </div>
);

// Profile skeleton
export const ProfileSkeleton = () => (
  <div className="flex flex-col h-full" style={{ background: 'var(--m3-surface)' }}>
    <Skeleton className="w-full h-72" />
    <div className="px-4 pt-4 space-y-3">
      <Skeleton className="h-7 w-40 rounded-lg" />
      <Skeleton className="h-4 w-56 rounded" />
      <div className="flex gap-2 mt-4">
        <Skeleton className="h-8 w-20 rounded-full" />
        <Skeleton className="h-8 w-24 rounded-full" />
        <Skeleton className="h-8 w-18 rounded-full" />
      </div>
      <Skeleton className="h-20 w-full rounded-xl mt-4" />
    </div>
  </div>
);

// Generic page loader (fast, minimal)
export const QuickLoader = () => (
  <div style={{ minHeight: '100vh', background: 'var(--m3-surface, #fff)' }} />
);
