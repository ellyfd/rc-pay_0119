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
            <span className="text-green-600 font-semibold">
              🎉 已達最高折扣：{currentTier?.discount_type === 'percent' ? `打 ${100 - currentTier.discount_percent} 折` : `全團折 $${currentTier.discount_amount}`}
            </span>
            <span className="text-slate-600">{currentQuantity} 件</span>
          </div>
          <Progress value={100} className="h-3 bg-slate-200" />
        </div>
      );
    }

    const prevThreshold = currentTier?.min_quantity || 0;
    const nextThreshold = nextTier.min_quantity;
    const progress = ((currentQuantity - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    const remaining = nextThreshold - currentQuantity;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          {currentTier ? (
            <span className="text-green-600 font-semibold">
              ✓ {currentTier.discount_type === 'percent' ? `打 ${100 - currentTier.discount_percent} 折` : `全團折 $${currentTier.discount_amount}`}
            </span>
          ) : (
            <span className="text-slate-600">目前 {currentQuantity} 件</span>
          )}
          <span className="text-purple-600 font-semibold">
            再 {remaining} 件 → {nextTier.discount_type === 'percent' ? `打 ${100 - nextTier.discount_percent} 折` : `全團折 $${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={Math.min(progress, 100)} className="h-3 bg-slate-200" />
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
            <span className="text-green-600 font-semibold">
              🎉 已達最高折扣：{currentTier?.discount_type === 'percent' ? `打 ${100 - currentTier.discount_percent} 折` : `全團折 $${currentTier.discount_amount}`}
            </span>
            <span className="text-slate-600">${currentAmount.toLocaleString()}</span>
          </div>
          <Progress value={100} className="h-3 bg-slate-200" />
        </div>
      );
    }

    const prevThreshold = currentTier?.min_amount || 0;
    const nextThreshold = nextTier.min_amount;
    const progress = ((currentAmount - prevThreshold) / (nextThreshold - prevThreshold)) * 100;
    const remaining = nextThreshold - currentAmount;

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          {currentTier ? (
            <span className="text-green-600 font-semibold">
              ✓ {currentTier.discount_type === 'percent' ? `打 ${100 - currentTier.discount_percent} 折` : `全團折 $${currentTier.discount_amount}`}
            </span>
          ) : (
            <span className="text-slate-600">目前 ${currentAmount.toLocaleString()}</span>
          )}
          <span className="text-purple-600 font-semibold">
            再 ${remaining.toLocaleString()} → {nextTier.discount_type === 'percent' ? `打 ${100 - nextTier.discount_percent} 折` : `全團折 $${nextTier.discount_amount}`}
          </span>
        </div>
        <Progress value={Math.min(progress, 100)} className="h-3 bg-slate-200" />
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