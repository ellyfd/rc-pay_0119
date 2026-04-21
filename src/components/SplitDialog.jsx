import React, { useState, useMemo } from "react";
import { getShortName } from "@/components/utils/nameUtils";

/**
 * 分攤對話框元件
 *
 * Props:
 *  - item: { item_name, price }
 *  - currentMember: { id, name }
 *  - allMembers: array of { id, name }
 *  - onConfirm: (result) => void  // result: array of { member_id, member_name, quantity, price }
 *  - onClose: () => void
 */
function SplitDialog({ item, currentMember, allMembers, onConfirm, onClose }) {
  const [quantities, setQuantities] = useState({ [currentMember?.id]: 1 });

  // Derive safe values before any conditional logic
  const itemPrice = item?.price ?? 0;
  const otherMembers = (allMembers || []).filter((m) => m.id !== currentMember?.id);

  const totalQty = useMemo(
    () => Object.values(quantities).reduce((s, q) => s + q, 0),
    [quantities]
  );

  const unitPrice = totalQty > 0 ? itemPrice / totalQty : 0;

  const setQty = (memberId, qty) => {
    setQuantities((prev) => {
      const next = { ...prev };
      if (qty <= 0) {
        if (memberId === currentMember?.id) {
          next[memberId] = 1;
        } else {
          delete next[memberId];
        }
      } else {
        next[memberId] = qty;
      }
      return next;
    });
  };

  const participatingMembers = useMemo(() => {
    return Object.entries(quantities)
      .filter(([, q]) => q > 0)
      .map(([id, qty]) => {
        const member = (allMembers || []).find((m) => m.id === id);
        return {
          member_id: id,
          member_name: member?.name || "",
          quantity: qty,
          price: Math.round(unitPrice * qty),
        };
      });
  }, [quantities, unitPrice, allMembers]);

  const adjustedMembers = useMemo(() => {
    if (participatingMembers.length === 0) return [];
    const sum = participatingMembers.reduce((s, m) => s + m.price, 0);
    const diff = itemPrice - sum;
    const result = [...participatingMembers];
    if (diff !== 0) {
      result[0] = { ...result[0], price: result[0].price + diff };
    }
    return result;
  }, [participatingMembers, itemPrice]);

  // Early return AFTER all hooks
  if (!item || !currentMember) return null;

  const handleConfirm = () => {
    if (participatingMembers.length <= 1) return;
    onConfirm(adjustedMembers);
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[60] flex items-end sm:items-center justify-center">
      <div className="w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col animate-in slide-in-from-bottom duration-200">
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-bold text-slate-800">分攤項目</h3>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* 項目資訊 */}
          <div className="flex items-center justify-between bg-orange-50 rounded-xl px-4 py-3">
            <div>
              <div className="font-semibold text-slate-800">{item.item_name}</div>
              <div className="text-sm text-slate-500 mt-0.5">
                共 {totalQty} 份 · 每份 ${Math.round(unitPrice)}
              </div>
            </div>
            <div className="text-xl font-bold text-orange-600">${itemPrice}</div>
          </div>
        </div>

        {/* 成員列表 */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-3">
          {/* 原成員（本人） */}
          <div className="mb-2">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              本人
            </div>
            <MemberRow
              name={getShortName(currentMember.name)}
              quantity={quantities[currentMember.id] || 1}
              amount={Math.round(unitPrice * (quantities[currentMember.id] || 1))}
              onDecrease={() =>
                setQty(currentMember.id, (quantities[currentMember.id] || 1) - 1)
              }
              onIncrease={() =>
                setQty(currentMember.id, (quantities[currentMember.id] || 1) + 1)
              }
              isCurrentMember
            />
          </div>

          {/* 其他成員 */}
          <div>
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 mt-4">
              其他成員
            </div>
            <div className="space-y-1.5">
              {otherMembers.map((member) => {
                const qty = quantities[member.id] || 0;
                return (
                  <MemberRow
                    key={member.id}
                    name={getShortName(member.name)}
                    quantity={qty}
                    amount={qty > 0 ? Math.round(unitPrice * qty) : null}
                    onDecrease={() => setQty(member.id, qty - 1)}
                    onIncrease={() => setQty(member.id, qty + 1)}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部預覽 & 確認 */}
        <div className="border-t border-slate-100 px-5 py-4 space-y-3">
          {participatingMembers.length > 1 && (
            <div className="flex flex-wrap gap-1.5">
              {adjustedMembers.map((m) => (
                <span
                  key={m.member_id}
                  className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded-full px-2.5 py-1"
                >
                  <span className="font-medium">{getShortName(m.member_name)}</span>
                  <span className="text-green-500">×{m.quantity}</span>
                  <span className="font-semibold">${m.price}</span>
                </span>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              取消
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={participatingMembers.length <= 1}
              className={`flex-1 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                participatingMembers.length > 1
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed"
              }`}
            >
              確認分攤（{participatingMembers.length} 人）
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberRow({ name, quantity, amount, onDecrease, onIncrease, isCurrentMember }) {
  const active = quantity > 0;

  return (
    <div
      className={`flex items-center justify-between rounded-xl px-3 py-2.5 transition-all ${
        active
          ? "bg-blue-50/60 border border-blue-100"
          : "bg-white border border-slate-100 hover:border-slate-200"
      }`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
            active ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"
          }`}
        >
          {name.charAt(0)}
        </div>
        <div className="min-w-0">
          <div className={`text-sm font-medium truncate ${active ? "text-slate-800" : "text-slate-500"}`}>
            {name}
            {isCurrentMember && (
              <span className="text-xs text-slate-400 ml-1">（本人）</span>
            )}
          </div>
          {active && amount != null && (
            <div className="text-xs text-orange-600 font-semibold">${amount}</div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-0.5 flex-shrink-0">
        <button
          type="button"
          onClick={onDecrease}
          disabled={isCurrentMember && quantity <= 1}
          className={`w-8 h-8 rounded-lg flex items-center justify-center text-lg font-medium transition-all ${
            isCurrentMember && quantity <= 1
              ? "text-slate-200 cursor-not-allowed"
              : active
              ? "text-blue-600 hover:bg-blue-100 active:bg-blue-200"
              : "text-slate-300 hover:bg-slate-100"
          }`}
        >
          −
        </button>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${active ? "text-blue-700" : "text-slate-300"}`}>
          {quantity}
        </div>
        <button
          type="button"
          onClick={onIncrease}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-lg font-medium text-blue-600 hover:bg-blue-100 active:bg-blue-200 transition-all"
        >
          +
        </button>
      </div>
    </div>
  );
}

export default SplitDialog;