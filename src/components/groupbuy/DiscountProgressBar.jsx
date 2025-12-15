import React from 'react';
import { Progress } from "@/components/ui/progress";
import { TrendingUp } from "lucide-react";

export default function DiscountProgressBar({ discountRules, currentQuantity }) {
  if (!discountRules || discountRules.length === 0) {
    return null;
  }

  // Sort rules by min_quantity
  const sortedRules = [...discountRules].sort((a, b) => a.min_quantity - b.min_quantity);
  
  // Find current tier and next tier
  let currentTier = null;
  let nextTier = null;
  
  for (let i = 0; i < sortedRules.length; i++) {
    if (currentQuantity >= sortedRules[i].min_quantity) {
      currentTier = sortedRules[i];
    } else {
      nextTier = sortedRules[i];
      break;
    }
  }

  // If no next tier, we've reached the maximum
  if (!nextTier) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-4 h-4 text-green-600" />
          <span className="text-sm font-semibold text-green-800">
            🎉 已達最高折扣！{currentTier.discount_percent}% off
          </span>
        </div>
        <Progress value={100} className="h-2" />
        <p className="text-xs text-green-700 mt-2">
          目前總數量：{currentQuantity} 件
        </p>
      </div>
    );
  }

  // Calculate progress towards next tier
  const prevTierQty = currentTier ? currentTier.min_quantity : 0;
  const nextTierQty = nextTier.min_quantity;
  const progress = Math.min(((currentQuantity - prevTierQty) / (nextTierQty - prevTierQty)) * 100, 100);
  const remaining = Math.max(nextTierQty - currentQuantity, 0);

  return (
    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-purple-600" />
          <span className="text-sm font-semibold text-purple-800">
            {currentTier ? `目前 ${currentTier.discount_percent}% off` : '折扣進度'}
          </span>
        </div>
        <span className="text-xs font-medium text-purple-700">
          再 {remaining} 件達 {nextTier.discount_percent}% off
        </span>
      </div>
      <Progress value={progress} className="h-2" />
      <div className="flex justify-between text-xs text-purple-700 mt-2">
        <span>目前：{currentQuantity} 件</span>
        <span>目標：{nextTierQty} 件</span>
      </div>
    </div>
  );
}