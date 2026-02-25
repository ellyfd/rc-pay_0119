import React from 'react';

// P2-11: 统一加载动画组件
export default function LoadingSpinner({ message = '載入中...', size = 'md' }) {
  const sizeClasses = {
    sm: 'w-8 h-8 border-3',
    md: 'w-12 h-12 border-4',
    lg: 'w-16 h-16 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4">
      <div className={`${sizeClasses[size]} border-slate-300 border-t-slate-800 rounded-full animate-spin mb-3`} />
      {message && <p className="text-sm text-slate-500">{message}</p>}
    </div>
  );
}