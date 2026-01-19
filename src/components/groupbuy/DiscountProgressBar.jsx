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
    const progress = Math.max(0, Math.min(100, ((currentQuantity - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
    const remaining = Math.max(0, nextThreshold - currentQuantity);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">
            {currentTier ? (
              <span className="text-green-600 font-semibold">
                數量享 {currentTier.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
              </span>
            ) : (
              <span className="text-slate-500">數量尚未達標</span>
            )}
          </span>
          <span className="text-slate-600">
            再 <span className="font-bold text-purple-600">{remaining}</span> 件達 {nextTier.discount_type === 'percent' ? `${nextTier.discount_percent}% off` : `-$${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-slate-500">
          <span>{prevThreshold} 件</span>
          <span className="font-semibold">{currentQuantity} 件</span>
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
            <span>${currentTier?.min_amount?.toLocaleString()}</span>
            <span className="font-semibold">${currentAmount.toLocaleString()}</span>
          </div>
        </div>
      );
    }

    const prevThreshold = currentTier?.min_amount || 0;
    const nextThreshold = nextTier.min_amount;
    const progress = Math.max(0, Math.min(100, ((currentAmount - prevThreshold) / (nextThreshold - prevThreshold)) * 100));
    const remaining = Math.max(0, nextThreshold - currentAmount);

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-700">
            {currentTier ? (
              <span className="text-green-600 font-semibold">
                金額享 {currentTier.discount_type === 'percent' ? `${currentTier.discount_percent}% off` : `-$${currentTier.discount_amount}`}
              </span>
            ) : (
              <span className="text-slate-500">金額尚未達標</span>
            )}
          </span>
          <span className="text-slate-600">
            再 <span className="font-bold text-purple-600">${remaining.toLocaleString()}</span> 達 {nextTier.discount_type === 'percent' ? `${nextTier.discount_percent}% off` : `-$${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-xs text-slate-500">
          <span>${prevThreshold.toLocaleString()}</span>
          <span className="font-semibold">${currentAmount.toLocaleString()}</span>
          <span>${nextThreshold.toLocaleString()}</span>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderQuantityProgress()}
      {renderAmountProgress()}
    </div>
  );
}