import React, { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ShoppingCart, Package } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
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
  const organizedGroupBuys = allGroupBuys.filter(gb => gb.organizer_id === memberId).map(gb => {
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
                <table className="w-full min-w-[600px] text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">狀態</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden sm:table-cell">人數</th>
                      <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">總額</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">收款</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {organizedGroupBuys.map((gb) => (
                      <tr key={gb.id} className="hover:bg-slate-50">
                        <td className="px-2 sm:px-4 py-2 sm:py-3">
                          <Link 
                            to={createPageUrl('GroupBuyDetail') + '?id=' + gb.id}
                            className="font-medium text-slate-800 hover:text-purple-600 line-clamp-2"
                          >
                            {gb.title}
                          </Link>
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          <Badge 
                            className={`text-xs ${
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
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-slate-700 hidden sm:table-cell">{gb.participantCount}</td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-right font-semibold text-purple-600 whitespace-nowrap">
                          ${gb.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-2 sm:px-4 py-2 sm:py-3 text-center">
                          {gb.status === 'open' ? (
                            <span className="text-slate-400 text-xs">-</span>
                          ) : (
                            <Badge 
                              className={`text-xs ${gb.allPaid ? 'bg-green-500' : 'bg-amber-500'}`}
                            >
                              {gb.allPaid ? '完成' : '未完'}
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
                <table className="w-full min-w-[700px] text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">狀態</th>
                      <th className="text-left px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">商品</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden sm:table-cell">數量</th>
                      <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden md:table-cell">單價</th>
                      <th className="text-right px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">小計</th>
                      <th className="text-center px-2 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">支付</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupBuysByMember.map((groupBuy) => {
                      const allPaid = groupBuy.items.every(item => item.paid);
                      return groupBuy.items.map((item, itemIdx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          {itemIdx === 0 && (
                            <>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 align-top" rowSpan={groupBuy.items.length}>
                                <Link 
                                  to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.group_buy_id}
                                  className="font-medium text-slate-800 hover:text-purple-600 line-clamp-2"
                                >
                                  {groupBuy.group_buy_title}
                                </Link>
                              </td>
                              <td className="px-2 sm:px-4 py-2 sm:py-3 text-center align-top" rowSpan={groupBuy.items.length}>
                                <Badge 
                                  className={`text-xs ${
                                    groupBuy.group_buy_status === 'open' ? 'bg-green-500' :
                                    groupBuy.group_buy_status === 'closed' ? 'bg-amber-500' :
                                    allPaid ? 'bg-blue-500' : 'bg-slate-500'
                                  }`}
                                >
                                  {groupBuy.group_buy_status === 'open' ? '進行中' :
                                   groupBuy.group_buy_status === 'closed' ? '已截止' :
                                   allPaid ? '已結清' : '已結單'}
                                </Badge>
                              </td>
                            </>
                          )}
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-slate-700">
                            <div className="line-clamp-2">{item.product_name}</div>
                            {item.note && item.note.includes('平分') && <div className="text-[10px] text-slate-400 mt-0.5">{item.note}</div>}
                            <div className="sm:hidden text-[10px] text-slate-500 mt-1">
                              數量: {item.quantity} · 單價: ${item.price}
                            </div>
                          </td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-center text-slate-700 hidden sm:table-cell">{item.quantity}</td>
                          <td className="px-2 sm:px-4 py-2 sm:py-3 text-right text-slate-700 hidden md:table-cell whitespace-nowrap">${item.price.toLocaleString()}</td>
                          {itemIdx === 0 && (
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-right align-top font-semibold text-purple-600 whitespace-nowrap" rowSpan={groupBuy.items.length}>
                              ${groupBuy.total.toLocaleString()}
                            </td>
                          )}
                          {itemIdx === 0 && (
                            <td className="px-2 sm:px-4 py-2 sm:py-3 text-center align-top" rowSpan={groupBuy.items.length}>
                              <Badge className={`text-xs ${allPaid ? 'bg-green-500' : 'bg-amber-500'}`}>
                                {allPaid ? '已付' : '未付'}
                              </Badge>
                            </td>
                          )}
                        </tr>
                      ));
                    })}
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
            <Card className="p-8 text-center">
              <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-500">載入中...</p>
            </Card>
          ) : memberTransactions.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <Wallet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚無交易紀錄</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">時間</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">類型</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">錢包</th>
                      <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">說明</th>
                      <th className="px-4 py-3 text-right font-semibold text-slate-700 border-b">金額</th>
                    </tr>
                  </thead>
                  <tbody>
                    {memberTransactions.map((transaction) => {
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
                        <tr key={transaction.id} className="border-b hover:bg-slate-50">
                          <td className="px-4 py-3 text-slate-600">
                            {formatTaiwanTime(transaction.created_date, 'yyyy/MM/dd HH:mm')}
                          </td>
                          <td className="px-4 py-3">
                            <Badge className={
                              transaction.type === 'deposit' ? 'bg-emerald-500' :
                              transaction.type === 'withdraw' ? 'bg-red-500' :
                              'bg-blue-500'
                            }>
                              {getTypeLabel()}
                            </Badge>
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="outline" className={`text-xs ${transaction.wallet_type === 'cash' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}`}>
                              {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-slate-700">
                            <div>{getDescription()}</div>
                            {transaction.note && (
                              <div className="text-xs text-slate-500 mt-1">{transaction.note}</div>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right font-bold ${getAmountColor()}`}>
                            {transaction.type === 'deposit' ? '+' : transaction.type === 'withdraw' ? '-' : ''}
                            ${transaction.amount?.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}