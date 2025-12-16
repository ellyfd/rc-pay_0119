import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Upload, Sparkles, Trash2, Save, Camera } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
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
  const [imageUrl, setImageUrl] = useState('');
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

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: existingOrders = [] } = useQuery({
    queryKey: ['drinkOrders', orderDate],
    queryFn: async () => {
      const all = await base44.entities.DrinkOrder.list('-created_date');
      return all.filter(o => o.order_date === orderDate && o.status === 'pending');
    }
  });

  const createDrinkOrder = useMutation({
    mutationFn: (data) => base44.entities.DrinkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
    }
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
      setImageUrl(result.file_url);
      toast.success('圖片上傳成功！');
      
      // Auto analyze
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

  const handleAnalyze = async (url) => {
    if (!url) {
      toast.warning('請先上傳圖片');
      return;
    }

    setAnalyzing(true);
    try {
      toast.info('AI 正在分析訂單...');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這張 Uber Eats 的訂單圖片。提取所有訂購者的名字、他們點的飲料名稱和價格。
        
如果圖片中有明確的人名，請使用該人名。如果沒有人名但有飲料名稱，請將成員名稱設為 "未指定"。
請確保提取所有的飲料項目和對應的價格。

請回傳 JSON 格式的訂單列表。`,
        file_urls: [url],
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
                  price: { type: "number" }
                },
                required: ["member_name", "drink_name", "price"]
              }
            }
          },
          required: ["orders"]
        }
      });

      if (result && result.orders && result.orders.length > 0) {
        // Match member names with existing members
        const matchedOrders = result.orders.map(order => {
          const member = allMembers.find(m => 
            m.name.toLowerCase().includes(order.member_name.toLowerCase()) ||
            order.member_name.toLowerCase().includes(m.name.toLowerCase())
          );
          
          return {
            member_id: member?.id || '',
            member_name: member?.name || order.member_name,
            drink_name: order.drink_name,
            price: order.price,
            payment_method: 'balance'
          };
        });
        
        setOrders(matchedOrders);
        toast.success(`AI 成功識別 ${matchedOrders.length} 筆訂單！`);
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

  const addEmptyOrder = () => {
    setOrders([...orders, {
      member_id: '',
      member_name: '',
      drink_name: '',
      price: 0,
      payment_method: 'balance'
    }]);
  };

  const updateOrder = (index, field, value) => {
    const newOrders = [...orders];
    newOrders[index][field] = value;
    
    // Auto-update member_name when member_id changes
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

  const getTotalAmount = () => {
    return orders.reduce((sum, order) => sum + (parseFloat(order.price) || 0), 0);
  };

  const handleSubmit = async () => {
    const validOrders = orders.filter(o => o.member_id && o.drink_name && o.price > 0);
    
    if (validOrders.length === 0) {
      toast.error('請至少新增一筆有效訂單！');
      return;
    }

    try {
      for (const order of validOrders) {
        await createDrinkOrder.mutateAsync({
          ...order,
          order_date: orderDate,
          status: 'pending',
          image_url: imageUrl
        });
      }
      
      setOrders([]);
      setImageUrl('');
      toast.success(`成功建立 ${validOrders.length} 筆飲料訂單！`);
    } catch (error) {
      console.error('建立訂單失敗:', error);
      toast.error('建立訂單失敗');
    }
  };

  const handleCheckout = async () => {
    if (existingOrders.length === 0) {
      toast.error('沒有待結帳的訂單！');
      return;
    }

    if (!confirm(`確認要結帳 ${existingOrders.length} 筆飲料訂單嗎？`)) return;

    try {
      for (const order of existingOrders) {
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
      console.error('結帳失敗:', error);
      toast.error('結帳失敗');
    }
  };

  const existingTotal = existingOrders.reduce((sum, o) => sum + o.price, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      {/* Header */}
      <div className="bg-cyan-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-cyan-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <Camera className="w-6 h-6 text-cyan-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">訂飲料</h1>
                <p className="text-cyan-100 text-sm">拍照辨識 Uber Eats 訂單</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Date Selection */}
        <Card className="p-4 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 text-sm">訂購日期：</label>
              <Input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-40"
              />
            </div>
          </div>
        </Card>

        {/* Upload Section */}
        <Card className="p-6 mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-dashed border-purple-300">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold text-purple-900">AI 自動辨識訂單</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">上傳 Uber Eats 訂單截圖或照片，AI 會自動分析訂購資訊</p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
              capture="environment"
            />
            
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || analyzing}
              className="bg-purple-600 hover:bg-purple-700 text-white"
              size="lg"
            >
              {uploading ? (
                '上傳中...'
              ) : analyzing ? (
                '分析中...'
              ) : (
                <>
                  <Upload className="w-5 h-5 mr-2" />
                  上傳訂單圖片
                </>
              )}
            </Button>

            {imageUrl && (
              <div className="mt-4 inline-block">
                <img src={imageUrl} alt="Uploaded order" className="max-h-60 rounded-lg border" />
              </div>
            )}
          </div>
        </Card>

        {/* Order Form */}
        {orders.length > 0 && (
          <Card className="p-4 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-slate-800">訂單明細</h3>
              <Button onClick={addEmptyOrder} variant="outline" size="sm">
                新增一筆
              </Button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[25%]">成員</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[35%]">訂購內容</th>
                    <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-[15%]">金額</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[15%]">付款</th>
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-[10%]"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map((order, index) => (
                    <tr key={index}>
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
                          placeholder="飲料名稱"
                          className="h-9"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Input
                          type="number"
                          min="0"
                          value={order.price}
                          onChange={(e) => updateOrder(index, 'price', parseFloat(e.target.value) || 0)}
                          placeholder="0"
                          className="h-9 text-right"
                        />
                      </td>
                      <td className="px-3 py-2">
                        <Select 
                          value={order.payment_method} 
                          onValueChange={(value) => updateOrder(index, 'payment_method', value)}
                        >
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="balance">餘額</SelectItem>
                            <SelectItem value="cash">現金</SelectItem>
                          </SelectContent>
                        </Select>
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
                  <tr className="bg-slate-50 font-bold">
                    <td colSpan="2" className="px-3 py-3 text-right">總金額</td>
                    <td className="px-3 py-3 text-right text-cyan-600">
                      ${getTotalAmount().toLocaleString()}
                    </td>
                    <td colSpan="2"></td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={orders.length === 0}
                className="bg-cyan-600 hover:bg-cyan-700 text-white"
              >
                <Save className="w-5 h-5 mr-2" />
                儲存訂單
              </Button>
            </div>
          </Card>
        )}

        {/* Existing Orders */}
        {existingOrders.length > 0 && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold text-slate-800">今日待結帳訂單</h3>
                <p className="text-sm text-slate-500">共 {existingOrders.length} 筆，總計 ${existingTotal.toLocaleString()}</p>
              </div>
              {currentUser?.role === 'admin' && (
                <Button
                  onClick={handleCheckout}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  統一結帳
                </Button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">成員</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">訂購內容</th>
                    <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700">金額</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">付款方式</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {existingOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2 text-slate-700">{order.member_name}</td>
                      <td className="px-3 py-2 text-slate-700">{order.drink_name}</td>
                      <td className="px-3 py-2 text-right font-semibold text-cyan-600">
                        ${order.price.toLocaleString()}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          order.payment_method === 'cash' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {order.payment_method === 'cash' ? '現金' : '餘額'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {orders.length === 0 && existingOrders.length === 0 && !imageUrl && (
          <Card className="p-8 text-center border-dashed">
            <Camera className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">上傳訂單圖片開始使用</p>
          </Card>
        )}
      </div>
    </div>
  );
}