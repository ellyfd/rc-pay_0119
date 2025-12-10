import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UserPlus, Plus, Wallet, TrendingUp, History, Users } from "lucide-react";
import MemberCard from "@/components/MemberCard";
import TransactionItem from "@/components/TransactionItem";
import AddMemberDialog from "@/components/AddMemberDialog";
import TransactionDialog from "@/components/TransactionDialog";
import BatchTransactionDialog from "@/components/BatchTransactionDialog";
import { motion, AnimatePresence } from "framer-motion";

export default function Home() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [showTransaction, setShowTransaction] = useState(false);
  const [showBatchTransaction, setShowBatchTransaction] = useState(false);
  const queryClient = useQueryClient();

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('-created_date')
  });

  const { data: transactions = [], isLoading: transactionsLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 20)
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
    const { type, amount, from_member_id, to_member_id, note } = transactionData;

    const fromMember = members.find((m) => m.id === from_member_id);
    const toMember = members.find((m) => m.id === to_member_id);

    // Create transaction record
    await createTransaction.mutateAsync({
      type,
      amount,
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
        data: { balance: (toMember.balance || 0) + amount }
      });
    } else if (type === 'withdraw' && fromMember) {
      await updateMember.mutateAsync({
        id: from_member_id,
        data: { balance: (fromMember.balance || 0) - amount }
      });
    } else if (type === 'transfer' && fromMember && toMember) {
      await updateMember.mutateAsync({
        id: from_member_id,
        data: { balance: (fromMember.balance || 0) - amount }
      });
      await updateMember.mutateAsync({
        id: to_member_id,
        data: { balance: (toMember.balance || 0) + amount }
      });
    }
  };

  const handleBatchTransaction = async (transactions) => {
    // Process all transactions
    for (const item of transactions) {
      const member = members.find((m) => m.id === item.member_id);
      if (!member) continue;

      // Create transaction record
      await createTransaction.mutateAsync({
        type: 'withdraw',
        amount: item.amount,
        from_member_id: item.member_id,
        from_member_name: member.name,
        note: item.note
      });

      // Update balance
      await updateMember.mutateAsync({
        id: item.member_id,
        data: { balance: (member.balance || 0) - item.amount }
      });
    }
  };

  const totalBalance = members.reduce((sum, m) => sum + (m.balance || 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
              <Wallet className="w-6 h-6 text-slate-900" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">RC Pay</h1>
          </div>
          <p className="text-slate-400 text-sm">團隊小金庫管理系統</p>
          
          {/* Total Stats */}
          <Card className="mt-6 bg-slate-800/50 border-slate-700 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm mb-1">總餘額</p>
                <p className="text-3xl font-bold text-amber-400">
                  ${totalBalance.toLocaleString()}
                </p>
              </div>
              <div className="text-right">
                <p className="text-slate-400 text-sm mb-1">成員數</p>
                <p className="text-2xl font-bold text-white">{members.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-8">
        {/* Action Buttons */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Button
            onClick={() => setShowAddMember(true)}
            variant="outline" className="bg-background px-4 py-2 text-sm font-medium rounded-[50px] inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-sm hover:text-accent-foreground h-14 border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50">


            <UserPlus className="w-5 h-5 mr-2" />
            新增成員
          </Button>
          <Button
            onClick={() => setShowTransaction(true)} className="bg-amber-500 text-slate-900 px-4 py-2 text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-14 hover:bg-amber-600"

            disabled={members.length === 0}>

            <Plus className="w-5 h-5 mr-2" />
            新增交易
          </Button>
          <Button
            onClick={() => setShowBatchTransaction(true)} className="bg-red-500 text-white px-4 py-2 text-sm font-semibold rounded-[50px] inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow h-14 hover:bg-red-600 col-span-2 md:col-span-1"

            disabled={members.length === 0}>

            <Users className="w-5 h-5 mr-2" />
            批次扣款
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
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
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
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">最近交易</h2>
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
        members={members}
        onTransaction={handleTransaction} />

      <BatchTransactionDialog
        open={showBatchTransaction}
        onOpenChange={setShowBatchTransaction}
        members={members}
        onBatchTransaction={handleBatchTransaction} />

    </div>);

}