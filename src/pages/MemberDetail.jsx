import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ShoppingCart, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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

  const { data: groupBuyItems = [], isLoading: groupBuyItemsLoading } = useQuery({
    queryKey: ['groupBuyItems', memberId],
    queryFn: async () => {
      const allItems = await base44.entities.GroupBuyItem.list('-created_date');
      return allItems.filter(item => item.member_id === memberId);
    },
    enabled: !!memberId,
  });

  const { data: allGroupBuys = [] } = useQuery({
    queryKey: ['groupBuys'],
    queryFn: () => base44.entities.GroupBuy.list('-created_date'),
  });

  const { data: allGroupBuyItems = [] } = useQuery({
    queryKey: ['allGroupBuyItems'],
    queryFn: () => base44.entities.GroupBuyItem.list('-created_date'),
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

  const colorMap = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
  };

  const bgColor = colorMap[member.avatar_color] || "bg-slate-500";

  // Group items by group buy (as participant)
  const groupBuysByMember = groupBuyItems.reduce((acc, item) => {
    const existing = acc.find(g => g.group_buy_id === item.group_buy_id);
    const itemTotal = item.price * item.quantity;
    if (existing) {
      existing.items.push(item);
      existing.total += itemTotal;
    } else {
      const groupBuy = allGroupBuys.find(gb => gb.id === item.group_buy_id);
      acc.push({
        group_buy_id: item.group_buy_id,
        group_buy_title: groupBuy?.title || '未知團購',
        group_buy_status: groupBuy?.status || 'open',
        items: [item],
        total: itemTotal
      });
    }
    return acc;
  }, []);

  // Group buys organized by this member
  const organizedGroupBuys = allGroupBuys.filter(gb => gb.organizer_member_id === memberId).map(gb => {
    const items = allGroupBuyItems.filter(item => item.group_buy_id === gb.id);
    const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const participantCount = new Set(items.map(item => item.member_id)).size;
    const allPaid = items.length > 0 && items.every(item => item.paid);
    
    return {
      ...gb,
      totalAmount,
      participantCount,
      allPaid
    };
  });

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

          {/* Balance Cards */}
          <div className="grid grid-cols-2 gap-4">
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-2">錢包餘額</p>
                <p className={`text-3xl font-bold ${member.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${member.balance?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
            <Card className="bg-slate-800/50 border-slate-700 p-6">
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-2">現金餘額</p>
                <p className={`text-3xl font-bold ${member.cash_balance >= 0 ? 'text-amber-400' : 'text-red-400'}`}>
                  ${member.cash_balance?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <p className="text-xs text-emerald-700 font-medium">總入帳</p>
            </div>
            <p className="text-xl font-bold text-emerald-700">
              ${totalDeposit.toLocaleString()}
            </p>
          </Card>

          <Card className="p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-2 mb-2">
              <TrendingDown className="w-4 h-4 text-red-600" />
              <p className="text-xs text-red-700 font-medium">總出帳</p>
            </div>
            <p className="text-xl font-bold text-red-700">
              ${totalWithdraw.toLocaleString()}
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

        {/* Organized Group Buys */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">開團紀錄</h2>
            <span className="text-sm text-slate-500">共 {organizedGroupBuys.length} 個團購</span>
          </div>

          {organizedGroupBuys.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚未開過團購</p>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">狀態</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">參與人數</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">總金額</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">收款狀態</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {organizedGroupBuys.map((gb) => (
                      <tr key={gb.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <Link 
                            to={createPageUrl('GroupBuyDetail') + '?id=' + gb.id}
                            className="font-medium text-slate-800 hover:text-purple-600"
                          >
                            {gb.title}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge 
                            className={`${
                              gb.status === 'open' ? 'bg-green-500' :
                              gb.status === 'closed' ? 'bg-amber-500' :
                              'bg-slate-500'
                            }`}
                          >
                            {gb.status === 'open' ? '進行中' :
                             gb.status === 'closed' ? '已截止' :
                             '已結單'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">{gb.participantCount}</td>
                        <td className="px-4 py-3 text-right font-semibold text-purple-600">
                          ${gb.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {gb.status === 'open' ? (
                            <span className="text-slate-400 text-sm">-</span>
                          ) : (
                            <Badge 
                              className={gb.allPaid ? 'bg-green-500' : 'bg-amber-500'}
                            >
                              {gb.allPaid ? '已完成' : '未完成'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

        {/* Group Buy Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">跟團紀錄</h2>
            <span className="text-sm text-slate-500">共 {groupBuysByMember.length} 個團購</span>
          </div>

{groupBuyItemsLoading ? (
            <Card className="p-4 animate-pulse">
              <div className="h-20 bg-slate-200 rounded" />
            </Card>
          ) : groupBuysByMember.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚未參與任何團購</p>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">狀態</th>
                      <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">訂購項目</th>
                      <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">金額</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupBuysByMember.map((groupBuy) => (
                      groupBuy.items.map((item, itemIdx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          {itemIdx === 0 && (
                            <>
                              <td className="px-4 py-3 align-top" rowSpan={groupBuy.items.length}>
                                <Link 
                                  to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.group_buy_id}
                                  className="font-medium text-slate-800 hover:text-purple-600"
                                >
                                  {groupBuy.group_buy_title}
                                </Link>
                              </td>
                              <td className="px-4 py-3 text-center align-top" rowSpan={groupBuy.items.length}>
                                <Badge 
                                  className={`${
                                    groupBuy.group_buy_status === 'open' ? 'bg-green-500' :
                                    groupBuy.group_buy_status === 'closed' ? 'bg-amber-500' :
                                    'bg-slate-500'
                                  }`}
                                >
                                  {groupBuy.group_buy_status === 'open' ? '進行中' :
                                   groupBuy.group_buy_status === 'closed' ? '已截止' :
                                   '已結單'}
                                </Badge>
                              </td>
                            </>
                          )}
                          <td className="px-4 py-3">
                            <div className="text-slate-700">
                              {item.product_name}
                              {item.note && <span className="text-slate-400 ml-2">({item.note})</span>}
                            </div>
                            <div className="text-sm text-slate-500">
                              × {item.quantity} @ ${item.price.toLocaleString()}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-700">
                            ${(item.price * item.quantity).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    ))}
                    <tr className="bg-slate-50 font-semibold">
                      <td colSpan={3} className="px-4 py-3 text-right">總計</td>
                      <td className="px-4 py-3 text-right text-purple-600">
                        ${groupBuysByMember.reduce((sum, gb) => sum + gb.total, 0).toLocaleString()}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>

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