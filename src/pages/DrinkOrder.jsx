import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Sparkles, Save, Trash2, Edit2, Coffee, Wallet, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { formatTaiwanTime } from "@/components/utils/dateUtils";
import { toast } from "sonner";

export default function DrinkOrder() {
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [selectedItems, setSelectedItems] = useState([]);
  const [selectedMembers, setSelectedMembers] = useState({});
  const [manualAdjustment, setManualAdjustment] = useState(0);
  const [actualCharges, setActualCharges] = useState({});
  const [feeDetails, setFeeDetails] = useState({
    delivery_fee: 0,
    service_fee: 0,
    delivery_discount: 0,
    member_rewards: 0
  });
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['drinkOrders', orderDate],
    queryFn: async () => {
      const allOrders = await base44.entities.DrinkOrder.list('-created_date');
      return allOrders.filter(order => order.order_date === orderDate);
    }
  });

  const allPaid = (order) => {
    if (!order.items || order.items.length === 0) return false;
    const nonPayerItems = order.items.filter(item => item.member_id !== order.payer_id);
    if (nonPayerItems.length === 0) return true;
    return nonPayerItems.every(item => item.paid);
  };

  const handleCompleteOrder = async (orderId) => {
    await updateOrder.mutateAsync({
      id: orderId,
      data: { status: 'completed' }
    });
    toast.success('訂單已結案！');
  };

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.DrinkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('飲料訂單已儲存！');
    }
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DrinkOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('訂單已更新！');
    }
  });

  const deleteOrder = useMutation({
    mutationFn: async (id) => {
      const order = orders.find(o => o.id === id);
      if (order) {
        // 先刪除相關的交易記錄
        const allTransactions = await base44.entities.Transaction.list();
        const orderDateStr = format(new Date(order.order_date), 'yyyy/MM/dd');
        const relatedTransactions = allTransactions.filter(t => 
          t.note && t.note.includes(`${orderDateStr} 飲料`)
        );
        
        for (const transaction of relatedTransactions) {
          // 檢查交易的成員是否在此訂單中
          const memberIds = [...new Set(order.items?.map(i => i.member_id))];
          if (memberIds.includes(transaction.from_member_id) || memberIds.includes(transaction.to_member_id)) {
            await base44.entities.Transaction.delete(transaction.id);
          }
        }
      }
      
      // 刪除訂單
      return base44.entities.DrinkOrder.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('訂單及相關交易已刪除！');
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

  const updateOrderPayer = async (orderId, payerId) => {
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

  const batchUpdatePaymentMethod = async (orderId, memberIds, paymentMethod) => {
    const order = orders.find(o => o.id === orderId);
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

    setSelectedMembers(prev => ({ ...prev, [orderId]: [] }));
    toast.success(`已為 ${memberIds.length} 位成員設定支付方式`);
  };

  const updateMemberPayment = async (orderId, memberId, field, value) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    const updatedItems = order.items.map(item => {
      if (item.member_id === memberId) {
        return { ...item, [field]: value };
      }
      return item;
    });

    // 如果是勾選已支付，且支付方式為餘額，需要建立轉帳交易
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
        
        // 計算該成員需分攤的運費
        const allMemberIds = [...new Set(order.items.map(i => i.member_id))];
        const totalMembers = allMemberIds.length;
        const shippingPerMember = totalMembers > 0 ? (order.shipping_fee || 0) / totalMembers : 0;
        const totalAmount = Math.round(itemTotal + shippingPerMember);

        // 檢查餘額是否足夠
        if ((fromMember.balance || 0) < totalAmount) {
          toast.warning(`${fromMember.name} 餘額不足！目前餘額：$${fromMember.balance || 0}，需要：$${totalAmount}，建議充值`);
        }

        // 建立轉帳交易
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

        // 更新成員餘額
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

    await updateOrder.mutateAsync({
      id: orderId,
      data: { items: updatedItems }
    });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setUploadedImageUrl(result.file_url);
      toast.success('檔案上傳成功！');
    } catch (error) {
      toast.error('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedImageUrl) {
      toast.warning('請先上傳圖片或 PDF！');
      return;
    }

    setAnalyzing(true);
    try {
      // 準備成員別名參考資料
      const memberAliasReference = members.map(m => {
        const aliases = Array.isArray(m.alias) ? m.alias : (m.alias ? [m.alias] : []);
        return `- ${m.name}${aliases.length > 0 ? `（別名：${aliases.join('、')}）` : ''}`;
      }).join('\n');

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這張 Uber Eats 訂單圖片，特別注意以下格式：

    **系統成員列表與別名參考：**
    ${memberAliasReference}

    請在識別訂購人名字時，參考上述成員的姓名和別名進行匹配。

**訂單項目的辨識方式：**
- 每個產品的左側會有一個數字標記（例如：框框內的數字 1、2、3 等）
- 產品名稱在數字標記的右側
- 金額顯示在產品名稱的水平右側位置
- 請忽略其他備註細節，只提取產品名稱和價格

**訂購人名稱辨識：**
- 如果成員名字後面有 "(you)" 或 "(您)" 標記，代表此人是訂單支付者
- 在提取成員名字時，請將 "(you)" 或 "(您)" 移除，只保留實際名字
- 如果有發現 "(you)" 或 "(您)" 標記，請額外記錄這個人是支付者

**費用項目辨識：**
- 外送費（Delivery Fee）
- 服務費（Service Fee）
- 外送費優惠（Delivery Discount / 外送費折扣）- 請提取正數值
- 會員獎勵（Member Rewards / 會員點數折抵）- 請提取正數值

請仔細查找這些費用項目，如果找不到某項費用，請設為 0。優惠和獎勵請記錄為正數（不要帶負號）。

**請提取以下資訊：**
1. 每個產品項目的名稱和價格
2. 每個產品的訂購人名字（去除 "(you)" 或 "(您)" 標記）
3. 誰是訂單支付者（有 "(you)" 或 "(您)" 標記的人）
4. 外送費、服務費、外送費優惠、會員獎勵的金額

請回傳 JSON 格式的資料：
- payer_name: 訂單支付者名字（有 "(you)" 或 "(您)" 標記的人，如果有的話）
- delivery_fee: 外送費（數字，沒有則為 0）
- service_fee: 服務費（數字，沒有則為 0）
- delivery_discount: 外送費優惠（數字，沒有則為 0）
- member_rewards: 會員獎勵（數字，沒有則為 0）
- items: 訂單項目陣列，每個項目包含：
  - member_name: 訂購人名字（已移除 "(you)" 和 "(您)"）
  - item_name: 飲料/產品名稱
  - price: 價格（數字，不含貨幣符號）

請仔細辨識每一個帶有數字標記的項目，確保不遺漏任何產品。`,
        file_urls: [uploadedImageUrl],
        response_json_schema: {
          type: "object",
          properties: {
            payer_name: { type: "string" },
            delivery_fee: { type: "number" },
            service_fee: { type: "number" },
            delivery_discount: { type: "number" },
            member_rewards: { type: "number" },
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  member_name: { type: "string" },
                  item_name: { type: "string" },
                  price: { type: "number" }
                },
                required: ["item_name", "price"]
              }
            }
          },
          required: ["items"]
        }
      });

      if (result?.items && result.items.length > 0) {
        const processedItems = result.items.map(item => {
          const matchedMember = members.find(m => {
            if (!item.member_name) return false;
            // 先比對別名陣列，再比對姓名
            const aliasMatch = m.alias && Array.isArray(m.alias) && 
              m.alias.some(a => item.member_name.includes(a));
            return aliasMatch || m.name.includes(item.member_name);
          });
          return {
            member_id: matchedMember?.id || '',
            member_name: matchedMember?.name || item.member_name || '',
            item_name: item.item_name,
            price: item.price,
            payment_method: 'cash',
            paid: false
          };
        });
        setOrderItems(processedItems);

        // 處理費用資料
        const delivery = result.delivery_fee || 0;
        const service = result.service_fee || 0;
        const deliveryDisc = result.delivery_discount || 0;
        const rewards = result.member_rewards || 0;

        setFeeDetails({
          delivery_fee: delivery,
          service_fee: service,
          delivery_discount: deliveryDisc,
          member_rewards: rewards
        });
        setManualAdjustment(0);

        // 如果AI識別到支付者，自動填入
        if (result.payer_name) {
          const payerMember = members.find(m => {
            const aliasMatch = m.alias && Array.isArray(m.alias) && 
              m.alias.some(a => result.payer_name.includes(a));
            return aliasMatch || m.name.includes(result.payer_name);
          });
          if (payerMember) {
            // 這裡暫時儲存，等儲存訂單時會用到
            setOrderItems(prev => prev.map(item => ({
              ...item,
              _suggested_payer_id: payerMember.id,
              _suggested_payer_name: payerMember.name
            })));
          }
        }
        
        const otherFees = delivery + service - deliveryDisc - rewards;
        const feeMsg = otherFees !== 0 ? ` 費用總計：$${otherFees}` : '';
        toast.success(`AI 成功識別 ${processedItems.length} 個項目！${result.payer_name ? ` 支付者：${result.payer_name}` : ''}${feeMsg}`);
        } else {
        toast.warning('AI 未能識別出訂單資訊');
        }
    } catch (error) {
      toast.error('AI 分析失敗：' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveOrder = async () => {
    if (orderItems.length === 0) {
      toast.warning('請先上傳並分析訂單！');
      return;
    }

    const totalAmount = orderItems.reduce((sum, item) => sum + (item.price || 0), 0);
    
    // 檢查是否有AI建議的支付者
    const suggestedPayerId = orderItems[0]?._suggested_payer_id;
    const suggestedPayerName = orderItems[0]?._suggested_payer_name;
    
    // 清理items，移除臨時欄位
    const cleanedItems = orderItems.map(({ _suggested_payer_id, _suggested_payer_name, ...item }) => item);

    const shippingFee = feeDetails.delivery_fee + feeDetails.service_fee - feeDetails.delivery_discount - feeDetails.member_rewards + manualAdjustment;

    await createOrder.mutateAsync({
      order_date: orderDate,
      image_url: uploadedImageUrl,
      items: cleanedItems,
      total_amount: totalAmount,
      shipping_fee: shippingFee,
      payer_id: suggestedPayerId || undefined,
      payer_name: suggestedPayerName || undefined,
      status: 'pending'
    });

    setOrderItems([]);
    setUploadedImageUrl('');
    setManualAdjustment(0);
    setFeeDetails({
      delivery_fee: 0,
      service_fee: 0,
      delivery_discount: 0,
      member_rewards: 0
    });
    setShowCreateDialog(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const updateItem = (index, field, value) => {
    const newItems = [...orderItems];
    newItems[index][field] = value;
    
    if (field === 'member_id') {
      const member = members.find(m => m.id === value);
      if (member) {
        newItems[index].member_name = member.name;
      }
    }
    
    setOrderItems(newItems);
  };

  const removeItem = (index) => {
    setOrderItems(orderItems.filter((_, i) => i !== index));
  };

  const addEmptyItem = () => {
    setOrderItems([...orderItems, {
      member_id: '',
      member_name: '',
      item_name: '',
      price: 0,
      payment_method: 'cash',
      paid: false
    }]);
  };

  const getTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const handleBatchFillMember = (memberId) => {
    if (!memberId) return;
    if (selectedItems.length === 0) {
      toast.warning('請先勾選要填入的項目！');
      return;
    }
    
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const newItems = orderItems.map((item, index) => {
      if (selectedItems.includes(index)) {
        return {
          ...item,
          member_id: memberId,
          member_name: member.name
        };
      }
      return item;
    });
    setOrderItems(newItems);
    setSelectedItems([]);
    toast.success(`已為 ${selectedItems.length} 個項目填入 ${member.name}`);
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === orderItems.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(orderItems.map((_, index) => index));
    }
  };

  const toggleSelectItem = (index) => {
    if (selectedItems.includes(index)) {
      setSelectedItems(selectedItems.filter(i => i !== index));
    } else {
      setSelectedItems([...selectedItems, index]);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      <div className="bg-orange-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-orange-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Coffee className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">訂飲料</h1>
              <p className="text-orange-100 text-sm">上傳 Uber Eats 訂單，AI 自動分析</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* 日期選擇 */}
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-700">查看日期：</label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-48"
            />
          </div>
        </Card>

        {/* 訂單卡片列表 */}
        <div className="space-y-4">
          {/* 新增訂單卡片 */}
          <Card 
            className="p-12 border-2 border-dashed border-emerald-300 bg-emerald-50/30 hover:bg-emerald-50/50 cursor-pointer transition-all"
            onClick={() => setShowCreateDialog(true)}
          >
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full border-3 border-emerald-500 flex items-center justify-center">
                <Coffee className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="text-center">
                <div className="font-semibold text-emerald-900 text-lg">開新訂單</div>
                <div className="text-sm text-emerald-700">建立新的飲料訂單</div>
              </div>
            </div>
          </Card>

          {/* 現有訂單 */}
          {orders.length > 0 && (
          <div className="space-y-4">
            {orders.map(order => {
              const isPaid = allPaid(order);
              const isCompleted = order.status === 'completed';
              const orderSelectedMembers = selectedMembers[order.id] || [];
              
              return (
                <Card key={order.id} className={`overflow-hidden ${isCompleted ? 'border-green-500 border-2' : ''}`}>
                  <div className={`p-4 border-b flex items-center justify-between ${isCompleted ? 'bg-green-50' : 'bg-slate-50'}`}>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isCompleted ? 'bg-green-600' : 'bg-orange-600'}`}>
                        {isCompleted ? (
                          <CheckCircle className="w-6 h-6 text-white" />
                        ) : (
                          <Coffee className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-800">
                          {formatTaiwanTime(order.created_date, 'HH:mm')} 的訂單
                        </div>
                        <div className="text-xs text-slate-500">
                          {isCompleted ? '已結案' : isPaid ? '已全部付款' : '待付款'}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isCompleted && isPaid && (
                        <Button
                          size="sm"
                          onClick={() => handleCompleteOrder(order.id)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          結案
                        </Button>
                      )}
                      {!isCompleted && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteOrder.mutate(order.id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="p-4">
                    <div className="flex items-center gap-4 flex-wrap mb-3">
                      <div className="flex items-center gap-2">
                        <label className="text-sm text-slate-600">訂單支付人：</label>
                        <select
                          value={order.payer_id || ''}
                          onChange={(e) => updateOrderPayer(order.id, e.target.value)}
                          className="px-2 py-1 border rounded text-sm"
                          disabled={isCompleted}
                        >
                          <option value="">選擇支付人</option>
                          {members.map(m => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {orderSelectedMembers.length > 0 && !isCompleted && (
                      <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-slate-700">已選取 {orderSelectedMembers.length} 位成員</span>
                          <div className="flex items-center gap-2">
                            <label className="text-sm text-slate-600">批量設定支付方式：</label>
                            <select
                              onChange={(e) => {
                                if (e.target.value) {
                                  batchUpdatePaymentMethod(order.id, orderSelectedMembers, e.target.value);
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
                              onClick={() => setSelectedMembers(prev => ({ ...prev, [order.id]: [] }))}
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
                                    return memberIds.length > 0 && memberIds.every(id => orderSelectedMembers.includes(id));
                                  })()}
                                  onChange={(e) => {
                                    const memberIds = [...new Set(order.items?.map(i => i.member_id).filter(Boolean))];
                                    if (e.target.checked) {
                                      setSelectedMembers(prev => ({ ...prev, [order.id]: [...new Set([...orderSelectedMembers, ...memberIds])] }));
                                    } else {
                                      setSelectedMembers(prev => ({ ...prev, [order.id]: orderSelectedMembers.filter(id => !memberIds.includes(id)) }));
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
                          {(() => {
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

                            return Object.entries(memberGroups).map(([memberId, items], groupIdx) => {
                              const memberTotal = items.reduce((sum, i) => sum + i.price, 0);
                              const memberPaymentAmount = memberTotal + shippingPerMember;
                              const chargeKey = `${order.id}_${memberId}`;
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
                                              checked={orderSelectedMembers.includes(item.member_id)}
                                              onChange={(e) => {
                                                if (e.target.checked) {
                                                  setSelectedMembers(prev => ({ ...prev, [order.id]: [...orderSelectedMembers, item.member_id] }));
                                                } else {
                                                  setSelectedMembers(prev => ({ ...prev, [order.id]: orderSelectedMembers.filter(id => id !== item.member_id) }));
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
                                                      const newCharges = { ...actualCharges, [chargeKey]: parseFloat(e.target.value) || 0 };
                                                      setActualCharges(newCharges);
                                                    }}
                                                    className="w-16 px-2 py-1 text-right font-bold text-orange-600 border border-orange-300 rounded focus:border-orange-500 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
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
                                                    onChange={(e) => updateMemberPayment(order.id, item.member_id, 'payment_method', e.target.value)}
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
                                                    onClick={() => updateMemberPayment(order.id, item.member_id, 'paid', true)}
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
                                                    onChange={(e) => updateMemberPayment(order.id, item.member_id, 'paid', e.target.checked)}
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
                            });
                          })()}
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
                                ${(() => {
                                  const memberGroups = {};
                                  order.items?.forEach(item => {
                                    const key = item.member_id || item.member_name;
                                    if (!memberGroups[key]) memberGroups[key] = [];
                                    memberGroups[key].push(item);
                                  });
                                  return Object.keys(memberGroups).reduce((sum, memberId) => {
                                    const chargeKey = `${order.id}_${memberId}`;
                                    const items = memberGroups[memberId];
                                    const memberTotal = items.reduce((s, i) => s + i.price, 0);
                                    const totalMembers = Object.keys(memberGroups).length;
                                    const shippingPerMember = totalMembers > 0 ? (order.shipping_fee || 0) / totalMembers : 0;
                                    const defaultCharge = Math.round(memberTotal + shippingPerMember);
                                    return sum + (actualCharges[chargeKey] ?? defaultCharge);
                                  }, 0).toLocaleString();
                                })()}
                              </td>
                              <td colSpan={isCompleted ? 1 : 2}></td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          )}
        </div>

        {/* 新增訂單對話框 */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <Card className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between z-10">
                <h2 className="text-xl font-bold text-slate-800">新增訂單</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowCreateDialog(false);
                    setOrderItems([]);
                    setUploadedImageUrl('');
                    setManualAdjustment(0);
                    setFeeDetails({ delivery_fee: 0, service_fee: 0, delivery_discount: 0, member_rewards: 0 });
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  <ArrowLeft className="w-5 h-5" />
                </Button>
              </div>
              
              <div className="p-6 space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">訂購日期</label>
                  <Input
                    type="date"
                    value={orderDate}
                    onChange={(e) => setOrderDate(e.target.value)}
                    className="w-48"
                  />
                </div>

                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-purple-600" />
                    <h3 className="font-semibold text-purple-900">AI 智慧辨識</h3>
                  </div>
                  <p className="text-xs text-purple-700 mb-3">支援上傳 Uber Eats 訂單截圖或電子明細 PDF</p>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="bg-white"
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      {uploading ? '上傳中...' : '上傳訂單圖片或PDF'}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    
                    {uploadedImageUrl && (
                      <>
                        <span className="text-sm text-green-600 flex items-center">✓ 已上傳</span>
                        <Button
                          type="button"
                          onClick={handleAnalyze}
                          disabled={analyzing}
                          className="bg-purple-600 hover:bg-purple-700 text-white"
                        >
                          {analyzing ? '分析中...' : '🤖 AI 分析訂單'}
                        </Button>
                      </>
                    )}
                  </div>

                  {uploadedImageUrl && (
                    <div className="mt-3">
                      <img
                        src={uploadedImageUrl}
                        alt="上傳的訂單"
                        className="max-w-full h-auto max-h-64 rounded-lg border"
                      />
                    </div>
                  )}
                </div>

                {orderItems.length > 0 && (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-slate-800">訂單明細</h3>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-slate-600">批次填入成員：</label>
                          <select
                            onChange={(e) => handleBatchFillMember(e.target.value)}
                            className="px-3 py-1 border rounded text-sm"
                            defaultValue=""
                          >
                            <option value="">選擇成員</option>
                            {members.map(m => (
                              <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="overflow-x-auto border rounded-lg">
                        <table className="w-full min-w-[650px]">
                          <thead className="bg-slate-50 border-b">
                            <tr>
                              <th className="text-center px-3 py-3 text-sm font-semibold text-slate-700 w-[50px]">
                                <input
                                  type="checkbox"
                                  checked={selectedItems.length === orderItems.length && orderItems.length > 0}
                                  onChange={toggleSelectAll}
                                  className="w-4 h-4 cursor-pointer"
                                />
                              </th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 w-[25%]">成員</th>
                              <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 w-[35%]">訂購內容</th>
                              <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 w-[20%]">金額</th>
                              <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700 w-[15%]">操作</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y">
                            {orderItems.map((item, index) => (
                              <tr key={index} className={`hover:bg-slate-50 ${selectedItems.includes(index) ? 'bg-blue-50' : ''}`}>
                                <td className="px-3 py-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedItems.includes(index)}
                                    onChange={() => toggleSelectItem(index)}
                                    className="w-4 h-4 cursor-pointer"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <select
                                    value={item.member_id}
                                    onChange={(e) => updateItem(index, 'member_id', e.target.value)}
                                    className="w-full px-2 py-1 border rounded text-sm"
                                  >
                                    <option value="">選擇成員</option>
                                    {members.map(m => (
                                      <option key={m.id} value={m.id}>{m.name}</option>
                                    ))}
                                  </select>
                                  {!item.member_id && item.member_name && (
                                    <div className="text-xs text-amber-600 mt-1">AI識別: {item.member_name}</div>
                                  )}
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    value={item.item_name}
                                    onChange={(e) => updateItem(index, 'item_name', e.target.value)}
                                    placeholder="飲料名稱"
                                    className="text-sm"
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <Input
                                    type="number"
                                    value={item.price}
                                    onChange={(e) => updateItem(index, 'price', parseFloat(e.target.value) || 0)}
                                    placeholder="0"
                                    className="text-sm text-right"
                                  />
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index)}
                                    className="h-8 w-8 text-red-500 hover:text-red-700"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </td>
                              </tr>
                            ))}
                            <tr className="bg-orange-50 font-bold">
                              <td colSpan="3" className="px-4 py-3 text-right text-slate-800">總金額</td>
                              <td className="px-4 py-3 text-right text-orange-600 text-lg">
                                ${getTotalAmount().toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 space-y-3">
                      <div className="text-sm font-semibold text-slate-700 mb-2">費用明細</div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-slate-600">外送費：</span>
                          <span className="font-medium">${feeDetails.delivery_fee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">服務費：</span>
                          <span className="font-medium">${feeDetails.service_fee}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">外送費優惠：</span>
                          <span className="font-medium text-green-600">-${feeDetails.delivery_discount}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-600">會員獎勵：</span>
                          <span className="font-medium text-green-600">-${feeDetails.member_rewards}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 pt-2">
                        <label className="text-sm font-semibold text-slate-700 whitespace-nowrap">手動調整：</label>
                        <Input
                          type="number"
                          value={manualAdjustment}
                          onChange={(e) => setManualAdjustment(parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="w-32 text-sm"
                        />
                      </div>
                      <div className="flex justify-between pt-2 border-t">
                        <span className="text-sm font-semibold text-slate-700">其它費用（均分）：</span>
                        <span className="text-sm font-bold text-orange-600">
                          ${feeDetails.delivery_fee + feeDetails.service_fee - feeDetails.delivery_discount - feeDetails.member_rewards + manualAdjustment}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between">
                      <Button
                        variant="outline"
                        onClick={addEmptyItem}
                      >
                        + 新增項目
                      </Button>
                      <Button
                        onClick={handleSaveOrder}
                        className="bg-orange-600 hover:bg-orange-700 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        儲存訂單
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}