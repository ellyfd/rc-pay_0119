import React from 'react';
import { Loader2 } from 'lucide-react';

// P2-11: 统一加载动画（Home/AdminOrders/FoodOrder/GroupBuy 共用）
export default function LoadingSpinner({ message = '加載中...' }) {
  return (
    <div className="flex flex-col items-center justify-center py-12">
      <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}