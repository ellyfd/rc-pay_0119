import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, Sparkles, Coffee, Trash2, CheckCircle, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DrinkOrder() {
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [orders, setOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const fileInputRef = useRef(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
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

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
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
    } catch (error) {
      toast.error('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAnalyze = async () => {
    if (!uploadedFileUrl) {
      toast.warning('請先上傳圖片或 PDF');
      return;
    }

    setAnalyzing(true);
    try {
      toast.info('AI 正在分析訂單...');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這個 Uber Eats 訂單圖片或 PDF。提取所有訂購資訊，包括：
1. 每個人點的飲料名稱
2. 每杯飲料的價格
3. 如果有顯示訂購人的名字，請提取出來
4. 注意事項或備註（例如甜度、冰塊等）

請回傳 JSON 格式的訂單列表。如果無法辨識訂購人名字，請將 member_name 設為空字串。`,
        file_urls: [uploadedFileUrl],
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
        const newOrders = result.orders.map(order => ({
          member_id: '',
          member_name: order.member_name || '',
          drink_name: order.drink_name,
          price: order.price,
          note: order.note || '',
          payment_method: 'balance',
          selected: true
        }));
        setOrders(newOrders);
        toast.success(`AI 成功辨識 ${newOrders.length} 筆訂單！`);
      } else {
        toast.warning('AI 未能辨識出訂單資訊，請手動輸入');
      }
    } catch (error) {
      toast.error('AI 分析失敗：' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addEmptyOrder = () => {
    setOrders([...orders, {
      member_id: '',
      member_name: '',
      drink_name: '',
      price: 0,
      note: '',
      payment_method: 'balance',
      selected: true
    }]);
  };

  const updateOrder = (index, field, value) => {
    const newOrders = [...orders];
    newOrders[index][field] = value;
    
    // 如果選擇了成員，自動填入 member_id 和 member_name
    if (field === 'member_id') {
      const member = allMembers.find(m => m.id === value);
      if (member) {
        newOrders[index].member_name = member.name;
      }
    }
    
    setOrders(newOrders);
  };

  const removeOrder = (index) => {
    setOrders(orders.filter((_, i) => i !== index));
  };

  const handleSubmitOrders = async () => {
    const selectedOrders = orders.filter(o => o.selected && o.member_id && o.drink_name && o.price > 0);
    
    if (selectedOrders.length === 0) {
      toast.error('請至少選擇一筆訂單並填寫完整資訊！');
      return;
    }

    try {
      for (const order of selectedOrders) {
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
      
      setOrders([]);
      setUploadedFileUrl('');
      toast.success(`成功建立 ${selectedOrders.length} 筆訂單！`);
    } catch (error) {
      toast.error('建立訂單失敗：' + error.message);
    }
  };

  const handleCheckoutAll = async () => {
    const pendingOrders = existingOrders.filter(o => o.status === 'pending');
    
    if (pendingOrders.length === 0) {
      toast.warning('沒有待結帳的訂單');
      return;
    }

    if (!confirm(`確認要結帳 ${pendingOrders.length} 筆訂單嗎？`)) return;

    try {
      for (const order of pendingOrders) {
        const member = allMembers.find(m => m.id === order.member_id);
        if (!member) continue;

        // Update order status
        await updateDrinkOrder.mutateAsync({
          id: order.id,
          data: { status: 'completed' }
        });

        const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 飲料：${order.drink_name}`;

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
    } catch (error) {
      toast.error('結帳失敗：' + error.message);
    }
  };

  const getTotalAmount = () => {
    return orders.filter(o => o.selected).reduce((sum, o) => sum + (o.price || 0), 0);
  };

  const pendingOrders = existingOrders.filter(o => o.status === 'pending');
  const pendingTotal = pendingOrders.reduce((sum, o) => sum + o.price, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-amber-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-amber-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <Coffee className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">訂飲料</h1>
                <p className="text-amber-100 text-sm">AI 智慧辨識訂單</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Date Selection */}
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <label className="font-semibold text-slate-700">訂購日期：</label>
            <Input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="w-40"
            />
          </div>
        </Card>

        {/* AI Analysis Section */}
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-semibold text-slate-800">AI 智慧辨識</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                variant="outline"
                className="flex-1"
              >
                {uploading ? (
                  <>上傳中...</>
                ) : (
                  <>
                    <Camera className="w-4 h-4 mr-2" />
                    拍照 / 上傳圖片或 PDF
                  </>
                )}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,application/pdf"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              
              {uploadedFileUrl && (
                <Button
                  onClick={handleAnalyze}
                  disabled={analyzing}
                  className="bg-amber-600 hover:bg-amber-700 flex-1"
                >
                  {analyzing ? '分析中...' : '🤖 AI 辨識訂單'}
                </Button>
              )}
            </div>

            {uploadedFileUrl && (
              <div className="flex items-center gap-2 text-sm text-green-600">
                <CheckCircle className="w-4 h-4" />
                檔案已上傳
              </div>
            )}
          </div>
        </Card>

        {/* Orders Table */}
        {orders.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-800">訂單列表</h2>
              <Button onClick={addEmptyOrder} variant="outline" size="sm">
                新增訂單
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-amber-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700 w-12">選擇</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">成員</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">訂購內容</th>
                    <th className="text-right px-3 py-3 text-sm font-semibold text-slate-700">金額</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">支付方式</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">備註</th>
                    <th className="text-center px-3 py-3 text-sm font-semibold text-slate-700 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order, index) => (
                    <tr key={index}>
                      <td className="px-3 py-2">
                        <Checkbox
                          checked={order.selected}
                          onCheckedChange={(checked) => updateOrder(index, 'selected', checked)}
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={order.member_id}
                          onValueChange={(value) => updateOrder(index, 'member_id', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue placeholder="選擇成員" />
                          </SelectTrigger>
                          <SelectContent>
                            {allMembers.map(member => (
                              <SelectItem key={member.id} value={member.id}>
                                {member.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={order.drink_name}
                          onChange={(e) => updateOrder(index, 'drink_name', e.target.value)}
                          placeholder="珍珠奶茶、拿鐵..."
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={order.price}
                          onChange={(e) => updateOrder(index, 'price', parseFloat(e.target.value) || 0)}
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select
                          value={order.payment_method}
                          onValueChange={(value) => updateOrder(index, 'payment_method', value)}
                        >
                          <SelectTrigger className="h-9 w-24">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balance">餘額</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          value={order.note}
                          onChange={(e) => updateOrder(index, 'note', e.target.value)}
                          placeholder="甜度、冰塊..."
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2 text-center">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeOrder(index)}
                          className="h-8 w-8 text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t mt-4 pt-4">
              <div className="flex items-center justify-between">
                <span className="text-lg font-semibold text-slate-700">總計</span>
                <span className="text-2xl font-bold text-amber-600">${getTotalAmount().toLocaleString()}</span>
              </div>
              <Button
                onClick={handleSubmitOrders}
                className="w-full mt-4 bg-amber-600 hover:bg-amber-700 py-6 text-lg"
              >
                建立訂單
              </Button>
            </div>
          </Card>
        )}

        {/* Existing Orders */}
        {!ordersLoading && existingOrders.length > 0 && (
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">今日訂單</h2>
                <p className="text-sm text-slate-500">
                  待結帳：{pendingOrders.length} 筆 / 總計：${pendingTotal.toLocaleString()}
                </p>
              </div>
              {pendingOrders.length > 0 && currentUser?.role === 'admin' && (
                <Button
                  onClick={handleCheckoutAll}
                  className="bg-amber-600 hover:bg-amber-700"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  結帳全部
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">成員</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">飲料</th>
                    <th className="text-right px-3 py-3 text-sm font-semibold text-slate-700">金額</th>
                    <th className="text-left px-3 py-3 text-sm font-semibold text-slate-700">支付</th>
                    <th className="text-center px-3 py-3 text-sm font-semibold text-slate-700">狀態</th>
                    {currentUser?.role === 'admin' && (
                      <th className="text-center px-3 py-3 text-sm font-semibold text-slate-700 w-16"></th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {existingOrders.map(order => (
                    <tr key={order.id} className={order.status === 'completed' ? 'opacity-60' : ''}>
                      <td className="px-3 py-3 font-medium text-slate-800">{order.member_name}</td>
                      <td className="px-3 py-3 text-slate-700">
                        {order.drink_name}
                        {order.note && <span className="text-xs text-slate-500 ml-2">({order.note})</span>}
                      </td>
                      <td className="px-3 py-3 text-right font-semibold text-amber-600">
                        ${order.price.toLocaleString()}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.payment_method === 'cash' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'
                        }`}>
                          {order.payment_method === 'cash' ? '現金' : '餘額'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.status === 'completed' ? '已完成' : '待結帳'}
                        </span>
                      </td>
                      {currentUser?.role === 'admin' && (
                        <td className="px-3 py-3 text-center">
                          {order.status === 'pending' && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDrinkOrder.mutate(order.id)}
                              className="h-8 w-8 text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {orders.length === 0 && !uploading && !uploadedFileUrl && (
          <Card className="p-8 text-center border-dashed">
            <Coffee className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">上傳 Uber Eats 訂單截圖，AI 將自動辨識訂購資訊</p>
          </Card>
        )}
      </div>
    </div>
  );
}