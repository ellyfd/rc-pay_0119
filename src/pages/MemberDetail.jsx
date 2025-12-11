import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import TransactionItem from "@/components/TransactionItem";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function MemberDetail() {
  const [memberId, setMemberId] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMemberId(params.get('id'));
  }, []);

  const { data: member, isLoading: memberLoading } = useQuery({
    queryKey: ['member', memberId],
    queryFn: async () => {
      const members = await base44.entities.Member.list();
      return members.find(m => m.id === memberId);
    },
    enabled: !!memberId,
  });

  const { data: allTransactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 100),
  });

  if (!memberId || memberLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500">找不到此成員</p>
          <Link to={createPageUrl('Home')}>
            <Button className="mt-4">返回首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  // Filter transactions related to this member
  const memberTransactions = allTransactions.filter(
    t => t.from_member_id === memberId || t.to_member_id === memberId
  );

  // Calculate statistics
  const totalDeposit = memberTransactions
    .filter(t => t.type === 'deposit' && t.to_member_id === memberId)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalWithdraw = memberTransactions
    .filter(t => t.type === 'withdraw' && t.from_member_id === memberId)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalTransferIn = memberTransactions
    .filter(t => t.type === 'transfer' && t.to_member_id === memberId)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const totalTransferOut = memberTransactions
    .filter(t => t.type === 'transfer' && t.from_member_id === memberId)
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  // Calculate balance and cash spending
  const balanceSpending = memberTransactions
    .filter(t => t.type === 'withdraw' && t.from_member_id === memberId && t.note?.includes('七分飽'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const cashSpending = allTransactions
    .filter(t => t.type === 'withdraw' && t.from_member_id === memberId && !t.note?.includes('七分飽'))
    .reduce((sum, t) => sum + (t.amount || 0), 0);

  const colorMap = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
  };

  const bgColor = colorMap[member.avatar_color] || "bg-slate-500";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          
          <div className="flex items-center gap-4 mb-6">
            <div className={`w-16 h-16 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-2xl`}>
              {member.name?.charAt(0)}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{member.name}</h1>
              <p className="text-slate-400 text-sm">成員帳戶明細</p>
            </div>
          </div>

          {/* Balance Card */}
          <Card className="bg-slate-800/50 border-slate-700 p-6">
            <div className="text-center">
              <p className="text-slate-400 text-sm mb-2">目前餘額</p>
              <p className={`text-4xl font-bold ${member.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                ${member.balance?.toLocaleString() || 0}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">總入帳</p>
            </div>
            <p className="text-xl font-bold text-emerald-700">
              ${totalDeposit.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-blue-600" />
              <p className="text-xs text-blue-700 font-medium">轉入金額</p>
            </div>
            <p className="text-xl font-bold text-blue-700">
              ${totalTransferIn.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 bg-orange-50 border-orange-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-orange-600" />
              <p className="text-xs text-orange-700 font-medium">轉出金額</p>
            </div>
            <p className="text-xl font-bold text-orange-700">
              ${totalTransferOut.toLocaleString()}
            </p>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4 bg-purple-50 border-purple-200">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-purple-600" />
              <p className="text-xs text-purple-700 font-medium">用餘款消費</p>
            </div>
            <p className="text-xl font-bold text-purple-700">
              ${balanceSpending.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-amber-600" />
              <p className="text-xs text-amber-700 font-medium">用現金消費</p>
            </div>
            <p className="text-xl font-bold text-amber-700">
              ${cashSpending.toLocaleString()}
            </p>
          </Card>
        </div>

        {/* Transaction History */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-800">交易明細</h2>
            <span className="text-sm text-slate-500">共 {memberTransactions.length} 筆</span>
          </div>

          {transactionsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
                      <div className="h-3 bg-slate-200 rounded w-20" />
                    </div>
                    <div className="h-6 bg-slate-200 rounded w-16" />
                  </div>
                </Card>
              ))}
            </div>
          ) : memberTransactions.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚無交易紀錄</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {memberTransactions.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}