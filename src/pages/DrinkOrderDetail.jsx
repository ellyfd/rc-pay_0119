// P4-1：添加缺失的 useCallback import
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Trash2, Coffee, Wallet, CheckCircle, Pencil, Plus, Edit2, X, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { toast } from "sonner";
import SplitDialog from "@/components/SplitDialog";
import ConfirmPaymentDialog from "@/components/drink/ConfirmPaymentDialog";
import EditMemberOrderDialog from "@/components/drink/EditMemberOrderDialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getShortName } from "@/components/utils/nameUtils";

export default function DrinkOrderDetail() {
  const [orderId, setOrderId] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [actualCharges, setActualCharges] = useState({});
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [editItems, setEditItems] = useState([]);
  const [showSplitDialog, setShowSplitDialog] = useState(false);
  const [splitItemIndex, setSplitItemIndex] = useState(null);
  const [selectedSplitMembers, setSelectedSplitMembers] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPayment, setConfirmPayment] = useState(null);
  const [manualShipping, setManualShipping] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('id'));
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  // P1-1：用 useMemo 建立成員 Map
  const memberMap = useMemo(() => {
    return new Map(members.map(m => [m.id, m]));
  }, [members]);

  const { data: order } = useQuery({
    queryKey: ['drinkOrder', orderId],
    queryFn: async () => {
      const allOrders = await base44.entities.DrinkOrder.list();
      return allOrders.find(o => o.id === orderId);
    },
    enabled: !!orderId
  });

  // 自動均分運費到每個成員，並從已保存的 shipping_allocation 還原
  useEffect(() => {
    if (!order || !order.items) return;

    // 先從 shipping_allocation 還原（如果有的話）
    if (order.shipping_allocation) {
      try {
        const saved = JSON.parse(order.shipping_allocation);
        setManualShipping(saved);
        return;
      } catch (e) {
        // fallback 到自動均分
      }
    }

    // 自動均分
    const groups = {};
    order.items.forEach(item => {
      const key = item.member_id || item.member_name;
      if (!groups[key]) groups[key] = true;
    });
    const memberIds = Object.keys(groups);
    const count = memberIds.length;
    if (count === 0) return;

    const perMember = Math.round((order.shipping_fee || 0) / count);
    
    setManualShipping(prev => {
      const updated = { ...prev };
      memberIds.forEach(id => {
        if (updated[id] === undefined) {
          updated[id] = perMember;
        }
      });
      return updated;
    });
  }, [order?.shipping_fee, order?.shipping_allocation, order?.items?.length]);

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DrinkOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrder'] });
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('訂單已更新！');
    }
  });

  const deleteOrder = useMutation({
    mutationFn: async (id) => {
      const allTransactions = await base44.entities.Transaction.list();
      const relatedTransactions = allTransactions.filter(t => {
        if (!t.note) return false;
        const orderDateStr = format(new Date(order.order_date), 'yyyy/MM/dd');
        if (t.note.includes(`${orderDateStr} 飲料`)) {
          const memberIds = [...new Set(order.items?.map(i => i.member_id))];
          return memberIds.includes(t.from_member_id) || memberIds.includes(t.to_member_id);
        }
        return false;
      });
      
      for (const transaction of relatedTransactions) {
        await base44.entities.Transaction.delete(transaction.id);
      }
      
      return base44.entities.DrinkOrder.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('訂單及相關交易已刪除！');
      window.location.href = createPageUrl('DrinkOrder');
    }
  });

  const createTransaction = useMutation({
    mutationFn: async (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const updateOrderPayer = async (payerId) => {
    const payer = memberMap.get(payerId);
    if (!payer) return;

    await updateOrder.mutateAsync({
      id: orderId,
      data: { 
        payer_id: payerId,
        payer_name: payer.name
      }
    });
  };

  const batchUpdatePaymentMethod = async (memberIds, paymentMethod) => {
    if (!order) return;

    const updatedItems = order.items.map(item => {
      if (memberIds.includes(item.member_id)) {
        return { ...item, payment_method: paymentMethod };
      }
      return item;
    });

    await updateOrder.mutateAsync({
      id: orderId,
      data: { items: updatedItems }
    });

    setSelectedMembers([]);
    toast.success(`已為 ${memberIds.length} 位成員設定支付方式`);
  };

  // 處理餘額轉帳
  const processBalanceTransfer = async (fromMember, toMember, totalAmount, orderDate) => {
    await createTransaction.mutateAsync({
      type: 'transfer',
      amount: totalAmount,
      wallet_type: 'balance',
      from_member_id: fromMember.id,
      to_member_id: toMember.id,
      from_member_name: fromMember.name,
      to_member_name: toMember.name,
      note: `${format(new Date(orderDate), 'yyyy/MM/dd')} 飲料`
    });

    await updateMember.mutateAsync({
      id: fromMember.id,
      data: { balance: (fromMember.balance || 0) - totalAmount }
    });

    await updateMember.mutateAsync({
      id: toMember.id,
      data: { balance: (toMember.balance || 0) + totalAmount }
    });
  };

  const updateMemberPayment = async (memberId, field, value) => {
    if (!order) return;

    const updatedItems = order.items.map(item => {
      if (item.member_id === memberId) {
        return { ...item, [field]: value };
      }
      return item;
    });

    await updateOrder.mutateAsync({
      id: orderId,
      data: { items: updatedItems }
    });

    if (field === 'paid') {
      const allPaidNow = updatedItems.filter(item => item.member_id !== order.payer_id).every(item => item.paid);
      if (allPaidNow && order.status !== 'completed') {
        await updateOrder.mutateAsync({
          id: orderId,
          data: { status: 'completed' }
        });
        toast.success('訂單已結案！');
      }
    }

    if (field === 'paid' && value === true) {
      const memberItems = updatedItems.filter(item => item.member_id === memberId);
      const paymentMethod = memberItems[0]?.payment_method || 'cash';

      if (paymentMethod === 'balance') {
        if (!memberId || !order.payer_id) {
          toast.warning('請先選擇訂單支付人和成員！');
          return;
        }

        const fromMember = memberMap.get(memberId);
        const toMember = memberMap.get(order.payer_id);

        if (!fromMember || !toMember) return;

        const itemTotal = memberItems.reduce((sum, item) => sum + item.price, 0);
        const allMemberIds = [...new Set(order.items.map(i => i.member_id))];
        const totalMembers = allMemberIds.length;
        const memberShipping = manualShipping[memberId] 
          ?? (totalMembers > 0 ? Math.round((order.shipping_fee || 0) / totalMembers) : 0);

        const chargeKey = `${orderId}_${memberId}`;
        const calculatedAmount = Math.round(itemTotal + memberShipping);
        const totalAmount = actualCharges[chargeKey] ?? calculatedAmount;

        if ((fromMember.balance || 0) < totalAmount) {
          toast.error(`${fromMember.name} 餘額不足！目前餘額：$${fromMember.balance || 0}，需要：$${totalAmount}`);
          await updateOrder.mutateAsync({
            id: orderId,
            data: { 
              items: order.items.map(item => 
                item.member_id === memberId ? { ...item, paid: false } : item
              )
            }
          });
          return;
        }

        setConfirmPayment({
          memberId,
          fromName: fromMember.name,
          toName: toMember.name,
          amount: totalAmount,
          fromMember,
          toMember,
          orderDate: order.order_date
        });
        return;
      }
    }
  };

  const handleEditMember = (memberId) => {
    const memberItems = order.items.filter(item => item.member_id === memberId);
    setEditingMember(memberId);
    setEditItems(memberItems.map(item => ({ ...item })));
    setShowEditDialog(true);
  };

  const handleAddNewMember = () => {
    setEditingMember(null);
    setEditItems([{ member_id: '', member_name: '', item_name: '', price: 0, payment_method: 'cash', paid: false }]);
    setShowEditDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!editItems.every(item => item.member_id && item.item_name && item.price)) {
      toast.warning('請填寫完整資料！');
      return;
    }

    const newItems = [...order.items];
    
    if (editingMember) {
      // 編輯模式：移除舊項目，加入新項目
      const filteredItems = newItems.filter(item => item.member_id !== editingMember);
      const updatedItems = [...filteredItems, ...editItems];
      
      await updateOrder.mutateAsync({
        id: orderId,
        data: { items: updatedItems }
      });
    } else {
      // 新增模式：直接加入
      await updateOrder.mutateAsync({
        id: orderId,
        data: { items: [...newItems, ...editItems] }
      });
    }

    setShowEditDialog(false);
    setEditingMember(null);
    setEditItems([]);
    toast.success(editingMember ? '已更新成員訂單' : '已新增成員訂單');
  };

  const updateEditItem = (index, field, value) => {
    const newItems = [...editItems];
    newItems[index][field] = value;
    
    if (field === 'member_id') {
      const member = memberMap.get(value);
      if (member) {
        newItems[index].member_name = member.name;
      }
    }
    
    setEditItems(newItems);
  };

  const addEditItem = () => {
    const lastItem = editItems[editItems.length - 1];
    setEditItems([...editItems, {
      member_id: lastItem?.member_id || '',
      member_name: lastItem?.member_name || '',
      item_name: '',
      price: 0,
      payment_method: lastItem?.payment_method || 'cash',
      paid: false
    }]);
  };

  const removeEditItem = (index) => {
    if (editItems.length === 1) {
      toast.warning('至少需要保留一個項目！');
      return;
    }
    setEditItems(editItems.filter((_, i) => i !== index));
  };

  const handleSplitItem = (index) => {
    setSplitItemIndex(index);
    setShowSplitDialog(true);
  };

  const handleSplitConfirm = (result) => {
    const item = editItems[splitItemIndex];
    const newItems = editItems.filter((_, i) => i !== splitItemIndex);

    const splitItems = result.map(r => ({
      member_id: r.member_id,
      member_name: r.member_name,
      item_name: r.quantity > 1 ? `${item.item_name} x${r.quantity}` : item.item_name,
      price: r.price,
      payment_method: 'cash',
      paid: false,
    }));

    setEditItems([
      ...newItems.slice(0, splitItemIndex),
      ...splitItems,
      ...newItems.slice(splitItemIndex),
    ]);

    setShowSplitDialog(false);
    setSplitItemIndex(null);
    toast.success(`已分攤給 ${result.length} 位成員`);
  };

  // P2-1：統一 memberGroups 邏輯，一次遍歷計算 totalMembers（移到早返回前）
  const { memberGroups, totalMembers } = useMemo(() => {
    const groups = {};
    order?.items?.forEach((item, idx) => {
      const key = item.member_id || item.member_name;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push({ ...item, idx });
    });
    return { memberGroups: groups, totalMembers: Object.keys(groups).length };
  }, [order?.items]);

  // P2-3：合併運費計算邏輯（移到早返回前）
  const getMemberShipping = useCallback((memberId) => {
    if (manualShipping[memberId] !== undefined) return manualShipping[memberId];
    return totalMembers > 0 ? Math.round(((order?.shipping_fee) || 0) / totalMembers) : 0;
  }, [manualShipping, totalMembers, order?.shipping_fee]);

  if (!order) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-orange-300 border-t-orange-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  const isCompleted = order.status === 'completed';

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="bg-orange-600 text-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-3 md:py-6">
          {/* Mobile: compact single-row */}
          <div className="flex items-center gap-2 md:hidden">
            <Link to={createPageUrl('DrinkOrder')}>
              <Button variant="ghost" size="sm" className="text-white hover:bg-orange-500 -ml-2 h-8 w-8 p-0">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isCompleted ? 'bg-green-500' : 'bg-white'}`}>
              {isCompleted ? (
                <CheckCircle className="w-4 h-4 text-white" />
              ) : (
                <Coffee className="w-4 h-4 text-orange-600" />
              )}
            </div>
            <h1 className="text-lg font-bold truncate">
              {order.order_name || `${formatTaiwanTime(order.created_date, 'MM/dd HH:mm')} 訂單`}
            </h1>
          </div>
          {/* Desktop: original layout */}
          <div className="hidden md:block">
            <Link to={createPageUrl('DrinkOrder')}>
              <Button variant="ghost" className="text-white hover:bg-orange-500 -ml-2 mb-4 h-10">
                <ArrowLeft className="w-4 h-4 mr-2" />
                返回
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-500' : 'bg-white'}`}>
                {isCompleted ? (
                  <CheckCircle className="w-7 h-7 text-white" />
                ) : (
                  <Coffee className="w-7 h-7 text-orange-600" />
                )}
              </div>
              <div className="flex-1">
                {isEditingName ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editedName}
                      onChange={(e) => setEditedName(e.target.value)}
                      className="text-2xl font-bold bg-white/20 border-2 border-white/50 rounded px-3 py-1 text-white placeholder-white/70"
                      placeholder="輸入訂單名稱"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={async () => {
                        await updateOrder.mutateAsync({
                          id: orderId,
                          data: { order_name: editedName }
                        });
                        setIsEditingName(false);
                        toast.success('訂單名稱已更新');
                      }}
                      className="bg-green-500 hover:bg-green-600 text-white"
                    >
                      儲存
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingName(false)}
                      className="text-white hover:bg-white/20"
                    >
                      取消
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">
                      {order.order_name || `${formatTaiwanTime(order.created_date, 'MM/dd HH:mm')} 訂單`}
                    </h1>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditedName(order.order_name || '');
                        setIsEditingName(true);
                      }}
                      className="text-white hover:bg-white/20"
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                  </div>
                )}
                <p className="text-orange-100 text-sm mt-1">
                  {isCompleted ? '已完成' : '待付款'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="overflow-hidden">
          <div className="p-4 bg-slate-50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="text-sm text-slate-600 whitespace-nowrap">訂單支付人：</label>
                <Select value={order.payer_id || ''} onValueChange={updateOrderPayer} disabled={isCompleted}>
                  <SelectTrigger className="text-sm flex-1 min-w-0 h-8">
                    <SelectValue placeholder="選擇支付人" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map(m => (
                      <SelectItem key={m.id} value={m.id}>{getShortName(m.name)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2">
                {!isCompleted && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleAddNewMember}
                      className="bg-green-50 text-green-700 hover:bg-green-100"
                    >
                      <Plus className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">新增成員</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4 md:mr-2" />
                      <span className="hidden md:inline">刪除訂單</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>

          {!isCompleted && (
            <div className="p-3 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">
                  {selectedMembers.length > 0 
                    ? `已選取 ${selectedMembers.length} 位成員` 
                    : '勾選成員後可批量設定支付方式'}
                </span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">批量設定支付方式：</label>
                  <Select
                    onValueChange={(v) => batchUpdatePaymentMethod(selectedMembers, v)}
                    disabled={selectedMembers.length === 0}
                  >
                    <SelectTrigger className="w-[100px] h-8 text-sm">
                      <SelectValue placeholder="選擇方式" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">現金</SelectItem>
                      <SelectItem value="balance">餘額</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectedMembers.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedMembers([])}
                      className="text-xs h-7"
                    >
                      取消選取
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] text-sm table-fixed">
              <thead className="bg-slate-50">
                <tr>
                  {!isCompleted && (
                    <th className="text-center px-2 py-2 text-slate-700 w-[4%]">
                      <input
                        type="checkbox"
                        checked={(() => {
                          const memberIds = [...new Set(order.items?.map(i => i.member_id).filter(Boolean))];
                          return memberIds.length > 0 && memberIds.every(id => selectedMembers.includes(id));
                        })()}
                        onChange={(e) => {
                          const memberIds = [...new Set(order.items?.map(i => i.member_id).filter(Boolean))];
                          if (e.target.checked) {
                            setSelectedMembers([...new Set([...selectedMembers, ...memberIds])]);
                          } else {
                            setSelectedMembers(selectedMembers.filter(id => !memberIds.includes(id)));
                          }
                        }}
                        className="w-4 h-4 cursor-pointer"
                      />
                    </th>
                  )}
                  <th className="text-left px-3 py-2 text-slate-700 w-[10%]">成員</th>
                  <th className="text-left px-3 py-2 text-slate-700">項目</th>
                  <th className="text-right px-3 py-2 text-slate-700 w-[8%]">金額</th>
                  <th className="text-right px-3 py-2 text-slate-700 w-[8%]">小計</th>
                  <th className="text-right px-3 py-2 text-slate-700 w-[8%]">運費</th>
                  <th className="text-right px-3 py-2 text-slate-700 w-[10%]">應付</th>
                  <th className="text-right px-3 py-2 text-slate-700 w-[9%]">實收</th>
                  {!isCompleted && <th className="text-center px-3 py-2 text-slate-700 w-[9%]">支付方式</th>}
                  <th className="text-center px-3 py-2 text-slate-700 w-[7%]">已支付</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(memberGroups).map(([memberId, items], groupIdx) => {
                  const memberTotal = items.reduce((sum, i) => sum + i.price, 0);
                  const memberShipping = getMemberShipping(memberId);
                  const memberPaymentAmount = memberTotal + memberShipping;
                  const chargeKey = `${orderId}_${memberId}`;
                  const actualCharge = actualCharges[chargeKey] ?? Math.round(memberPaymentAmount);
                  const firstItem = items[0];
                  
                  return (
                    <React.Fragment key={groupIdx}>
                      {items.map((item, itemIdx) => (
                        <tr key={item.idx} className={itemIdx === 0 ? 'border-t-2 border-slate-300' : ''}>
                          {itemIdx === 0 && !isCompleted && (
                            <td className="px-2 py-2 text-center" rowSpan={items.length}>
                              {item.member_id && item.member_id !== order.payer_id && (
                                <input
                                  type="checkbox"
                                  checked={selectedMembers.includes(item.member_id)}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      setSelectedMembers([...selectedMembers, item.member_id]);
                                    } else {
                                      setSelectedMembers(selectedMembers.filter(id => id !== item.member_id));
                                    }
                                  }}
                                  className="w-4 h-4 cursor-pointer"
                                />
                              )}
                            </td>
                          )}
                          {itemIdx === 0 && (
                            <td className="px-3 py-2" rowSpan={items.length}>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{getShortName(item.member_name)}</span>
                                {!isCompleted && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleEditMember(item.member_id)}
                                    className="h-6 w-6 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          )}
                          <td className="px-3 py-2">{item.item_name}</td>
                          <td className="px-3 py-2 text-right">${item.price}</td>
                          {itemIdx === 0 && (
                            <>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700" rowSpan={items.length}>
                                ${memberTotal}
                              </td>
                              <td className="px-3 py-2 text-right text-slate-600" rowSpan={items.length}>
                                {isCompleted ? (
                                  <span>${getMemberShipping(memberId)}</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={manualShipping[memberId] ?? getMemberShipping(memberId)}
                                    onChange={(e) => {
                                      const newShipping = {
                                        ...manualShipping,
                                        [memberId]: parseFloat(e.target.value) || 0
                                      };
                                      setManualShipping(newShipping);
                                      // P0-4：同步儲存到 order
                                      updateOrder.mutateAsync({
                                        id: orderId,
                                        data: { shipping_allocation: JSON.stringify(newShipping) }
                                      });
                                    }}
                                    className="w-full px-2 py-1 text-right border rounded text-sm"
                                  />
                                )}
                              </td>
                              <td className="px-3 py-2 text-right font-semibold text-slate-700" rowSpan={items.length}>
                                ${memberPaymentAmount.toFixed(2)}
                              </td>
                              <td className="px-3 py-2 text-right" rowSpan={items.length}>
                                {isCompleted ? (
                                  <span className="font-bold text-orange-600">${actualCharge}</span>
                                ) : (
                                  <input
                                    type="number"
                                    value={actualCharge}
                                    onChange={(e) => {
                                      setActualCharges({ ...actualCharges, [chargeKey]: parseFloat(e.target.value) || 0 });
                                    }}
                                    className="w-full px-2 py-1 text-right font-bold text-orange-600 border border-orange-300 rounded focus:border-orange-500 focus:outline-none"
                                  />
                                )}
                              </td>
                              {item.member_id === order.payer_id ? (
                                <>
                                  {!isCompleted && (
                                    <td className="px-3 py-2 text-center text-slate-500 text-xs" rowSpan={items.length}>
                                      不需支付
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-center" rowSpan={items.length}>
                                    <span className="text-green-600 text-xs">✓ 支付人</span>
                                  </td>
                                </>
                              ) : (
                                <>
                                  {!isCompleted && (
                                    <td className="px-3 py-2" rowSpan={items.length}>
                                      <Select
                                        value={firstItem.payment_method || 'cash'}
                                        onValueChange={(v) => updateMemberPayment(item.member_id, 'payment_method', v)}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[80px]">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="cash">現金</SelectItem>
                                          <SelectItem value="balance">餘額</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </td>
                                  )}
                                  <td className="px-3 py-2 text-center" rowSpan={items.length}>
                                    {isCompleted ? (
                                      firstItem.paid ? (
                                        <CheckCircle className="w-5 h-5 text-green-600 mx-auto" />
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )
                                    ) : firstItem.payment_method === 'balance' ? (
                                      <Button
                                        size="sm"
                                        onClick={() => updateMemberPayment(item.member_id, 'paid', true)}
                                        disabled={firstItem.paid}
                                        className={`h-8 text-xs ${
                                          firstItem.paid 
                                            ? 'bg-green-100 text-green-700 cursor-not-allowed' 
                                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                                        }`}
                                      >
                                        {firstItem.paid ? (
                                          <>
                                            <CheckCircle className="w-3 h-3 mr-1" />
                                            已支付
                                          </>
                                        ) : (
                                          <>
                                            <Wallet className="w-3 h-3 mr-1" />
                                            確認支付
                                          </>
                                        )}
                                      </Button>
                                    ) : (
                                      <input
                                        type="checkbox"
                                        checked={firstItem.paid || false}
                                        onChange={(e) => updateMemberPayment(item.member_id, 'paid', e.target.checked)}
                                        className="w-4 h-4 cursor-pointer"
                                      />
                                    )}
                                  </td>
                                </>
                              )}
                            </>
                          )}
                        </tr>
                      ))}
                    </React.Fragment>
                  );
                })}
                <tr className="bg-orange-50 font-bold border-t-2">
                  <td colSpan={isCompleted ? 3 : 4} className="px-3 py-3 text-right">總計</td>
                  <td className="px-3 py-3 text-right text-slate-700">
                    ${order.items?.reduce((sum, i) => sum + i.price, 0).toLocaleString()}
                  </td>
                  <td className="px-3 py-3 text-right text-slate-600">
                    ${Object.keys(memberGroups).reduce((sum, id) => sum + (manualShipping[id] ?? getMemberShipping(id)), 0)}
                  </td>
                  <td className="px-3 py-3 text-right">-</td>
                  <td className="px-3 py-3 text-right text-orange-600 text-base">
                    ${Object.keys(memberGroups).reduce((sum, memberId) => {
                      const chargeKey = `${orderId}_${memberId}`;
                      const items = memberGroups[memberId];
                      const memberTotal = items.reduce((s, i) => s + i.price, 0);
                      const memberShipping = getMemberShipping(memberId);
                      const defaultCharge = Math.round(memberTotal + memberShipping);
                      return sum + (actualCharges[chargeKey] ?? defaultCharge);
                    }, 0).toLocaleString()}
                  </td>
                  <td colSpan={isCompleted ? 1 : 2}></td>
                </tr>
                {!isCompleted && (
                  <tr className="bg-slate-50 border-t">
                    <td colSpan={isCompleted ? 4 : 5} className="px-3 py-3 text-right text-sm text-slate-600">
                      運費/服務費總額：
                    </td>
                    <td className="px-3 py-3">
                      <Input
                        type="number"
                        value={order.shipping_fee || 0}
                        onChange={(e) => {
                          const newFee = parseFloat(e.target.value) || 0;
                          updateOrder.mutateAsync({
                            id: orderId,
                            data: { shipping_fee: newFee, shipping_allocation: JSON.stringify({}) }
                          });
                          // 重新均分
                          const count = Object.keys(memberGroups).length;
                          if (count > 0) {
                            const perMember = Math.round(newFee / count);
                            const updated = {};
                            Object.keys(memberGroups).forEach(id => { updated[id] = perMember; });
                            setManualShipping(updated);
                            // P0-4：同步儲存
                            updateOrder.mutateAsync({
                              id: orderId,
                              data: { shipping_allocation: JSON.stringify(updated) }
                            });
                          }
                        }}
                        className="w-20 text-sm text-right"
                      />
                    </td>
                    <td colSpan={2} className="px-3 py-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const count = Object.keys(memberGroups).length;
                          if (count > 0) {
                            const perMember = Math.round((order.shipping_fee || 0) / count);
                            const updated = {};
                            Object.keys(memberGroups).forEach(id => { updated[id] = perMember; });
                            setManualShipping(updated);
                            toast.success(`已均分運費，每人 $${perMember}`);
                          }
                        }}
                        className="text-xs"
                      >
                        重新均分
                      </Button>
                    </td>
                    <td colSpan={2}></td>
                  </tr>
                )}
                {isCompleted && (
                  <tr className="bg-slate-50 border-t">
                    <td colSpan={4} className="px-3 py-3 text-right text-sm text-slate-600">
                      運費/服務費總額：
                    </td>
                    <td className="px-3 py-3 text-right text-sm font-semibold">
                      ${order.shipping_fee || 0}
                    </td>
                    <td colSpan={2} className="px-3 py-3 text-xs text-slate-500">
                      {totalMembers > 0 && `均分每人 $${Math.round((order.shipping_fee || 0) / totalMembers)}`}
                    </td>
                    <td></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 編輯/新增對話框 */}
      <EditMemberOrderDialog
        showEditDialog={showEditDialog}
        editingMember={editingMember}
        editItems={editItems}
        members={members}
        memberMap={memberMap}
        onClose={() => {
          setShowEditDialog(false);
          setEditingMember(null);
          setEditItems([]);
        }}
        onSave={handleSaveEdit}
        onAddItem={addEditItem}
        onRemoveItem={removeEditItem}
        onUpdateItem={setEditItems}
        onSplitItem={handleSplitItem}
      />

      {/* 分攤項目對話框 */}
      {showSplitDialog && splitItemIndex !== null && (
        <SplitDialog
          item={editItems[splitItemIndex]}
          currentMember={{
            id: editItems[0]?.member_id,
            name: editItems[0]?.member_name
          }}
          allMembers={members}
          onConfirm={handleSplitConfirm}
          onClose={() => {
            setShowSplitDialog(false);
            setSplitItemIndex(null);
          }}
        />
      )}

      {/* 餘額支付確認對話框 */}
      <ConfirmPaymentDialog
        confirmPayment={confirmPayment}
        onCancel={() => {
          setConfirmPayment(null);
          if (confirmPayment) {
            updateOrder.mutateAsync({
              id: orderId,
              data: { 
                items: order.items.map(item => 
                  item.member_id === confirmPayment.memberId ? { ...item, paid: false } : item
                )
              }
            });
          }
        }}
        onConfirm={async () => {
          const { fromMember, toMember, amount, memberId } = confirmPayment;
          try {
            await processBalanceTransfer(fromMember, toMember, amount, order.order_date);
            toast.success(`${fromMember.name} 已轉帳 $${amount} 給 ${toMember.name}`);
            setConfirmPayment(null);
          } catch (error) {
            toast.error(`轉帳失敗：${error.message}`);
            await updateOrder.mutateAsync({
              id: orderId,
              data: { items: order.items.map(item => 
                item.member_id === memberId ? { ...item, paid: false } : item
              )}
            });
            throw error;
          }
        }}
      />

      {/* 刪除確認對話框 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確定要刪除此訂單？</AlertDialogTitle>
            <AlertDialogDescription>
              相關交易紀錄也會一併刪除，此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                deleteOrder.mutate(orderId);
                setShowDeleteConfirm(false);
              }}
              className="bg-red-500 hover:bg-red-600"
            >
              確定刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}