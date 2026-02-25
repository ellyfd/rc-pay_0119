import React from 'react';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { AlertCircle } from 'lucide-react';

// P2-8: 统一管理员权限检查（3个文件共用）
export default function AdminGuard({ children }) {
  const { user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-slate-500">检查权限中...</p>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <AlertCircle className="w-12 h-12 text-red-500 mb-3" />
        <h2 className="text-lg font-semibold text-slate-800 mb-2">权限不足</h2>
        <p className="text-sm text-slate-600 text-center">
          仅管理员可访问此功能
        </p>
      </div>
    );
  }

  return <>{children}</>;
}