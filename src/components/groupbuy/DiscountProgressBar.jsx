import React from 'react';
import { Progress } from "@/components/ui/progress";

export default function DiscountProgressBar({ discountRules, currentQuantity, currentAmount }) {
  if (!discountRules || discountRules.length === 0) return null;

  // Separate and sort rules by type
  const quantityRules = discountRules.filter(r => r.type === 'quantity').sort((a, b) => a.min_quantity - b.min_quantity);
  const amountRules = discountRules.filter(r => r.type === 'amount').sort((a, b) => a.min_amount - b.min_amount);

  // Render quantity-based progress bar
  const renderQuantityProgress = () => {
    if (quantityRules.length === 0) return null;

    const currentTier = quantityRules.filter(rule => currentQuantity >= rule.min_quantity).pop();
    const nextTier = quantityRules.find(rule => currentQuantity < rule.min_quantity);

    if (!nextTier) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-600 font-semibold">🎉 已達數量最高折扣！</span>
            <span className="text-green-600 font-bold">
              {currentTier?.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
            </span>
          </div>
          <Progress value={100} className="h-2" />
          <div className="flex justify-between text-xs text-slate-500">
            <span>目前總數量：{currentQuantity} 件</span>
          </div>
        </div>
      );
    }

    const prevThreshold = currentTier?.min_quantity || 0;
    const nextThreshold = nextTier.min_quantity;
    const progress = ((currentQuantity - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    const remaining = nextThreshold - currentQuantity;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {currentTier && (
            <span className="text-green-700 font-semibold">
              全團享 {currentTier.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
            </span>
          )}
          <span className="text-amber-700">
            再 <span className="font-bold">{remaining}</span> 件達 {nextTier.discount_type === 'percent' ? `${nextTier.discount_percent}% off` : `-$${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={Math.min(progress, 100)} className="h-2.5" />
        <div className="flex justify-between text-xs text-slate-600">
          <span>{currentQuantity} 件</span>
          <span>{nextThreshold} 件</span>
        </div>
      </div>
    );
  };

  // Render amount-based progress bar
  const renderAmountProgress = () => {
    if (amountRules.length === 0 || currentAmount === undefined) return null;

    const currentTier = amountRules.filter(rule => currentAmount >= rule.min_amount).pop();
    const nextTier = amountRules.find(rule => currentAmount < rule.min_amount);

    if (!nextTier) {
      return (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-green-600 font-semibold">🎉 已達金額最高折扣！</span>
            <span className="text-green-600 font-bold">
              {currentTier?.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
            </span>
          </div>
          <Progress value={100} className="h-2" />
          <div className="flex justify-between text-xs text-slate-500">
            <span>目前總金額：${currentAmount.toLocaleString()}</span>
          </div>
        </div>
      );
    }

    const prevThreshold = currentTier?.min_amount || 0;
    const nextThreshold = nextTier.min_amount;
    const progress = ((currentAmount - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    const remaining = nextThreshold - currentAmount;

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          {currentTier && (
            <span className="text-green-700 font-semibold">
              全團享 {currentTier.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
            </span>
          )}
          <span className="text-amber-700">
            再 <span className="font-bold">${remaining.toLocaleString()}</span> 達 {nextTier.discount_type === 'percent' ? `${nextTier.discount_percent}% off` : `-$${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={Math.min(progress, 100)} className="h-2.5" />
        <div className="flex justify-between text-xs text-slate-600">
          <span>${currentAmount.toLocaleString()}</span>
          <span>${nextThreshold.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {renderQuantityProgress()}
      {renderAmountProgress()}
    </div>
  );
}