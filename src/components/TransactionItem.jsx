import React from 'react';
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { toGMT8, formatGMT8 } from "@/components/timezone";

export default function TransactionItem({ transaction }) {
  const getDescription = () => {
    switch (transaction.type) {
      case 'deposit':
        return `${transaction.to_member_name}`;
      case 'withdraw':
        return `${transaction.from_member_name}`;
      case 'transfer':
        return `${transaction.from_member_name} → ${transaction.to_member_name}`;
      default:
        return '';
    }
  };

  const getTypeLabel = () => {
    switch (transaction.type) {
      case 'deposit':
        return '入帳';
      case 'withdraw':
        return '出帳';
      case 'transfer':
        return '轉帳';
      default:
        return '';
    }
  };

  const getRelativeTime = () => {
    // 獲取當前 UTC 時間戳
    const nowUTC = Date.now();
    const transactionUTC = new Date(transaction.created_date).getTime();
    
    // 計算時差
    const diffInMs = nowUTC - transactionUTC;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    // 轉換為 GMT+8 進行日期比較
    const nowGMT8 = new Date(nowUTC + (8 * 60 * 60 * 1000));
    const transactionGMT8 = new Date(transactionUTC + (8 * 60 * 60 * 1000));
    
    // 使用 UTC 方法比較日期（因為已經加了 8 小時偏移）
    const isToday = nowGMT8.getUTCDate() === transactionGMT8.getUTCDate() && 
                    nowGMT8.getUTCMonth() === transactionGMT8.getUTCMonth() && 
                    nowGMT8.getUTCFullYear() === transactionGMT8.getUTCFullYear();
    
    const yesterdayGMT8 = new Date(nowGMT8.getTime() - 86400000);
    const isYesterday = yesterdayGMT8.getUTCDate() === transactionGMT8.getUTCDate() && 
                        yesterdayGMT8.getUTCMonth() === transactionGMT8.getUTCMonth() && 
                        yesterdayGMT8.getUTCFullYear() === transactionGMT8.getUTCFullYear();

    if (diffInMinutes < 1) return '剛剛';
    if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;
    if (diffInHours < 24 && isToday) return `今天 ${formatGMT8(transaction.created_date, 'HH:mm')}`;
    if (isYesterday) return `昨天 ${formatGMT8(transaction.created_date, 'HH:mm')}`;
    if (diffInDays < 7) return `${diffInDays} 天前`;
    return formatGMT8(transaction.created_date, 'yyyy/MM/dd HH:mm');
  };

  const getAmountColor = () => {
    switch (transaction.type) {
      case 'deposit':
        return 'text-emerald-600';
      case 'withdraw':
        return 'text-red-500';
      case 'transfer':
        return 'text-blue-600';
      default:
        return 'text-slate-600';
    }
  };

  return (
    <div className="flex items-center gap-2 md:gap-4 p-3 md:p-4 bg-white rounded-lg md:rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
      <div className="flex flex-col gap-1">
        <Badge className={
          transaction.type === 'deposit' ? 'bg-emerald-500' :
          transaction.type === 'withdraw' ? 'bg-red-500' :
          'bg-blue-500'
        }>
          <span className="text-xs md:text-sm">{getTypeLabel()}</span>
        </Badge>
        <Badge variant="outline" className={`text-xs ${transaction.wallet_type === 'cash' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}`}>
          {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
        </Badge>
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-800 text-sm md:text-base">{getDescription()}</p>
        {transaction.note && (
          <p className="text-xs md:text-sm text-slate-500 truncate mt-0.5 md:mt-1">{transaction.note}</p>
        )}
        <p className="text-xs text-slate-400 mt-0.5 md:mt-1">
          {getRelativeTime()}
        </p>
      </div>
      <div className={`font-bold text-base md:text-lg ${getAmountColor()} whitespace-nowrap`}>
        {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
        ${transaction.amount?.toLocaleString()}
      </div>
    </div>
  );
}