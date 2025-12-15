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
    const now = new Date();
    const transactionDate = new Date(transaction.created_date);
    const diffInMs = now - transactionDate;
    const diffInMinutes = Math.floor(diffInMs / 60000);
    const diffInHours = Math.floor(diffInMs / 3600000);
    const diffInDays = Math.floor(diffInMs / 86400000);

    const isToday = now.toDateString() === transactionDate.toDateString();
    const isYesterday = new Date(now - 86400000).toDateString() === transactionDate.toDateString();

    if (diffInMinutes < 1) return '剛剛';
    if (diffInMinutes < 60) return `${diffInMinutes} 分鐘前`;
    if (diffInHours < 24 && isToday) return `今天 ${format(transactionDate, 'HH:mm')}`;
    if (isYesterday) return `昨天 ${format(transactionDate, 'HH:mm')}`;
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
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={
            transaction.type === 'deposit' ? 'bg-emerald-500' :
            transaction.type === 'withdraw' ? 'bg-red-500' :
            'bg-blue-500'
          }>
            {getTypeLabel()}
          </Badge>
          <p className="font-medium text-slate-800">{getDescription()}</p>
          <Badge variant="outline" className={transaction.wallet_type === 'cash' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}>
            {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
          </Badge>
        </div>
        {transaction.note && (
          <p className="text-sm text-slate-500 truncate mt-1">{transaction.note}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {getRelativeTime()}
        </p>
      </div>
      <div className={`font-bold text-lg ${getAmountColor()}`}>
        {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
        ${transaction.amount?.toLocaleString()}
      </div>
    </div>
  );
}