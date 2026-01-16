import React, { useEffect, useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, TrendingUp, TrendingDown, Wallet, ShoppingCart, Package, Coffee, AlertCircle, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export default function MemberDetail() {
  const [memberId, setMemberId] = useState(null);
  const [urlChecked, setUrlChecked] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');
  const [walletTypeFilter, setWalletTypeFilter] = useState('all');
  const [transactionTypeFilter, setTransactionTypeFilter] = useState('all');
  const [currentUser, setCurrentUser] = useState(null);
  const [transactionToCancel, setTransactionToCancel] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setMemberId(params.get('id'));
    setUrlChecked(true);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
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

  const { data: allDrinkOrders = [], isLoading: drinkOrdersLoading } = useQuery({
    queryKey: ['drinkOrders'],
    queryFn: () => base44.entities.DrinkOrder.list('-created_date'),
  });

  // Get all transactions related to this member (for statistics)
  const allMemberTransactions = useMemo(() => 
    allTransactions.filter(
      t => t.from_member_id === memberId || t.to_member_id === memberId
    ),
    [allTransactions, memberId]
  );

  // Calculate statistics from ALL transactions (not filtered)
  const { totalDeposit, totalWithdraw, totalTransferIn, totalTransferOut } = useMemo(() => ({
    totalDeposit: allMemberTransactions
      .filter(t => t.type === 'deposit' && t.to_member_id === memberId)
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    totalWithdraw: allMemberTransactions
      .filter(t => t.type === 'withdraw' && t.from_member_id === memberId)
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    totalTransferIn: allMemberTransactions
      .filter(t => t.type === 'transfer' && t.to_member_id === memberId)
      .reduce((sum, t) => sum + (t.amount || 0), 0),
    totalTransferOut: allMemberTransactions
      .filter(t => t.type === 'transfer' && t.from_member_id === memberId)
      .reduce((sum, t) => sum + (t.amount || 0), 0),
  }), [allMemberTransactions, memberId]);

  // Apply filters for display only
  const memberTransactions = useMemo(() => {
    let filtered = [...allMemberTransactions];
    if (walletTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.wallet_type === walletTypeFilter);
    }
    if (transactionTypeFilter !== 'all') {
      filtered = filtered.filter(t => t.type === transactionTypeFilter);
    }
    return filtered;
  }, [allMemberTransactions, walletTypeFilter, transactionTypeFilter]);

  // Group items by group buy (as participant)
  const groupBuysByMember = useMemo(() => 
    groupBuyItems.reduce((acc, item) => {
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
    }, []),
    [groupBuyItems, allGroupBuys]
  );

  // Group buys organized by this member
  const organizedGroupBuys = useMemo(() => 
    allGroupBuys.filter(gb => gb.organizer_id === memberId).map(gb => {
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
    }),
    [allGroupBuys, allGroupBuyItems, memberId]
  );

  // Drink orders by this member
  const memberDrinkOrders = useMemo(() => 
    allDrinkOrders
      .map(order => {
        const memberItems = (order.items || []).filter(item => item.member_id === memberId);
        if (memberItems.length === 0) return null;

        const totalAmount = memberItems.reduce((sum, item) => sum + (item.price || 0), 0);
        return {
          ...order,
          memberItems,
          totalAmount
        };
      })
      .filter(Boolean),
    [allDrinkOrders, memberId]
  );

  // Pending Items - Group Buys (as organizer with unpaid items)
  const pendingOrganizerGroupBuys = useMemo(() => 
    organizedGroupBuys.filter(gb => gb.status === 'closed' && !gb.is_fully_paid),
    [organizedGroupBuys]
  );

  // Pending Items - Group Buys (as participant with unpaid items)
  const pendingParticipantGroupBuys = useMemo(() => 
    groupBuysByMember.filter(gb => {
      const groupBuyData = allGroupBuys.find(g => g.id === gb.group_buy_id);
      return groupBuyData && groupBuyData.status === 'closed' && !groupBuyData.is_fully_paid && gb.items.some(item => !item.paid);
    }),
    [groupBuysByMember, allGroupBuys]
  );

  // Pending Items - Drink Orders (unpaid)
  const pendingDrinkOrders = useMemo(() => 
    memberDrinkOrders.filter(order => 
      order.status !== 'completed' && 
      order.memberItems.some(item => !item.paid && item.member_id !== order.payer_id)
    ),
    [memberDrinkOrders]
  );

  const hasPendingItems = pendingOrganizerGroupBuys.length > 0 || 
                          pendingParticipantGroupBuys.length > 0 || 
                          pendingDrinkOrders.length > 0;

  const handleCancelTransaction = async (transaction) => {
    if (currentUser?.role !== 'admin') {
      toast.error('只有管理員可以執行此操作');
      return;
    }

    setTransactionToCancel(null);
    toast.loading('正在撤銷交易...', { id: 'cancel-transaction' });

    try {
      const { type, amount, wallet_type, from_member_id, to_member_id } = transaction;
      
      // 先刪除交易記錄
      await base44.entities.Transaction.delete(transaction.id);

      // 還原餘額變動
      const allMembers = await base44.entities.Member.list();
      
      if (type === 'deposit' && to_member_id) {
        const member = allMembers.find(m => m.id === to_member_id);
        if (member) {
          const newBalance = wallet_type === 'cash' 
            ? { balance: member.balance, cash_balance: (member.cash_balance || 0) - amount }
            : { balance: (member.balance || 0) - amount, cash_balance: member.cash_balance };
          await base44.entities.Member.update(to_member_id, newBalance);
        }
      } else if (type === 'withdraw' && from_member_id) {
        const member = allMembers.find(m => m.id === from_member_id);
        if (member) {
          const newBalance = wallet_type === 'cash'
            ? { balance: member.balance, cash_balance: (member.cash_balance || 0) + amount }
            : { balance: (member.balance || 0) + amount, cash_balance: member.cash_balance };
          await base44.entities.Member.update(from_member_id, newBalance);
        }
      } else if (type === 'transfer' && from_member_id && to_member_id) {
        const fromMember = allMembers.find(m => m.id === from_member_id);
        const toMember = allMembers.find(m => m.id === to_member_id);
        
        if (fromMember) {
          const newBalance = wallet_type === 'cash'
            ? { balance: fromMember.balance, cash_balance: (fromMember.cash_balance || 0) + amount }
            : { balance: (fromMember.balance || 0) + amount, cash_balance: fromMember.cash_balance };
          await base44.entities.Member.update(from_member_id, newBalance);
        }
        
        if (toMember) {
          const newBalance = wallet_type === 'cash'
            ? { balance: toMember.balance, cash_balance: (toMember.cash_balance || 0) - amount }
            : { balance: (toMember.balance || 0) - amount, cash_balance: toMember.cash_balance };
          await base44.entities.Member.update(to_member_id, newBalance);
        }
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member'] });

      toast.dismiss('cancel-transaction');
      toast.success('交易已撤銷，餘額已還原');
    } catch (error) {
      console.error('撤銷交易失敗:', error);
      toast.dismiss('cancel-transaction');
      toast.error(`撤銷失敗：${error.message}`);
    }
  };



  if (!urlChecked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  if (!memberId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500">缺少成員 ID</p>
          <Link to={createPageUrl('Home')}>
            <Button className="mt-4">返回首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (memberLoading) {
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

  const colorMap = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
  };

  const bgColor = member ? (colorMap[member.avatar_color] || "bg-slate-500") : "bg-slate-500";

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
            <Card 
              className="bg-slate-800/50 border-slate-700 p-6 cursor-pointer hover:bg-slate-800/70 transition-colors"
              onClick={() => setShowStats(!showStats)}
            >
              <div className="text-center">
                <p className="text-slate-400 text-sm mb-2">錢包餘額</p>
                <p className={`text-3xl font-bold ${member.balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  ${member.balance?.toLocaleString() || 0}
                </p>
              </div>
            </Card>
            <Card 
              className="bg-slate-800/50 border-slate-700 p-6 cursor-pointer hover:bg-slate-800/70 transition-colors"
              onClick={() => setShowStats(!showStats)}
            >
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
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="pending" className="relative">
              未結案
              {hasPendingItems && (
                <span className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              )}
            </TabsTrigger>
            <TabsTrigger value="rcpay">RC Pay</TabsTrigger>
            <TabsTrigger value="groupbuy">團購</TabsTrigger>
            <TabsTrigger value="drink">飲料</TabsTrigger>
          </TabsList>

          {/* Pending Items Tab */}
          <TabsContent value="pending" className="space-y-6">
            {!hasPendingItems ? (
              <Card className="p-8 text-center border-dashed">
                <AlertCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
                <p className="text-slate-500">沒有未結案項目</p>
                <p className="text-slate-400 text-sm mt-1">所有款項都已結清</p>
              </Card>
            ) : (
              <>
                {/* Pending Group Buys (as organizer) */}
                {pendingOrganizerGroupBuys.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Package className="w-5 h-5 text-red-500" />
                      <h2 className="text-lg font-semibold text-slate-800">我開的團購（未收齊款項）</h2>
                      <Badge className="bg-red-500">{pendingOrganizerGroupBuys.length}</Badge>
                    </div>
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">團購名稱</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">狀態</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">參與人數</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">總金額</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pendingOrganizerGroupBuys.map((gb) => (
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
                                  <Badge className="bg-amber-500">款項未齊</Badge>
                                </td>
                                <td className="px-4 py-3 text-center text-slate-700">{gb.participantCount}</td>
                                <td className="px-4 py-3 text-right font-semibold text-purple-600">
                                  ${gb.totalAmount.toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </section>
                )}

                {/* Pending Group Buys (as participant) */}
                {pendingParticipantGroupBuys.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <ShoppingCart className="w-5 h-5 text-red-500" />
                      <h2 className="text-lg font-semibold text-slate-800">我參與的團購（未付款）</h2>
                      <Badge className="bg-red-500">{pendingParticipantGroupBuys.length}</Badge>
                    </div>
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">團購名稱</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">商品</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">應付金額</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">款項</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pendingParticipantGroupBuys.map((groupBuy) => {
                              const unpaidItems = groupBuy.items.filter(item => !item.paid);
                              return unpaidItems.map((item, itemIdx) => (
                                <tr key={item.id} className="hover:bg-slate-50">
                                  {itemIdx === 0 && (
                                    <td className="px-4 py-3 align-top" rowSpan={unpaidItems.length}>
                                      <Link 
                                        to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.group_buy_id}
                                        className="font-medium text-slate-800 hover:text-purple-600"
                                      >
                                        {groupBuy.group_buy_title}
                                      </Link>
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-slate-700">{item.product_name}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">
                                    ${(item.price * item.quantity).toLocaleString()}
                                  </td>
                                  {itemIdx === 0 && (
                                    <td className="px-4 py-3 text-center align-top" rowSpan={unpaidItems.length}>
                                      <Badge className="bg-red-500">未付</Badge>
                                    </td>
                                  )}
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </section>
                )}

                {/* Pending Drink Orders */}
                {pendingDrinkOrders.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-4">
                      <Coffee className="w-5 h-5 text-red-500" />
                      <h2 className="text-lg font-semibold text-slate-800">飲料訂單（未付款）</h2>
                      <Badge className="bg-red-500">{pendingDrinkOrders.length}</Badge>
                    </div>
                    <Card>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">日期</th>
                              <th className="text-left px-4 py-3 font-semibold text-slate-700">品項</th>
                              <th className="text-right px-4 py-3 font-semibold text-slate-700">金額</th>
                              <th className="text-center px-4 py-3 font-semibold text-slate-700">狀態</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {pendingDrinkOrders.map((order) => {
                              const unpaidItems = order.memberItems.filter(item => 
                                !item.paid && item.member_id !== order.payer_id
                              );
                              return unpaidItems.map((item, idx) => (
                                <tr key={`${order.id}-${idx}`} className="hover:bg-slate-50">
                                  {idx === 0 && (
                                    <td className="px-4 py-3 align-top" rowSpan={unpaidItems.length}>
                                      <Link 
                                        to={createPageUrl('DrinkOrderDetail') + '?id=' + order.id}
                                        className="text-slate-800 hover:text-orange-600"
                                      >
                                        {format(new Date(order.order_date), 'MM/dd')}
                                      </Link>
                                    </td>
                                  )}
                                  <td className="px-4 py-3 text-slate-700">{item.item_name}</td>
                                  <td className="px-4 py-3 text-right text-slate-700">
                                    ${item.price?.toLocaleString() || 0}
                                  </td>
                                  {idx === 0 && (
                                    <td className="px-4 py-3 text-center align-top" rowSpan={unpaidItems.length}>
                                      <Badge className="bg-red-500">未付</Badge>
                                    </td>
                                  )}
                                </tr>
                              ));
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Card>
                  </section>
                )}
              </>
            )}
          </TabsContent>

          {/* RC Pay Tab */}
          <TabsContent value="rcpay" className="space-y-6">
            {/* Filters */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">錢包類型</label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={walletTypeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setWalletTypeFilter('all')}
                    className={`text-xs ${walletTypeFilter === 'all' ? 'bg-slate-800' : ''}`}
                    size="sm"
                  >
                    全部
                  </Button>
                  <Button
                    variant={walletTypeFilter === 'balance' ? 'default' : 'outline'}
                    onClick={() => setWalletTypeFilter('balance')}
                    className={`text-xs ${walletTypeFilter === 'balance' ? 'bg-blue-600' : ''}`}
                    size="sm"
                  >
                    錢包
                  </Button>
                  <Button
                    variant={walletTypeFilter === 'cash' ? 'default' : 'outline'}
                    onClick={() => setWalletTypeFilter('cash')}
                    className={`text-xs ${walletTypeFilter === 'cash' ? 'bg-amber-600' : ''}`}
                    size="sm"
                  >
                    現金
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-700 mb-2 block">交易類型</label>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant={transactionTypeFilter === 'all' ? 'default' : 'outline'}
                    onClick={() => setTransactionTypeFilter('all')}
                    className={`text-xs ${transactionTypeFilter === 'all' ? 'bg-slate-800' : ''}`}
                    size="sm"
                  >
                    全部
                  </Button>
                  <Button
                    variant={transactionTypeFilter === 'deposit' ? 'default' : 'outline'}
                    onClick={() => setTransactionTypeFilter('deposit')}
                    className={`text-xs ${transactionTypeFilter === 'deposit' ? 'bg-emerald-600' : ''}`}
                    size="sm"
                  >
                    入帳
                  </Button>
                  <Button
                    variant={transactionTypeFilter === 'withdraw' ? 'default' : 'outline'}
                    onClick={() => setTransactionTypeFilter('withdraw')}
                    className={`text-xs ${transactionTypeFilter === 'withdraw' ? 'bg-red-600' : ''}`}
                    size="sm"
                  >
                    出帳
                  </Button>
                  <Button
                    variant={transactionTypeFilter === 'transfer' ? 'default' : 'outline'}
                    onClick={() => setTransactionTypeFilter('transfer')}
                    className={`text-xs ${transactionTypeFilter === 'transfer' ? 'bg-blue-600' : ''}`}
                    size="sm"
                  >
                    轉帳
                  </Button>
                </div>
              </div>
            </div>

            {/* Statistics Cards */}
            {showStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-4">
          <Card className="p-2 md:p-4 bg-emerald-50 border-emerald-200">
            <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-emerald-600" />
              <p className="text-[10px] md:text-xs text-emerald-700 font-medium">總入帳</p>
            </div>
            <p className="text-sm md:text-xl font-bold text-emerald-700">
              ${totalDeposit.toLocaleString()}
            </p>
          </Card>

          <Card className="p-2 md:p-4 bg-red-50 border-red-200">
            <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
              <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-red-600" />
              <p className="text-[10px] md:text-xs text-red-700 font-medium">總出帳</p>
            </div>
            <p className="text-sm md:text-xl font-bold text-red-700">
              ${totalWithdraw.toLocaleString()}
            </p>
          </Card>

          <Card className="p-2 md:p-4 bg-blue-50 border-blue-200">
            <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
              <TrendingUp className="w-3 h-3 md:w-4 md:h-4 text-blue-600" />
              <p className="text-[10px] md:text-xs text-blue-700 font-medium">轉入金額</p>
            </div>
            <p className="text-sm md:text-xl font-bold text-blue-700">
              ${totalTransferIn.toLocaleString()}
            </p>
          </Card>

          <Card className="p-2 md:p-4 bg-orange-50 border-orange-200">
            <div className="flex items-center gap-1 md:gap-2 mb-1 md:mb-2">
              <TrendingDown className="w-3 h-3 md:w-4 md:h-4 text-orange-600" />
              <p className="text-[10px] md:text-xs text-orange-700 font-medium">轉出金額</p>
            </div>
            <p className="text-sm md:text-xl font-bold text-orange-700">
              ${totalTransferOut.toLocaleString()}
            </p>
            </Card>
            </div>
            )}

            {/* Transaction History */}
            {!transactionsLoading && memberTransactions.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-800">交易明細</h2>
                <span className="text-sm text-slate-500">共 {memberTransactions.length} 筆</span>
              </div>

              {memberTransactions.length > 0 && (
                <Card className="overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-1.5 sm:px-4 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">時間</th>
                          <th className="px-1 sm:px-4 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">類型</th>
                          <th className="px-1 sm:px-4 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b hidden sm:table-cell">錢包</th>
                          <th className="px-1.5 sm:px-4 py-2 sm:py-3 text-left font-semibold text-slate-700 border-b">說明</th>
                          <th className="px-1.5 sm:px-4 py-2 sm:py-3 text-right font-semibold text-slate-700 border-b">金額</th>
                          {currentUser?.role === 'admin' && (
                            <th className="px-1 sm:px-4 py-2 sm:py-3 text-center font-semibold text-slate-700 border-b">操作</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {memberTransactions.map((transaction) => {
                          const isTransferOut = transaction.type === 'transfer' && transaction.from_member_id === memberId;
                          const isTransferIn = transaction.type === 'transfer' && transaction.to_member_id === memberId;

                          const getDescription = () => {
                            switch (transaction.type) {
                              case 'deposit':
                                return `${transaction.to_member_name}`;
                              case 'withdraw':
                                return `${transaction.from_member_name}`;
                              case 'transfer':
                                if (isTransferOut) {
                                  return `轉出 to ${transaction.to_member_name}`;
                                } else if (isTransferIn) {
                                  return `轉入 from ${transaction.from_member_name}`;
                                }
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
                                if (isTransferOut) return '轉出';
                                if (isTransferIn) return '轉入';
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
                                return isTransferOut ? 'text-red-500' : 'text-emerald-600';
                              default:
                                return 'text-slate-600';
                            }
                          };

                          const getAmountPrefix = () => {
                            if (transaction.type === 'deposit') return '+';
                            if (transaction.type === 'withdraw') return '-';
                            if (transaction.type === 'transfer') {
                              return isTransferOut ? '-' : '+';
                            }
                            return '';
                          };

                          return (
                            <tr key={transaction.id} className="border-b hover:bg-slate-50">
                              <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-slate-600 whitespace-nowrap text-[11px] sm:text-sm">
                                <div className="hidden sm:block">
                                  {formatTaiwanTime(transaction.created_date, 'yyyy/MM/dd HH:mm')}
                                </div>
                                <div className="sm:hidden">
                                  {formatTaiwanTime(transaction.created_date, 'MM/dd HH:mm')}
                                </div>
                              </td>
                              <td className="px-1 sm:px-4 py-2 sm:py-3">
                                <Badge className={`text-[10px] sm:text-xs whitespace-nowrap ${
                                  transaction.type === 'deposit' ? 'bg-emerald-500' :
                                  transaction.type === 'withdraw' ? 'bg-red-500' :
                                  'bg-blue-500'
                                }`}>
                                  {getTypeLabel()}
                                </Badge>
                                <div className="sm:hidden text-[10px] text-slate-500 mt-1">
                                  {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
                                </div>
                              </td>
                              <td className="px-1 sm:px-4 py-2 sm:py-3 hidden sm:table-cell">
                                <Badge variant="outline" className={`text-xs ${transaction.wallet_type === 'cash' ? 'border-amber-500 text-amber-700' : 'border-blue-500 text-blue-700'}`}>
                                  {transaction.wallet_type === 'cash' ? '現金' : '錢包'}
                                </Badge>
                              </td>
                              <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-slate-700 text-[11px] sm:text-sm">
                                <div className="line-clamp-2">{getDescription()}</div>
                                {transaction.note && (
                                  <div className="text-[10px] sm:text-xs text-slate-500 mt-1 line-clamp-1">{transaction.note}</div>
                                )}
                              </td>
                              <td className={`px-1.5 sm:px-4 py-2 sm:py-3 text-right font-bold whitespace-nowrap text-[11px] sm:text-sm ${getAmountColor()}`}>
                                {getAmountPrefix()}${transaction.amount?.toLocaleString()}
                              </td>
                              {currentUser?.role === 'admin' && (
                                <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => setTransactionToCancel(transaction)}
                                    className="h-6 w-6 sm:h-8 sm:w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                                  >
                                    <X className="w-3 h-3 sm:w-4 sm:h-4" />
                                  </Button>
                                </td>
                              )}
                              </tr>
                              );
                              })}
                              </tbody>
                    </table>
                  </div>
                </Card>
              )}
            </section>
            )}
            </TabsContent>

            {/* Group Buy Tab */}
            <TabsContent value="groupbuy" className="space-y-6">
            {/* Organized Group Buys */}
            {organizedGroupBuys.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">開團紀錄</h2>
            <span className="text-sm text-slate-500">共 {organizedGroupBuys.length} 個團購</span>
          </div>

          {organizedGroupBuys.length > 0 && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-1.5 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">開團狀態</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden sm:table-cell">人數</th>
                      <th className="text-right px-1.5 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">總額</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">收款</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {organizedGroupBuys.map((gb) => (
                      <tr key={gb.id} className="hover:bg-slate-50">
                        <td className="px-1.5 sm:px-4 py-2 sm:py-3">
                          <Link 
                            to={createPageUrl('GroupBuyDetail') + '?id=' + gb.id}
                            className="font-medium text-slate-800 hover:text-purple-600 line-clamp-2 text-[11px] sm:text-sm"
                          >
                            {gb.title}
                          </Link>
                        </td>
                        <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                          <Badge 
                            className={`text-[10px] sm:text-xs whitespace-nowrap ${
                              gb.status === 'open' ? 'bg-green-500' :
                              gb.status === 'closed' && !gb.is_fully_paid ? 'bg-amber-500' :
                              'bg-blue-500'
                            }`}
                          >
                            {gb.status === 'open' ? '進行中' :
                             gb.status === 'closed' && !gb.is_fully_paid ? '待收款' :
                             '已完成'}
                          </Badge>
                        </td>
                        <td className="px-1 sm:px-4 py-2 sm:py-3 text-center text-slate-700 hidden sm:table-cell">{gb.participantCount}</td>
                        <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-right font-semibold text-purple-600 whitespace-nowrap text-[11px] sm:text-sm">
                          ${gb.totalAmount.toLocaleString()}
                        </td>
                        <td className="px-1 sm:px-4 py-2 sm:py-3 text-center">
                          {gb.status === 'open' ? (
                            <span className="text-slate-400 text-[10px] sm:text-xs">-</span>
                          ) : (
                            <Badge 
                              className={`text-[10px] sm:text-xs ${gb.allPaid ? 'bg-green-500' : 'bg-amber-500'}`}
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
        )}

        {/* Group Buy Section */}
        {!groupBuyItemsLoading && groupBuysByMember.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <ShoppingCart className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">跟團紀錄</h2>
            <span className="text-sm text-slate-500">共 {groupBuysByMember.length} 個團購</span>
          </div>

          {groupBuysByMember.length > 0 && (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-xs sm:text-sm">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-1.5 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">團購名稱</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">團購狀態</th>
                      <th className="text-left px-1.5 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden sm:table-cell">商品</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden sm:table-cell">數量</th>
                      <th className="text-right px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700 hidden md:table-cell">單價</th>
                      <th className="text-right px-1.5 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">小計</th>
                      <th className="text-center px-1 sm:px-4 py-2 sm:py-3 font-semibold text-slate-700">款項</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {groupBuysByMember.map((groupBuy) => {
                      const allPaid = groupBuy.items.every(item => item.paid);
                      return groupBuy.items.map((item, itemIdx) => (
                        <tr key={item.id} className="hover:bg-slate-50">
                          {itemIdx === 0 && (
                            <>
                              <td className="px-1.5 sm:px-4 py-2 sm:py-3 align-top" rowSpan={groupBuy.items.length}>
                                <Link 
                                  to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.group_buy_id}
                                  className="font-medium text-slate-800 hover:text-purple-600 line-clamp-2 text-[11px] sm:text-sm"
                                >
                                  {groupBuy.group_buy_title}
                                </Link>
                              </td>
                              <td className="px-1 sm:px-4 py-2 sm:py-3 text-center align-top" rowSpan={groupBuy.items.length}>
                                {(() => {
                                  const gbData = allGroupBuys.find(g => g.id === groupBuy.group_buy_id);
                                  const isOpen = gbData?.status === 'open';
                                  const isClosed = gbData?.status === 'closed';
                                  const isFullyPaid = gbData?.is_fully_paid === true;
                                  
                                  return (
                                    <Badge 
                                      className={`text-[10px] sm:text-xs whitespace-nowrap ${
                                        isOpen ? 'bg-green-500' :
                                        isClosed && !isFullyPaid ? 'bg-amber-500' :
                                        allPaid ? 'bg-blue-500' : 'bg-slate-500'
                                      }`}
                                    >
                                      {isOpen ? '進行中' :
                                       isClosed && !isFullyPaid ? (allPaid ? '已付款' : '待付款') :
                                       '已完成'}
                                    </Badge>
                                  );
                                })()}
                              </td>
                            </>
                          )}
                          <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-slate-700 hidden sm:table-cell">
                            <div className="line-clamp-2">{item.product_name}</div>
                            {item.note && item.note.includes('平分') && <div className="text-[10px] text-slate-400 mt-0.5">{item.note}</div>}
                          </td>
                          <td className="px-1 sm:px-4 py-2 sm:py-3 text-center text-slate-700 hidden sm:table-cell">{item.quantity}</td>
                          <td className="px-1 sm:px-4 py-2 sm:py-3 text-right text-slate-700 hidden md:table-cell whitespace-nowrap">${item.price.toLocaleString()}</td>
                          {itemIdx === 0 && (
                            <td className="px-1.5 sm:px-4 py-2 sm:py-3 text-right align-top font-semibold text-purple-600 whitespace-nowrap text-[11px] sm:text-sm" rowSpan={groupBuy.items.length}>
                              ${groupBuy.total.toLocaleString()}
                            </td>
                          )}
                          {itemIdx === 0 && (
                            <td className="px-1 sm:px-4 py-2 sm:py-3 text-center align-top" rowSpan={groupBuy.items.length}>
                              <Badge className={`text-[10px] sm:text-xs ${allPaid ? 'bg-green-500' : 'bg-amber-500'}`}>
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
        )}
          </TabsContent>

          {/* Drink Tab */}
          <TabsContent value="drink" className="space-y-6">
            {/* Drink Orders Section */}
        {!drinkOrdersLoading && memberDrinkOrders.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Coffee className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">飲料訂單</h2>
            <span className="text-sm text-slate-500">共 {memberDrinkOrders.length} 筆</span>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[500px] text-xs sm:text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-2 py-2 font-semibold text-slate-700">日期</th>
                    <th className="text-left px-2 py-2 font-semibold text-slate-700">品項</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700">訂單狀態</th>
                    <th className="text-right px-2 py-2 font-semibold text-slate-700">金額</th>
                    <th className="text-center px-2 py-2 font-semibold text-slate-700">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {memberDrinkOrders.map((order) => (
                    order.memberItems.map((item, idx) => (
                      <tr key={`${order.id}-${idx}`} className="hover:bg-slate-50">
                        {idx === 0 && (
                          <td className="px-2 py-2 align-middle text-slate-700 whitespace-nowrap" rowSpan={order.memberItems.length}>
                            <Link 
                              to={createPageUrl('DrinkOrderDetail') + '?id=' + order.id}
                              className="text-slate-800 hover:text-orange-600"
                            >
                              {format(new Date(order.order_date), 'MM/dd')}
                            </Link>
                          </td>
                        )}
                        <td className="px-2 py-2 text-slate-700">
                          <div className="line-clamp-2">{item.item_name}</div>
                        </td>
                        {idx === 0 && (
                          <td className="px-2 py-2 text-center align-middle" rowSpan={order.memberItems.length}>
                            <Badge className={`text-[10px] sm:text-xs ${order.status === 'completed' ? 'bg-green-500' : 'bg-amber-500'}`}>
                              {order.status === 'completed' ? '已完成' : '待付款'}
                            </Badge>
                          </td>
                        )}
                        <td className="px-2 py-2 text-right text-slate-700 whitespace-nowrap">
                          ${item.price?.toLocaleString() || 0}
                        </td>
                        <td className="px-2 py-2 text-center">
                          {order.payer_id && item.member_id === order.payer_id ? (
                            <span className="text-slate-500 text-[10px] sm:text-xs">不需支付</span>
                          ) : (
                            <Badge className={`text-[10px] sm:text-xs ${item.paid ? 'bg-green-500' : 'bg-slate-400'}`}>
                              {item.paid ? '已付' : '未付'}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </section>
        )}
          </TabsContent>
          </Tabs>
          </div>

          {/* Cancel Transaction Dialog */}
          <AlertDialog open={!!transactionToCancel} onOpenChange={() => setTransactionToCancel(null)}>
          <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認撤銷交易</AlertDialogTitle>
            <AlertDialogDescription>
              撤銷此交易將自動還原相關成員的餘額變動。此操作無法復原，確定要繼續嗎？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => transactionToCancel && handleCancelTransaction(transactionToCancel)}
              className="bg-red-600 hover:bg-red-700"
            >
              確認撤銷
            </AlertDialogAction>
          </AlertDialogFooter>
          </AlertDialogContent>
          </AlertDialog>

          </div>
          );
          }