import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, Plus, Wallet, TrendingUp, History, Users, UtensilsCrossed, Settings, ShoppingCart, User, MoreVertical, LogOut, Coffee } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import MemberCard from "@/components/MemberCard";
import TransactionItem from "@/components/TransactionItem";
import AddMemberDialog from "@/components/AddMemberDialog";
import TransactionDialog from "@/components/TransactionDialog";
import BatchTransactionDialog from "@/components/BatchTransactionDialog";
import SelectMemberDialog from "@/components/SelectMemberDialog";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showBatchTransaction, setShowBatchTransaction] = useState(false);
  const [showSelectMember, setShowSelectMember] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

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

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const memberList = await base44.entities.Member.list('-created_date');
      return memberList.sort((a, b) => {
        const totalA = (a.balance || 0) + (a.cash_balance || 0);
        const totalB = (b.balance || 0) + (b.cash_balance || 0);
        return totalB - totalA;
      });
    }
  });

  // Check if current user is linked to any member
  useEffect(() => {
    if (currentUser && allMembers.length > 0) {
      const isLinked = allMembers.some(member => 
        member.user_emails && member.user_emails.includes(currentUser.email)
      );
      if (!isLinked) {
        setShowSelectMember(true);
      }
    }
  }, [currentUser, allMembers]);

  // Filter active members with non-zero balance for display
  const members = allMembers.filter(m => 
    m.is_active !== false && 
    ((m.balance || 0) !== 0 || (m.cash_balance || 0) !== 0)
  );

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 5)
  });

  const createMember = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const createTransaction = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const handleAddMember = async (memberData) => {
    await createMember.mutateAsync(memberData);
  };

  const handleTransaction = async (transactionData) => {
    const { type, amount, from_member_id, to_member_id, wallet_type, note } = transactionData;

    const fromMember = allMembers.find((m) => m.id === from_member_id);
    const toMember = allMembers.find((m) => m.id === to_member_id);
    const balanceField = wallet_type === 'cash' ? 'cash_balance' : 'balance';

    // Create transaction record
    await createTransaction.mutateAsync({
      type,
      amount,
      wallet_type,
      from_member_id,
      to_member_id,
      from_member_name: fromMember?.name || '',
      to_member_name: toMember?.name || '',
      note
    });

    // Update balances
    if (type === 'deposit' && toMember) {
      await updateMember.mutateAsync({
        id: to_member_id,
        data: { [balanceField]: (toMember[balanceField] || 0) + amount }
      });
    } else if (type === 'withdraw' && fromMember) {
      await updateMember.mutateAsync({
        id: from_member_id,
        data: { [balanceField]: (fromMember[balanceField] || 0) - amount }
      });
    } else if (type === 'transfer' && fromMember && toMember) {
      await updateMember.mutateAsync({
        id: from_member_id,
        data: { [balanceField]: (fromMember[balanceField] || 0) - amount }
      });
      await updateMember.mutateAsync({
        id: to_member_id,
        data: { [balanceField]: (toMember[balanceField] || 0) + amount }
      });
    }
  };

  const handleBatchTransaction = async (transactions) => {
    // Process all transactions
    for (const item of transactions) {
      const member = allMembers.find((m) => m.id === item.member_id);
      if (!member) continue;

      const isDeposit = item.type === 'deposit';
      const balanceField = item.wallet_type === 'cash' ? 'cash_balance' : 'balance';

      // Create transaction record
      await createTransaction.mutateAsync({
        type: item.type,
        amount: item.amount,
        wallet_type: item.wallet_type,
        from_member_id: isDeposit ? null : item.member_id,
        to_member_id: isDeposit ? item.member_id : null,
        from_member_name: isDeposit ? '' : member.name,
        to_member_name: isDeposit ? member.name : '',
        note: item.note
      });

      // Update balance
      const newBalance = isDeposit 
        ? (member[balanceField] || 0) + item.amount
        : (member[balanceField] || 0) - item.amount;
      
      await updateMember.mutateAsync({
        id: item.member_id,
        data: { [balanceField]: newBalance }
      });
    }
  };

  const handleSelectMember = async (memberId) => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !currentUser) return;

    const updatedEmails = [...(member.user_emails || []), currentUser.email];
    await updateMember.mutateAsync({
      id: memberId,
      data: { user_emails: updatedEmails }
    });
    setShowSelectMember(false);
  };

  const totalBalance = allMembers.reduce((sum, m) => sum + (m.balance || 0) + (m.cash_balance || 0), 0);

  // Find current user's member
  const currentMember = allMembers.find(m => 
    m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-slate-900" />
                  </div>
                  <h1 className="text-2xl font-bold tracking-tight">RC Pay</h1>
                </div>
                <p className="text-slate-400 text-sm">團隊小金庫管理系統</p>
              </div>
              <div className="h-12 w-px bg-slate-700" />
              <Link to={createPageUrl('GroupBuy')}>
                <Button className="bg-purple-600 hover:bg-purple-700 text-white">
                  <ShoppingCart className="w-5 h-5 mr-2" />
                  團購專區
                </Button>
              </Link>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="text-white hover:bg-white hover:text-slate-900">
                  <Settings className="w-5 h-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {currentMember && (
                  <Link to={createPageUrl('MemberDetail') + '?id=' + currentMember.id}>
                    <DropdownMenuItem>
                      <User className="w-4 h-4 mr-2" />
                      個人資料
                    </DropdownMenuItem>
                  </Link>
                )}
                <Link to={createPageUrl('MemberManagement')}>
                  <DropdownMenuItem>
                    <Settings className="w-4 h-4 mr-2" />
                    成員管理
                  </DropdownMenuItem>
                </Link>
                <DropdownMenuItem onClick={() => base44.auth.logout()}>
                  <LogOut className="w-4 h-4 mr-2" />
                  登出
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Link to={createPageUrl('FoodOrder')}>
            <Button className="w-full bg-emerald-600 text-white px-2 py-2 text-xs md:text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap transition-colors shadow h-12 md:h-14 hover:bg-emerald-700">
              <UtensilsCrossed className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline md:mr-0">七分飽訂餐</span>
              <span className="sm:hidden">訂餐</span>
            </Button>
          </Link>
          <Link to={createPageUrl('DrinkOrder')}>
            <Button className="w-full bg-blue-600 text-white px-2 py-2 text-xs md:text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap transition-colors shadow h-12 md:h-14 hover:bg-blue-700">
              <Coffee className="w-4 h-4 md:w-5 md:h-5" />
              <span className="hidden sm:inline md:mr-0">訂飲料</span>
              <span className="sm:hidden">飲料</span>
            </Button>
          </Link>
          <Button
            onClick={() => setShowTransaction(true)}
            className="bg-amber-500 text-slate-900 px-2 py-2 text-xs md:text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap transition-colors shadow h-12 md:h-14 hover:bg-amber-600"
            disabled={allMembers.length === 0}
          >
            <Plus className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">新增交易（單筆）</span>
            <span className="sm:hidden">單筆</span>
          </Button>
          <Button
            onClick={() => setShowBatchTransaction(true)}
            className="bg-red-500 text-white px-2 py-2 text-xs md:text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-1 md:gap-2 whitespace-nowrap transition-colors shadow h-12 md:h-14 hover:bg-red-600"
            disabled={allMembers.length === 0}
          >
            <Users className="w-4 h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">新增交易（多筆）</span>
            <span className="sm:hidden">多筆</span>
          </Button>
        </div>

        {/* Members Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">成員餘額</h2>
          </div>
          
          {membersLoading ?
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) =>
            <Card key={i} className="p-4 animate-pulse">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-slate-200" />
                    <div className="flex-1">
                      <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                      <div className="h-5 bg-slate-200 rounded w-16" />
                    </div>
                  </div>
                </Card>
            )}
            </div> :
          members.length === 0 ?
          <Card className="p-8 text-center border-dashed">
              <UserPlus className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚未新增成員</p>
              <p className="text-slate-400 text-sm mt-1">點擊上方按鈕開始新增</p>
            </Card> :

          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 gap-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}>

              <AnimatePresence>
                {members.map((member) =>
              <motion.div
                key={member.id}
                variants={{
                  hidden: { opacity: 0, y: 20 },
                  visible: { opacity: 1, y: 0 }
                }}>

                    <MemberCard member={member} />
                  </motion.div>
              )}
              </AnimatePresence>
            </motion.div>
          }
        </section>

        {/* Transactions Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-800">最近交易</h2>
            </div>
            <Link to={createPageUrl('TransactionHistory')}>
              <Button variant="ghost" size="sm" className="text-slate-800 hover:text-slate-900">
                查看全部 →
              </Button>
            </Link>
          </div>
          
          {transactionsLoading ?
          <div className="space-y-3">
              {[1, 2, 3].map((i) =>
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
            )}
            </div> :
          transactions.length === 0 ?
          <Card className="p-8 text-center border-dashed">
              <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500">尚無交易紀錄</p>
            </Card> :

          <motion.div
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.03 } }
            }}>

              {transactions.map((transaction) =>
            <motion.div
              key={transaction.id}
              variants={{
                hidden: { opacity: 0, x: -20 },
                visible: { opacity: 1, x: 0 }
              }}>

                  <TransactionItem transaction={transaction} />
                </motion.div>
            )}
            </motion.div>
          }
        </section>
      </div>

      {/* Dialogs */}
      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        onAdd={handleAddMember} />

      <TransactionDialog
        open={showTransaction}
        onOpenChange={setShowTransaction}
        members={allMembers}
        onTransaction={handleTransaction} />

      <BatchTransactionDialog
        open={showBatchTransaction}
        onOpenChange={setShowBatchTransaction}
        members={allMembers}
        onBatchTransaction={handleBatchTransaction} />

      <SelectMemberDialog
        open={showSelectMember}
        members={allMembers}
        currentUserEmail={currentUser?.email}
        onSelect={handleSelectMember} />

      </div>);

      }