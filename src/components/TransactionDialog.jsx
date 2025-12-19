import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
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
import { ArrowDownCircle, ArrowUpCircle, ArrowRightLeft } from "lucide-react";
import { format } from "date-fns";

export default function TransactionDialog({ open, onOpenChange, members, onTransaction }) {
  const [type, setType] = useState('deposit');
  const [walletType, setWalletType] = useState('balance');
  const [amount, setAmount] = useState('');
  const [fromMemberId, setFromMemberId] = useState('');
  const [toMemberId, setToMemberId] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

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

  const resetForm = () => {
    setAmount('');
    setFromMemberId('');
    setToMemberId('');
    setNote('');
    setWalletType('balance');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || parseFloat(amount) <= 0) return;
    
    setLoading(true);
    await onTransaction({
      type,
      amount: parseFloat(amount),
      from_member_id: type === 'deposit' ? null : fromMemberId,
      to_member_id: type === 'withdraw' ? null : toMemberId,
      wallet_type: walletType,
      note
    });
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800">新增交易</DialogTitle>
        </DialogHeader>
        
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
              disabled={loading || !isValid() || currentUser?.role !== 'admin'}
            >
              {loading ? '處理中...' : currentUser?.role !== 'admin' ? '僅限管理員操作' : '確認'}
            </Button>
          </form>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}