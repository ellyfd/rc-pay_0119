import React, { useState, useEffect, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
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
  const [confirmPayment, setConfirmPayment] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('id'));
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  // 建立成員 Map 以提高查找效率
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
      const orderDateStr = format(new Date(order.order_date), 'yyyy/MM/dd');
      const relatedTransactions = allTransactions.filter(t => 
        t.note && t.note.includes(`${orderDateStr} 飲料`)
      );
      
      for (const transaction of relatedTransactions) {
        const memberIds = [...new Set(order.items?.map(i => i.member_id))];
        if (memberIds.includes(transaction.from_member_id) || memberIds.includes(transaction.to_member_id)) {
          await base44.entities.Transaction.delete(transaction.id);
        }
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
        const shippingPerMember = totalMembers > 0 ? (order.shipping_fee || 0) / totalMembers : 0;

        const chargeKey = `${orderId}_${memberId}`;
        const calculatedAmount = Math.round(itemTotal + shippingPerMember);
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
    setSelectedSplitMembers([]);
    setShowSplitDialog(true);
  };

  const confirmSplit = () => {
    if (selectedSplitMembers.length === 0) {
      toast.warning('請選擇至少一位成員！');
      return;
    }

    const item = editItems[splitItemIndex];
    const pricePerPerson = item.price / (selectedSplitMembers.length + 1); // +1 包含原成員

    // 移除原項目
    const newItems = editItems.filter((_, i) => i !== splitItemIndex);

    // 為每個選中的成員添加項目
    const splitItems = selectedSplitMembers.map(memberId => {
      const member = memberMap.get(memberId);
      return {
        member_id: memberId,
        member_name: member?.name || '',
        item_name: item.item_name,
        price: Math.round(pricePerPerson),
        payment_method: 'cash',
        paid: false
      };
    });

    // 更新原成員的價格
    const updatedOriginalItem = {
      ...item,
      price: Math.round(pricePerPerson)
    };

    setEditItems([...newItems.slice(0, splitItemIndex), updatedOriginalItem, ...newItems.slice(splitItemIndex), ...splitItems]);
    setShowSplitDialog(false);
    setSplitItemIndex(null);
    setSelectedSplitMembers([]);
    toast.success(`已將項目平分給 ${selectedSplitMembers.length + 1} 位成員`);
  };

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
  
  const memberGroups = {};
  order.items?.forEach((item, idx) => {
    const key = item.member_id || item.member_name;
    if (!memberGroups[key]) {
      memberGroups[key] = [];
    }
    memberGroups[key].push({ ...item, idx });
  });

  const totalMembers = Object.keys(memberGroups).length;
  const shippingPerMember = totalMembers > 0 ? (order.shipping_fee || 0) / totalMembers : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="bg-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('DrinkOrder')}>
            <Button variant="ghost" className="text-white hover:bg-orange-500 -ml-2 mb-4">
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

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="overflow-hidden">
          <div className="p-4 bg-slate-50 border-b">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <label className="text-sm text-slate-600 whitespace-nowrap">訂單支付人：</label>
                <select
                  value={order.payer_id || ''}
                  onChange={(e) => updateOrderPayer(e.target.value)}
                  className="px-2 py-1 border rounded text-sm flex-1 min-w-0"
                  disabled={isCompleted}
                >
                  <option value="">選擇支付人</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 whitespace-nowrap">運費/服務費：</label>
                <Input
                  type="number"
                  value={order.shipping_fee || 0}
                  onChange={(e) => {
                    updateOrder.mutateAsync({
                      id: orderId,
                      data: { shipping_fee: parseFloat(e.target.value) || 0 }
                    });
                  }}
                  className="w-24 text-sm"
                  disabled={isCompleted}
                />
                <span className="text-xs text-slate-500">
                  （均分每人 ${shippingPerMember.toFixed(0)}）
                </span>
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
                      onClick={() => {
                        if (window.confirm('確定要刪除此訂單？相關交易紀錄也會一併刪除。')) {
                          deleteOrder.mutate(orderId);
                        }
                      }}
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

          {selectedMembers.length > 0 && !isCompleted && (
            <div className="p-3 bg-blue-50 border-b">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-700">已選取 {selectedMembers.length} 位成員</span>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-slate-600">批量設定支付方式：</label>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        batchUpdatePaymentMethod(selectedMembers, e.target.value);
                      }
                    }}
                    defaultValue=""
                    className="px-2 py-1 border rounded text-sm"
                  >
                    <option value="">選擇方式</option>
                    <option value="cash">現金</option>
                    <option value="balance">餘額</option>
                  </select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedMembers([])}
                    className="text-xs h-7"
                  >
                    取消選取
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className={`w-full ${order.shipping_fee > 0 ? 'min-w-[900px]' : 'min-w-[800px]'} text-sm`}>
              <thead className="bg-slate-50">
                <tr>
                  {!isCompleted && (
                    <th className="text-center px-2 py-2 text-slate-700 w-12">
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
                  <th className="text-left px-3 py-2 text-slate-700">成員</th>
                  <th className="text-left px-3 py-2 text-slate-700">項目</th>
                  <th className="text-right px-3 py-2 text-slate-700">金額</th>
                  <th className="text-right px-3 py-2 text-slate-700">小計</th>
                  {order.shipping_fee > 0 && (
                    <>
                      <th className="text-right px-3 py-2 text-slate-700">運費</th>
                      <th className="text-right px-3 py-2 text-slate-700">小結</th>
                      <th className="text-right px-3 py-2 text-slate-700">實際收費</th>
                    </>
                  )}
                  {!isCompleted && <th className="text-left px-3 py-2 text-slate-700">支付方式</th>}
                  <th className="text-center px-3 py-2 text-slate-700">已支付</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(memberGroups).map(([memberId, items], groupIdx) => {
                  const memberTotal = items.reduce((sum, i) => sum + i.price, 0);
                  const memberPaymentAmount = memberTotal + shippingPerMember;
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
                                <span className="font-medium">{item.member_name}</span>
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
                              {order.shipping_fee > 0 && (
                                <>
                                  <td className="px-3 py-2 text-right text-slate-600" rowSpan={items.length}>
                                    ${shippingPerMember.toFixed(2)}
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
                                        className="w-16 px-2 py-1 text-right font-bold text-orange-600 border border-orange-300 rounded focus:border-orange-500 focus:outline-none"
                                      />
                                    )}
                                  </td>
                                </>
                              )}
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
                                      <select
                                        value={firstItem.payment_method || 'cash'}
                                        onChange={(e) => updateMemberPayment(item.member_id, 'payment_method', e.target.value)}
                                        className="px-2 py-1 border rounded text-xs"
                                      >
                                        <option value="cash">現金</option>
                                        <option value="balance">餘額</option>
                                      </select>
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
                {order.shipping_fee > 0 && (
                  <tr className="bg-orange-50 font-bold border-t-2">
                    <td colSpan={isCompleted ? 2 : 3} className="px-3 py-3 text-right">總計</td>
                    <td className="px-3 py-3 text-right text-slate-700">
                      ${order.items?.reduce((sum, i) => sum + i.price, 0).toLocaleString()}
                    </td>
                    <td className="px-3 py-3 text-right">-</td>
                    <td className="px-3 py-3 text-right text-slate-700">${order.shipping_fee}</td>
                    <td className="px-3 py-3 text-right">-</td>
                    <td className="px-3 py-3 text-right text-orange-600 text-base">
                      ${Object.keys(memberGroups).reduce((sum, memberId) => {
                        const chargeKey = `${orderId}_${memberId}`;
                        const items = memberGroups[memberId];
                        const memberTotal = items.reduce((s, i) => s + i.price, 0);
                        const defaultCharge = Math.round(memberTotal + shippingPerMember);
                        return sum + (actualCharges[chargeKey] ?? defaultCharge);
                      }, 0).toLocaleString()}
                    </td>
                    <td colSpan={isCompleted ? 1 : 2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* 編輯/新增對話框 */}
      {showEditDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
              <h2 className="text-lg font-bold text-slate-800">
                {editingMember ? '編輯成員訂單' : '新增成員訂單'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowEditDialog(false);
                  setEditingMember(null);
                  setEditItems([]);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            <div className="p-4 sm:p-6 space-y-4">
              {editItems.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <label className="text-sm font-semibold text-slate-700">成員：</label>
                    <select
                      value={editItems[0].member_id}
                      onChange={(e) => {
                        const member = memberMap.get(e.target.value);
                        setEditItems(editItems.map(item => ({
                          ...item,
                          member_id: e.target.value,
                          member_name: member?.name || ''
                        })));
                      }}
                      className="px-3 py-1 border rounded text-sm flex-1"
                      disabled={editingMember}
                    >
                      <option value="">選擇成員</option>
                      {members.map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto border rounded-lg">
                <table className="w-full min-w-[500px]">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">品項</th>
                      <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-24">金額</th>
                      <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-32">操作</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {editItems.map((item, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <Input
                            value={item.item_name}
                            onChange={(e) => updateEditItem(index, 'item_name', e.target.value)}
                            placeholder="飲料名稱"
                            className="text-sm"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => updateEditItem(index, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="text-sm text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleSplitItem(index)}
                              className="h-8 w-8 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                              title="平分"
                            >
                              <Users className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeEditItem(index)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-orange-50">
                      <td className="px-3 py-2 text-right font-semibold text-slate-700">總計</td>
                      <td className="px-3 py-2 text-right font-bold text-orange-600">
                        ${editItems.reduce((sum, item) => sum + (item.price || 0), 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="flex flex-col sm:flex-row justify-between gap-3">
                <Button
                  variant="outline"
                  onClick={addEditItem}
                  className="w-full sm:w-auto"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  新增品項
                </Button>
                <Button
                  onClick={handleSaveEdit}
                  className="bg-orange-600 hover:bg-orange-700 text-white w-full sm:w-auto"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  儲存
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 平分項目對話框 */}
      {showSplitDialog && splitItemIndex !== null && (
        <div className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-bold text-slate-800">選擇平分成員</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowSplitDialog(false);
                  setSplitItemIndex(null);
                  setSelectedSplitMembers([]);
                }}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>
            <div className="p-4 space-y-3">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="text-sm text-slate-700">
                  <div className="font-semibold mb-1">項目：{editItems[splitItemIndex]?.item_name}</div>
                  <div>原價：${editItems[splitItemIndex]?.price}</div>
                  <div className="mt-2 text-xs text-slate-600">
                    選擇要一起平分的成員（含目前成員共 {selectedSplitMembers.length + 1} 人）
                  </div>
                  {selectedSplitMembers.length > 0 && (
                    <div className="mt-1 font-semibold text-orange-600">
                      每人：${Math.round(editItems[splitItemIndex]?.price / (selectedSplitMembers.length + 1))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {members.filter(m => m.id !== editItems[0]?.member_id).map(member => (
                  <label
                    key={member.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSplitMembers.includes(member.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSplitMembers([...selectedSplitMembers, member.id]);
                        } else {
                          setSelectedSplitMembers(selectedSplitMembers.filter(id => id !== member.id));
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium text-slate-700">{member.name}</span>
                  </label>
                ))}
              </div>

              <div className="flex gap-2 pt-3">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSplitDialog(false);
                    setSplitItemIndex(null);
                    setSelectedSplitMembers([]);
                  }}
                  className="flex-1"
                >
                  取消
                </Button>
                <Button
                  onClick={confirmSplit}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  確認平分
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* 餘額支付確認對話框 */}
      {confirmPayment && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <Card className="w-full max-w-sm p-6 space-y-4">
            <h3 className="font-bold text-lg">確認餘額支付</h3>
            <p className="text-sm text-slate-700">
              確定要從 <b>{confirmPayment.fromName}</b> 轉帳 
              <b className="text-orange-600"> ${confirmPayment.amount}</b> 給 
              <b>{confirmPayment.toName}</b> 嗎？
            </p>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" 
                onClick={() => {
                  setConfirmPayment(null);
                  updateOrder.mutateAsync({
                    id: orderId,
                    data: { 
                      items: order.items.map(item => 
                        item.member_id === confirmPayment.memberId ? { ...item, paid: false } : item
                      )
                    }
                  });
                }}>
                取消
              </Button>
              <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-700" 
                onClick={async () => {
                  const { fromMember, toMember, amount, memberId, orderDate } = confirmPayment;
                  try {
                    await processBalanceTransfer(fromMember, toMember, amount, orderDate);
                    toast.success(`${fromMember.name} 已轉帳 $${amount} 給 ${toMember.name}`);
                  } catch (error) {
                    toast.error(`轉帳失敗：${error.message}`);
                    await updateOrder.mutateAsync({
                      id: orderId,
                      data: { items: order.items.map(item => 
                        item.member_id === memberId ? { ...item, paid: false } : item
                      )}
                    });
                  }
                  setConfirmPayment(null);
                }}>
                確認轉帳
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}