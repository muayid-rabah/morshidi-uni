import React from 'react';

export const Skeleton: React.FC<{ className?: string }> = ({ className = 'h-4 w-full' }) => {
  return (
    <div className={`animate-pulse bg-slate-200/70 rounded-md ${className}`} />
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-soft space-y-3">
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-4/5" />
    </div>
  );
};
