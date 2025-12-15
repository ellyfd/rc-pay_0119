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
        return `${transaction.to_member_name} 入帳`;
      case 'withdraw':
        return `${transaction.from_member_name} 出帳`;
      case 'transfer':
        return `${transaction.from_member_name} → ${transaction.to_member_name} 轉帳`;
      default:
        return '';
    }
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
          <p className="font-medium text-slate-800">{getDescription()}</p>
          {transaction.type === 'transfer' && (
            <span className={`font-bold text-base ${getAmountColor()}`}>
              ${transaction.amount?.toLocaleString()}
            </span>
          )}
          <Badge className={transaction.wallet_type === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
            {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
          </Badge>
        </div>
        {transaction.note && (
          <p className="text-sm text-slate-500 line-clamp-2">{transaction.note}</p>
        )}
        <p className="text-xs text-slate-400 mt-1">
          {format(new Date(transaction.created_date), 'yyyy/MM/dd HH:mm')}
        </p>
      </div>
      {transaction.type !== 'transfer' && (
        <div className={`font-bold text-lg ${getAmountColor()}`}>
          {transaction.type === 'deposit' ? '+' : '-'}
          ${transaction.amount?.toLocaleString()}
        </div>
      )}
    </div>
  );
}