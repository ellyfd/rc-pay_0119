import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Trash2, Coffee, Wallet, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { toast } from "sonner";

export default function DrinkOrderDetail() {
  const [orderId, setOrderId] = useState(null);
  const [selectedMembers, setSelectedMembers] = useState([]);
  const [actualCharges, setActualCharges] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setOrderId(params.get('id'));
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

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
    const payer = members.find(m => m.id === payerId);
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

    const allPaidNow = updatedItems.filter(item => item.member_id !== order.payer_id).every(item => item.paid);
    if (allPaidNow && order.status !== 'completed') {
      await updateOrder.mutateAsync({
        id: orderId,
        data: { status: 'completed' }
      });
      toast.success('訂單已結案！');
    }

    if (field === 'paid' && value === true) {
      const memberItems = updatedItems.filter(item => item.member_id === memberId);
      const paymentMethod = memberItems[0]?.payment_method || 'cash';
      
      if (paymentMethod === 'balance') {
        if (!memberId || !order.payer_id) {
          toast.warning('請先選擇訂單支付人和成員！');
          return;
        }
        
        const fromMember = members.find(m => m.id === memberId);
        const toMember = members.find(m => m.id === order.payer_id);
        
        if (!fromMember || !toMember) return;

        const itemTotal = memberItems.reduce((sum, item) => sum + item.price, 0);
        
        const allMemberIds = [...new Set(order.items.map(i => i.member_id))];
        const totalMembers = allMemberIds.length;
        const shippingPerMember = totalMembers > 0 ? (order.shipping_fee || 0) / totalMembers : 0;
        const totalAmount = Math.round(itemTotal + shippingPerMember);

        if ((fromMember.balance || 0) < totalAmount) {
          toast.warning(`${fromMember.name} 餘額不足！目前餘額：$${fromMember.balance || 0}，需要：$${totalAmount}，建議充值`);
        }

        await createTransaction.mutateAsync({
          type: 'transfer',
          amount: totalAmount,
          wallet_type: 'balance',
          from_member_id: fromMember.id,
          to_member_id: toMember.id,
          from_member_name: fromMember.name,
          to_member_name: toMember.name,
          note: `${format(new Date(order.order_date), 'yyyy/MM/dd')} 飲料`
        });

        await updateMember.mutateAsync({
          id: fromMember.id,
          data: { balance: (fromMember.balance || 0) - totalAmount }
        });

        await updateMember.mutateAsync({
          id: toMember.id,
          data: { balance: (toMember.balance || 0) + totalAmount }
        });

        toast.success(`${fromMember.name} 已轉帳 $${totalAmount} 給 ${toMember.name}`);
      }
    }
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
            <div>
              <h1 className="text-2xl font-bold">
                {formatTaiwanTime(order.created_date, 'MM/dd HH:mm')} 訂單
              </h1>
              <p className="text-orange-100 text-sm">
                {isCompleted ? '已結案' : '進行中'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Card className="overflow-hidden">
          <div className="p-4 bg-slate-50 border-b">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600">訂單支付人：</label>
                <select
                  value={order.payer_id || ''}
                  onChange={(e) => updateOrderPayer(e.target.value)}
                  className="px-2 py-1 border rounded text-sm"
                  disabled={isCompleted}
                >
                  <option value="">選擇支付人</option>
                  {members.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              {!isCompleted && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => deleteOrder.mutate(orderId)}
                  className="text-red-500 hover:text-red-700"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  刪除訂單
                </Button>
              )}
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
                            <td className="px-3 py-2 font-medium" rowSpan={items.length}>
                              {item.member_name}
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
    </div>
  );
}