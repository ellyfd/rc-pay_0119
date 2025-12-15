import React from 'react';
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

export default function TransactionItem({ transaction }) {
  const getIcon = () => {
    switch (transaction.type) {
      case 'deposit':
        return <ArrowDownCircle className="w-5 h-5 text-emerald-500" />;
      case 'withdraw':
        return <ArrowUpCircle className="w-5 h-5 text-red-500" />;
      case 'transfer':
        return <ArrowRightLeft className="w-5 h-5 text-blue-500" />;
      default:
        return null;
    }
  };

  const getDescription = () => {
    const amount = `$${transaction.amount?.toLocaleString()}`;
    switch (transaction.type) {
      case 'deposit':
        return `${transaction.to_member_name} 入帳 ${amount}`;
      case 'withdraw':
        return `${transaction.from_member_name} 出帳 ${amount}`;
      case 'transfer':
        return `${transaction.from_member_name} → ${transaction.to_member_name} 轉帳 ${amount}`;
      default:
        return '';
    }
  };

  const getRelativeTime = () => {
    const now = new Date();
    const transactionDate = new Date(transaction.created_date);
    const diffInMinutes = Math.floor((now - transactionDate) / (1000 * 60));
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);

    if (diffInMinutes < 1) return '剛剛';
    if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;
    if (diffInHours < 24) return `${diffInHours} 小時前`;
    if (diffInDays === 1) return '昨天 ' + format(transactionDate, 'HH:mm');
    if (diffInDays < 7) return `${diffInDays} 天前`;
    return format(transactionDate, 'yyyy/MM/dd HH:mm');
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
    <div className="flex items-center gap-4 p-4 bg-white rounded-xl border border-slate-100 hover:shadow-md transition-shadow">
      <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center">
        {getIcon()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="font-medium text-slate-800">{getDescription()}</p>
          <Badge className={transaction.wallet_type === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
            {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
          </Badge>
        </div>
        {transaction.note && (
          <p className="text-sm text-slate-500 truncate">{transaction.note}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {getRelativeTime()}
        </p>
      </div>
      <div className={`font-bold text-lg ${getAmountColor()}`}>
        {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
      </div>
    </div>
  );
}