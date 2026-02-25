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

  const handleCancel = () => {
    onCancel();
  };

  const handleConfirm = async () => {
    try {
      await onConfirm();
    } catch (error) {
      toast.error(`轉帳失敗：${error.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
      <Card className="w-full max-w-sm p-6 space-y-4">
        <h3 className="font-bold text-lg">確認餘額支付</h3>
        <p className="text-sm text-slate-700">
          確定要從 <b>{confirmPayment.fromName}</b> 轉帳 
          <b className="text-orange-600"> ${confirmPayment.amount}</b> 給 
          <b>{confirmPayment.toName}</b> 嗎？
        </p>
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            className="flex-1"
            onClick={handleCancel}
            disabled={isLoading}
          >
            取消
          </Button>
          <Button 
            className="flex-1 bg-blue-600 text-white hover:bg-blue-700"
            onClick={handleConfirm}
            disabled={isLoading}
          >
            {isLoading ? '處理中...' : '確認轉帳'}
          </Button>
        </div>
      </Card>
    </div>
  );
}