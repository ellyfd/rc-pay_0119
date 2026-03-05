import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft, Clock } from "lucide-react";
import { format } from "date-fns";

export default function TransactionDialog({ open, onOpenChange, members, onTransaction, onPendingSubmitted }) {
  const [type, setType] = useState('deposit');
  const [walletType, setWalletType] = useState('balance');
  const [amount, setAmount] = useState('');
  const [fromMemberId, setFromMemberId] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { user: currentUser } = useCurrentUser();

  const resetForm = () => {
    setAmount('');
    setFromMemberId('');
    setToMemberId('');
    setNote('');
    setWalletType('balance');
  };

  const RC_EMAIL = 'bv2hh128@gmail.com';
  const isRC = currentUser?.email === RC_EMAIL;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;

    setLoading(true);

    if (isRC) {
      // Admin: direct execution
      await onTransaction({
        type,
        amount: parseFloat(amount),
        from_member_id: type === 'deposit' ? null : fromMemberId,
        to_member_id: type === 'withdraw' ? null : toMemberId,
        wallet_type: walletType,
        note,
        status: 'approved',
      });
    } else {
      // Non-admin: create pending transaction + notify RC
      const fromMember = members.find(m => m.id === fromMemberId);
      const toMember = members.find(m => m.id === toMemberId);
      const submitterName = currentUser?.full_name || currentUser?.email || '';
      const typeLabel = type === 'deposit' ? '入帳' : type === 'withdraw' ? '出帳' : '轉帳';

      const created = await base44.entities.Transaction.create({
        type,
        amount: parseFloat(amount),
        wallet_type: walletType,
        from_member_id: type === 'deposit' ? null : fromMemberId,
        to_member_id: type === 'withdraw' ? null : toMemberId,
        from_member_name: fromMember?.name || '',
        to_member_name: toMember?.name || '',
        note,
        status: 'pending',
        submitted_by_email: currentUser?.email || '',
        submitted_by_name: submitterName,
      });

      await base44.entities.Notification.create({
        recipient_email: 'bv2hh128@gmail.com',
        type: 'pending_approval',
        transaction_id: created.id,
        message: `${submitterName} 提交了一筆${typeLabel}申請 $${parseFloat(amount)}`,
        actor_name: submitterName,
        is_read: false,
      });

      if (onPendingSubmitted) onPendingSubmitted();
      setLoading(false);
      setSubmitted(true);
      return;
    }

    setLoading(false);
    resetForm();
    onOpenChange(false);
  };

  const isValid = () => {
    if (!amount || parseFloat(amount) <= 0) return false;
    if (type === 'deposit' && !toMemberId) return false;
    if (type === 'withdraw' && !fromMemberId) return false;
    if (type === 'transfer' && (!fromMemberId || !toMemberId || fromMemberId === toMemberId)) return false;
    return true;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); setSubmitted(false); } onOpenChange(v); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">新增交易</DialogTitle>
        </DialogHeader>
        
        {submitted ? (
          <div className="py-8 flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center">
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
            <div>
              <p className="text-lg font-semibold text-slate-800">已送出申請</p>
              <p className="text-sm text-slate-500 mt-1">等待 RC 審核後才會生效</p>
            </div>
            <Button
              className="w-full h-12 bg-slate-800 hover:bg-slate-900 text-white"
              onClick={() => { resetForm(); setSubmitted(false); onOpenChange(false); }}
            >
              確定
            </Button>
          </div>
        ) : (
        <Tabs value={type} onValueChange={setType} className="mt-4">
          <TabsList className="grid w-full grid-cols-3 h-14">
            <TabsTrigger value="deposit" className="flex items-center gap-2 data-[state=active]:bg-emerald-100">
              <ArrowDownCircle className="w-4 h-4" />
              入帳
            </TabsTrigger>
            <TabsTrigger value="withdraw" className="flex items-center gap-2 data-[state=active]:bg-red-100">
              <ArrowUpCircle className="w-4 h-4" />
              出帳
            </TabsTrigger>
            <TabsTrigger value="transfer" className="flex items-center gap-2 data-[state=active]:bg-blue-100">
              <ArrowRightLeft className="w-4 h-4" />
              互轉
            </TabsTrigger>
          </TabsList>
          
          <form onSubmit={handleSubmit} className="space-y-5 mt-6">
            <TabsContent value="deposit" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label className="text-slate-700">存入對象</Label>
                <Select value={toMemberId} onValueChange={setToMemberId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="選擇成員" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="withdraw" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label className="text-slate-700">扣款對象</Label>
                <Select value={fromMemberId} onValueChange={setFromMemberId}>
                  <SelectTrigger className="h-12">
                    <SelectValue placeholder="選擇成員" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>
            
            <TabsContent value="transfer" className="space-y-4 mt-0">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-700">轉出</Label>
                  <Select value={fromMemberId} onValueChange={setFromMemberId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="選擇成員" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-slate-700">轉入</Label>
                  <Select value={toMemberId} onValueChange={setToMemberId}>
                    <SelectTrigger className="h-12">
                      <SelectValue placeholder="選擇成員" />
                    </SelectTrigger>
                    <SelectContent>
                      {members.filter(m => m.id !== fromMemberId).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
            
            <div className="space-y-2">
              <Label className="text-slate-700">錢包類型</Label>
              <Select value={walletType} onValueChange={setWalletType}>
                <SelectTrigger className="h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance">錢包</SelectItem>
                  <SelectItem value="cash">現金</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-700">金額</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-14 text-2xl font-bold text-center"
                min="0"
                step="1"
              />
            </div>
            
            <div className="space-y-2">
              <Label className="text-slate-700">備註（選填）</Label>
              <div className="flex gap-2 mb-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = format(new Date(), 'yyyy/MM/dd');
                    setNote(`${today} 七分飽`);
                  }}
                  className="text-xs"
                >
                  七分飽
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = format(new Date(), 'yyyy/MM/dd');
                    setNote(`${today} 飲料`);
                  }}
                  className="text-xs"
                >
                  飲料
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const today = format(new Date(), 'yyyy/MM/dd');
                    setNote(`${today} 團購`);
                  }}
                  className="text-xs"
                >
                  團購
                </Button>
              </div>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：午餐費用、團購商品..."
                className="resize-none"
                rows={2}
              />
            </div>
            
            <Button 
              type="submit" 
              className={`w-full h-12 font-medium ${
                type === 'deposit' ? 'bg-emerald-600 hover:bg-emerald-700' :
                type === 'withdraw' ? 'bg-red-500 hover:bg-red-600' :
                'bg-blue-600 hover:bg-blue-700'
              }`}
              disabled={loading || !isValid()}
            >
              {loading ? '處理中...' : isRC ? '確認' : '送出申請'}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}