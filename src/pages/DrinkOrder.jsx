import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, Upload, Sparkles, Save, Trash2, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DrinkOrder() {
  const fileInputRef = React.useRef(null);
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [orders, setOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: existingOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['drinkOrders', orderDate],
    queryFn: async () => {
      const allOrders = await base44.entities.DrinkOrder.list('-created_date');
      return allOrders.filter(order => order.order_date === orderDate);
    }
  });

  const createDrinkOrder = useMutation({
    mutationFn: (data) => base44.entities.DrinkOrder.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinkOrders'] })
  });

  const updateDrinkOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DrinkOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinkOrders'] })
  });

  const deleteDrinkOrder = useMutation({
    mutationFn: (id) => base44.entities.DrinkOrder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinkOrders'] })
  });

  const createTransaction = useMutation({
    mutationFn: (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setUploadedFileUrl(result.file_url);
      toast.success('檔案上傳成功！');
      
      // Auto analyze after upload
      await handleAnalyze(result.file_url);
    } catch (error) {
      console.error('上傳錯誤:', error);
      toast.error('上傳失敗：' + (error.message || '未知錯誤'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyze = async (fileUrl) => {
    if (!fileUrl) {
      toast.warning('請先上傳檔案');
      return;
    }

    setAnalyzing(true);
    try {
      toast.info('AI 正在分析訂單...');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這張 Uber Eats 或飲料訂單的圖片/PDF。
        
請提取以下資訊：
1. 每個人點的飲料名稱和價格
2. 如果圖片中有備註成員名稱，請一併提取
3. 每項飲料的單價

請回傳 JSON 格式的訂單列表，每筆訂單包含：
- member_name: 成員名稱（如果圖片中沒有標示，請留空字串）
- drink_name: 飲料名稱（包含規格，例如：珍珠奶茶（大杯）、美式咖啡（熱）等）
- price: 單價（數字）
- note: 備註（如果有特殊要求，例如：少冰、半糖等）

請確保價格是數字格式，不要包含貨幣符號。`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  member_name: { type: "string" },
                  drink_name: { type: "string" },
                  price: { type: "number" },
                  note: { type: "string" }
                },
                required: ["drink_name", "price"]
              }
            }
          },
          required: ["orders"]
        }
      });

      if (result && result.orders && result.orders.length > 0) {
        // Convert to editable format with member selection
        const newOrders = result.orders.map((order, index) => {
          // Try to match member name
          let memberId = '';
          if (order.member_name) {
            const matchedMember = allMembers.find(m => 
              m.name.toLowerCase().includes(order.member_name.toLowerCase()) ||
              order.member_name.toLowerCase().includes(m.name.toLowerCase())
            );
            if (matchedMember) {
              memberId = matchedMember.id;
            }
          }
          
          return {
            id: `new-${Date.now()}-${index}`,
            member_id: memberId,
            member_name: order.member_name || '',
            drink_name: order.drink_name,
            price: order.price,
            payment_method: 'balance',
            note: order.note || '',
            checked: true
          };
        });
        
        setOrders(newOrders);
        toast.success(`AI 成功識別 ${newOrders.length} 筆訂單！`);
      } else {
        toast.warning('AI 未能識別出訂單資訊，請手動輸入');
      }
    } catch (error) {
      console.error('AI 分析錯誤:', error);
      toast.error('AI 分析失敗：' + (error.message || '未知錯誤'));
    } finally {
      setAnalyzing(false);
    }
  };

  const addManualOrder = () => {
    setOrders([...orders, {
      id: `new-${Date.now()}`,
      member_id: '',
      member_name: '',
      drink_name: '',
      price: 0,
      payment_method: 'balance',
      note: '',
      checked: true
    }]);
  };

  const updateOrder = (id, field, value) => {
    setOrders(orders.map(order => {
      if (order.id === id) {
        const updated = { ...order, [field]: value };
        // Update member_name when member_id changes
        if (field === 'member_id') {
          const member = allMembers.find(m => m.id === value);
          updated.member_name = member ? member.name : '';
        }
        return updated;
      }
      return order;
    }));
  };

  const removeOrder = (id) => {
    setOrders(orders.filter(order => order.id !== id));
  };

  const handleSubmitOrders = async () => {
    const checkedOrders = orders.filter(o => o.checked);
    
    if (checkedOrders.length === 0) {
      toast.error('請至少勾選一筆訂單！');
      return;
    }

    const invalidOrders = checkedOrders.filter(o => !o.member_id || !o.drink_name || o.price <= 0);
    if (invalidOrders.length > 0) {
      toast.error('請確認所有勾選的訂單都有填寫成員、飲料名稱和價格！');
      return;
    }

    try {
      for (const order of checkedOrders) {
        await createDrinkOrder.mutateAsync({
          member_id: order.member_id,
          member_name: order.member_name,
          drink_name: order.drink_name,
          price: order.price,
          payment_method: order.payment_method,
          status: 'pending',
          order_date: orderDate,
          note: order.note || undefined
        });
      }

      toast.success(`已建立 ${checkedOrders.length} 筆訂單！`);
      setOrders([]);
      setUploadedFileUrl('');
    } catch (error) {
      console.error('建立訂單錯誤:', error);
      toast.error('建立訂單失敗');
    }
  };

  const handleCheckoutAll = async () => {
    const pendingOrders = existingOrders.filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
      toast.warning('沒有待結帳的訂單');
      return;
    }

    if (!confirm(`確認要結帳 ${pendingOrders.length} 筆訂單嗎？`)) return;

    for (const order of pendingOrders) {
      const member = allMembers.find(m => m.id === order.member_id);
      if (!member) continue;

      await updateDrinkOrder.mutateAsync({
        id: order.id,
        data: { status: 'completed' }
      });

      const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 飲料 - ${order.drink_name}`;

      if (order.payment_method === 'balance') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.price,
          wallet_type: 'balance',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { balance: (member.balance || 0) - order.price }
        });
      } else if (order.payment_method === 'cash') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: order.price,
          wallet_type: 'cash',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { cash_balance: (member.cash_balance || 0) - order.price }
        });
      }
    }

    toast.success('結帳完成！');
  };

  const totalAmount = orders.filter(o => o.checked).reduce((sum, o) => sum + (o.price || 0), 0);
  const pendingTotal = existingOrders.filter(o => o.status === 'pending').reduce((sum, o) => sum + o.price, 0);

  // Batch operations
  const checkedOrders = orders.filter(o => o.checked);
  const hasChecked = checkedOrders.length > 0;

  const handleBatchUpdateMember = (memberId) => {
    setOrders(orders.map(order => 
      order.checked ? { ...order, member_id: memberId, member_name: allMembers.find(m => m.id === memberId)?.name || '' } : order
    ));
  };

  const handleBatchUpdatePayment = (paymentMethod) => {
    setOrders(orders.map(order => 
      order.checked ? { ...order, payment_method: paymentMethod } : order
    ));
  };

  const toggleAllChecked = () => {
    const allChecked = orders.every(o => o.checked);
    setOrders(orders.map(order => ({ ...order, checked: !allChecked })));
  };

  // Calculate subtotals by member
  const memberSubtotals = orders
    .filter(o => o.checked && o.member_id)
    .reduce((acc, order) => {
      const memberName = order.member_name || '未選擇';
      if (!acc[memberName]) {
        acc[memberName] = 0;
      }
      acc[memberName] += order.price || 0;
      return acc;
    }, {});

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-cyan-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-cyan-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">訂飲料</h1>
              <p className="text-cyan-100 text-sm">AI 智慧辨識 Uber Eats 訂單</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-cyan-600" />
            <h2 className="text-lg font-semibold">上傳訂單截圖或 PDF</h2>
          </div>
          
          <div className="flex items-center gap-3 mb-4">
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-40"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || analyzing}
              className="bg-cyan-600 hover:bg-cyan-700"
            >
              {uploading ? (
                <>上傳中...</>
              ) : (
                <>
                  <Upload className="w-4 h-4 mr-2" />
                  上傳圖片/PDF
                </>
              )}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,image/jpeg,image/png,image/heic,.pdf,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            {uploadedFileUrl && !analyzing && (
              <span className="text-sm text-green-600">✓ 已上傳</span>
            )}
            {analyzing && (
              <span className="text-sm text-cyan-600">🤖 AI 分析中...</span>
            )}
          </div>

          {uploadedFileUrl && (
            <div className="mt-3">
              <img src={uploadedFileUrl} alt="上傳的訂單" className="w-24 h-24 object-cover rounded-lg border cursor-pointer hover:opacity-80" onClick={() => window.open(uploadedFileUrl, '_blank')} />
            </div>
          )}
        </Card>

        {/* Orders Table */}
        {orders.length > 0 && (
          <Card className="p-6">
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">訂單明細</h2>
                <Button onClick={addManualOrder} variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  手動新增
                </Button>
              </div>
              
              {/* Batch Operations */}
              {hasChecked && (
                <div className="flex flex-wrap items-center gap-2 p-3 bg-cyan-50 rounded-lg border border-cyan-200">
                  <span className="text-sm font-medium text-cyan-900">批量操作 ({checkedOrders.length} 項)：</span>
                  <Select onValueChange={handleBatchUpdateMember}>
                    <SelectTrigger className="w-32 h-8 text-xs">
                      <SelectValue placeholder="批改成員" />
                    </SelectTrigger>
                    <SelectContent>
                      {allMembers.map((member) => (
                        <SelectItem key={member.id} value={member.id}>
                          {member.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select onValueChange={handleBatchUpdatePayment}>
                    <SelectTrigger className="w-28 h-8 text-xs">
                      <SelectValue placeholder="批改支付" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="balance">餘額</SelectItem>
                      <SelectItem value="cash">現金</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[600px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-2 py-1.5 text-center">
                      <Checkbox checked={orders.every(o => o.checked)} onCheckedChange={toggleAllChecked} />
                    </th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">成員</th>
                    <th className="px-2 py-1.5 text-left w-full">訂購內容</th>
                    <th className="px-2 py-1.5 text-right whitespace-nowrap">金額</th>
                    <th className="px-2 py-1.5 text-left whitespace-nowrap">支付</th>
                    <th className="px-2 py-1.5 text-center whitespace-nowrap">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order) => (
                    <tr key={order.id} className={!order.checked ? 'opacity-50' : ''}>
                      <td className="px-2 py-1.5 text-center">
                        <Checkbox
                          checked={order.checked}
                          onCheckedChange={(checked) => updateOrder(order.id, 'checked', checked)}
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={order.member_id}
                          onValueChange={(value) => updateOrder(order.id, 'member_id', value)}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[80px]">
                            <SelectValue placeholder="選擇" />
                          </SelectTrigger>
                          <SelectContent>
                            {allMembers.map((member) => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          value={order.drink_name}
                          onChange={(e) => updateOrder(order.id, 'drink_name', e.target.value)}
                          placeholder="珍珠奶茶（大杯）"
                          className="h-8 text-xs"
                        />
                        {order.note && (
                          <div className="text-[10px] text-slate-500 mt-0.5">備註: {order.note}</div>
                        )}
                      </td>
                      <td className="px-2 py-1.5">
                        <Input
                          type="number"
                          value={order.price}
                          onChange={(e) => updateOrder(order.id, 'price', parseFloat(e.target.value) || 0)}
                          className="h-8 text-xs text-right min-w-[70px]"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <Select
                          value={order.payment_method}
                          onValueChange={(value) => updateOrder(order.id, 'payment_method', value)}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[70px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balance">餘額</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOrder(order.id)}
                          className="h-7 w-7 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Member Subtotals */}
            {Object.keys(memberSubtotals).length > 0 && (
              <div className="mt-4 p-3 bg-slate-50 rounded-lg">
                <div className="text-sm font-semibold mb-2 text-slate-700">成員小計：</div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {Object.entries(memberSubtotals).map(([name, total]) => (
                    <div key={name} className="flex justify-between items-center text-xs bg-white px-2 py-1.5 rounded border">
                      <span className="font-medium text-slate-700">{name}</span>
                      <span className="font-semibold text-cyan-600">${total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <div className="text-lg font-semibold">
                總金額：<span className="text-cyan-600">${totalAmount.toLocaleString()}</span>
              </div>
              <Button
                onClick={handleSubmitOrders}
                disabled={orders.filter(o => o.checked).length === 0}
                className="bg-cyan-600 hover:bg-cyan-700"
              >
                <Save className="w-4 h-4 mr-2" />
                建立訂單
              </Button>
            </div>
          </Card>
        )}

        {/* Existing Orders */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold">今日訂單</h2>
              <p className="text-sm text-slate-500">{orderDate}</p>
            </div>
            {existingOrders.filter(o => o.status === 'pending').length > 0 && currentUser?.role === 'admin' && (
              <Button
                onClick={handleCheckoutAll}
                className="bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                統一結帳 (${pendingTotal.toLocaleString()})
              </Button>
            )}
          </div>

          {ordersLoading ? (
            <div className="text-center py-8">
              <div className="w-8 h-8 border-4 border-cyan-300 border-t-cyan-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : existingOrders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">尚無訂單</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="px-3 py-2 text-left">時間</th>
                    <th className="px-3 py-2 text-left">成員</th>
                    <th className="px-3 py-2 text-left">飲料</th>
                    <th className="px-3 py-2 text-right">金額</th>
                    <th className="px-3 py-2 text-left">支付</th>
                    <th className="px-3 py-2 text-center">狀態</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {existingOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-600">
                        {format(new Date(order.created_date), 'HH:mm')}
                      </td>
                      <td className="px-3 py-2 font-medium">{order.member_name}</td>
                      <td className="px-3 py-2">
                        {order.drink_name}
                        {order.note && (
                          <div className="text-xs text-slate-500">{order.note}</div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold text-cyan-600">
                        ${order.price.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.payment_method === 'cash' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.payment_method === 'cash' ? '現金' : '餘額'}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status === 'completed' ? '已完成' : '待結帳'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}