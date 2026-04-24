import React from 'react';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

// P3-1：提取支付確認對話框為獨立元件
export default function ConfirmPaymentDialog({ 
  confirmPayment, 
  onCancel, 
  onConfirm,
  isLoading 
}) {
  if (!confirmPayment) return null;

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      toast.error(`轉帳失敗：${error.message}`);
    }
  };

  const insufficient = confirmPayment.insufficientBalance;
  const currentBalance = confirmPayment.fromMember?.balance || 0;
  const shortage = confirmPayment.amount - currentBalance;

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-lg">
          {insufficient ? '餘額不足' : '確認餘額支付'}
        </h3>
        {insufficient && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
            <div>
              <b>{confirmPayment.fromName}</b> 餘額不足，目前餘額：
              <b> ${currentBalance.toLocaleString()}</b>
            </div>
            <div>
              需要：<b>${confirmPayment.amount.toLocaleString()}</b>
              ，不足 <b>${shortage.toLocaleString()}</b>
            </div>
            <div className="text-xs text-red-600 pt-1">
              若按「扣款」將會把餘額扣到負數。
            </div>
          </div>
        )}
        <p className="text-sm text-slate-700">
          確定要從 <b>{confirmPayment.fromName}</b>
          {confirmPayment.proxyFor && (
            <> （代 <b>{confirmPayment.proxyFor}</b> 付款）</>
          )}
          {' '}轉帳
          <b className="text-orange-600"> ${confirmPayment.amount}</b> 給
          <b> {confirmPayment.toName}</b> 嗎？
        </p>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancel}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button
            className={`flex-1 text-white ${
              insufficient
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? '處理中...' : insufficient ? '扣款' : '確認轉帳'}
          </Button>
        </div>
      </Card>
    </div>
  );
}