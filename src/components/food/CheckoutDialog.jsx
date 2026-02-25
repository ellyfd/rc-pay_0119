import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Wallet, CheckCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";

// P2-12: 改用共用常數
const RICE_OPTION_LABELS = {
  normal: '正常飯量',
  less_rice: '飯少',
  rice_to_veg: '飯換菜'
};

export default function CheckoutDialog({ open, onOpenChange, cart, members, totalAmount, onComplete }) {
  const [memberId, setMemberId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('balance');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const queryClient = useQueryClient();

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.Order.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
    }
  });

  const createOrderItem = useMutation({
    mutationFn: (data) => base44.entities.OrderItem.create(data),
  });

  const createTransaction = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!memberId) return;

    setLoading(true);
    
    try {
      // P0-10: 扣款前重新讀取最新餘額，避免競態條件
      const freshMembers = await base44.entities.Member.list('name');
      const freshMember = freshMembers.find(m => m.id === memberId);
      
      if (!freshMember) {
        throw new Error('找不到成員');
      }

      // 檢查餘額（扣款前）
      if (paymentMethod === 'balance' && freshMember.balance < totalAmount) {
        throw new Error(`${freshMember.name} 餘額不足！目前：$${freshMember.balance}`);
      }

      // Create order
      const order = await createOrder.mutateAsync({
        member_id: memberId,
        member_name: freshMember.name,
        total_amount: totalAmount,
        payment_method: paymentMethod,
        status: 'completed',
        order_date: format(new Date(), 'yyyy-MM-dd'),
        note
      });

      // Create order items (P0-13: 包裹在 try-catch 中)
      for (const item of cart) {
        await createOrderItem.mutateAsync({
          order_id: order.id,
          product_id: item.product_id,
          product_name: item.product_name,
          price: item.price,
          quantity: item.quantity,
          rice_option: item.rice_option,
          note: ''
        });
      }

      // If payment method is balance, deduct from member balance and create transaction
      if (paymentMethod === 'balance') {
        // P0-11: 補上 wallet_type 欄位
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: totalAmount,
          wallet_type: 'balance',
          from_member_id: memberId,
          from_member_name: freshMember.name,
          note: `七分飽訂餐 - ${note || '午餐'}`
        });

        // P0-10: 用最新餘額計算
        await updateMember.mutateAsync({
          id: memberId,
          data: { balance: freshMember.balance - totalAmount }
        });
      }

      setMemberId('');
      setPaymentMethod('balance');
      setNote('');
      onComplete();
    } catch (error) {
      console.error('訂單建立失敗:', error);
      // toast.error 由父元件處理
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const selectedMember = members.find(m => m.id === memberId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CheckCircle className="w-5 h-5" />
            結帳
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Order Summary */}
          <div>
            <Label className="text-slate-700 mb-2 block">訂購內容</Label>
            <Card className="p-4 bg-slate-50 max-h-48 overflow-y-auto">
              <div className="space-y-2">
                {cart.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <div className="flex-1">
                      <span className="text-slate-800">{item.product_name}</span>
                      {item.category === 'meal_box' && item.rice_option !== 'normal' && (
                        <Badge variant="outline" className="ml-2 text-xs">
                          {RICE_OPTION_LABELS[item.rice_option]}
                        </Badge>
                      )}
                      <span className="text-slate-500 ml-2">x{item.quantity}</span>
                    </div>
                    <span className="text-slate-700 font-medium">NT${(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Total */}
          <Card className="p-4 bg-emerald-50 border-emerald-200">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold text-slate-800">總金額</span>
              <span className="text-2xl font-bold text-emerald-600">
                NT${totalAmount.toLocaleString()}
              </span>
            </div>
          </Card>

          {/* Member Selection */}
          <div className="space-y-2">
            <Label className="text-slate-700">訂購人</Label>
            <Select value={memberId} onValueChange={setMemberId}>
              <SelectTrigger className="h-12">
                <SelectValue placeholder="選擇成員" />
              </SelectTrigger>
              <SelectContent>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} - 餘額: ${member.balance?.toLocaleString() || 0}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Payment Method */}
          <div className="space-y-3">
            <Label className="text-slate-700">付款方式</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="balance" id="balance" />
                <Label htmlFor="balance" className="flex-1 cursor-pointer flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-emerald-600" />
                  <div>
                    <p className="font-medium">扣除餘額</p>
                    {selectedMember && (
                      <p className="text-sm text-slate-500">
                        目前餘額: ${selectedMember.balance?.toLocaleString() || 0}
                        {selectedMember.balance < totalAmount && (
                          <span className="text-red-500 ml-2">（餘額不足）</span>
                        )}
                      </p>
                    )}
                  </div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-4 rounded-lg border hover:bg-slate-50 cursor-pointer">
                <RadioGroupItem value="cash" id="cash" />
                <Label htmlFor="cash" className="flex-1 cursor-pointer flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  <div>
                    <p className="font-medium">另外付現</p>
                    <p className="text-sm text-slate-500">不扣除餘額</p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Note */}
          <div className="space-y-2">
            <Label className="text-slate-700">備註（選填）</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例如：午餐、外送地址等..."
              className="resize-none"
              rows={2}
            />
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-semibold"
            disabled={loading || !memberId || (paymentMethod === 'balance' && selectedMember?.balance < totalAmount)}
          >
            {loading ? '處理中...' : '確認訂購'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}