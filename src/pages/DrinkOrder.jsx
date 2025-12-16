import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Camera, Upload, Sparkles, Trash2, Edit, CheckCircle, Coffee } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function DrinkOrder() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [uploadedFileUrl, setUploadedFileUrl] = useState('');
  const [analyzedOrders, setAnalyzedOrders] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();
  const fileInputRef = React.useRef(null);

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

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['drinkOrders', selectedDate],
    queryFn: async () => {
      const allOrders = await base44.entities.DrinkOrder.list('-created_date');
      return allOrders.filter(order => order.order_date === selectedDate);
    }
  });

  const createOrder = useMutation({
    mutationFn: (data) => base44.entities.DrinkOrder.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('已新增飲料訂單');
    }
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DrinkOrder.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('已更新訂單');
    }
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => base44.entities.DrinkOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('已刪除訂單');
    }
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
      toast.success('檔案上傳成功');
      
      // Auto-trigger AI analysis
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
        prompt: `請仔細分析這張 Uber Eats 訂單圖片或 PDF。提取所有飲料的名稱、價格、數量和可能的訂購者姓名。如果有備註（如甜度、冰塊）也請一併提取。請回傳 JSON 格式的訂單列表。`,
        file_urls: [fileUrl],
        response_json_schema: {
          type: "object",
          properties: {
            orders: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  drink_name: { type: "string" },
                  price: { type: "number" },
                  quantity: { type: "number", default: 1 },
                  member_name: { type: "string" },
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
        // Match member names with existing members
        const processedOrders = result.orders.map(order => {
          const matchedMember = members.find(m => 
            m.name.toLowerCase().includes(order.member_name?.toLowerCase() || '') ||
            order.member_name?.toLowerCase().includes(m.name.toLowerCase())
          );
          
          return {
            ...order,
            member_id: matchedMember?.id || '',
            member_name: matchedMember?.name || order.member_name || '',
            payment_method: 'balance',
            order_date: selectedDate,
            image_url: fileUrl
          };
        });

        setAnalyzedOrders(processedOrders);
        toast.success(`AI 成功識別 ${result.orders.length} 筆訂單！`);
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

  const updateAnalyzedOrder = (index, field, value) => {
    const newOrders = [...analyzedOrders];
    newOrders[index][field] = value;
    
    // If member_id changed, update member_name
    if (field === 'member_id') {
      const member = members.find(m => m.id === value);
      if (member) {
        newOrders[index].member_name = member.name;
      }
    }
    
    setAnalyzedOrders(newOrders);
  };

  const removeAnalyzedOrder = (index) => {
    setAnalyzedOrders(analyzedOrders.filter((_, i) => i !== index));
  };

  const handleSaveAnalyzedOrders = async () => {
    if (analyzedOrders.length === 0) {
      toast.warning('沒有訂單可儲存');
      return;
    }

    const invalidOrders = analyzedOrders.filter(order => !order.member_id || !order.drink_name || !order.price);
    if (invalidOrders.length > 0) {
      toast.error('請填寫所有必填欄位（成員、飲料名稱、價格）');
      return;
    }

    try {
      for (const order of analyzedOrders) {
        await createOrder.mutateAsync(order);
      }
      setAnalyzedOrders([]);
      setUploadedFileUrl('');
      toast.success('所有訂單已建立！');
    } catch (error) {
      toast.error('建立訂單失敗');
    }
  };

  const handleCheckoutAll = async () => {
    const pendingOrders = orders.filter(o => o.status === 'pending');
    if (pendingOrders.length === 0) {
      toast.warning('沒有待結帳的訂單');
      return;
    }

    if (!confirm(`確認要結帳 ${pendingOrders.length} 筆訂單嗎？`)) return;

    for (const order of pendingOrders) {
      const member = members.find(m => m.id === order.member_id);
      if (!member) continue;

      await updateOrder.mutateAsync({
        id: order.id,
        data: { status: 'completed' }
      });

      const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 飲料訂單`;
      const totalAmount = order.price * (order.quantity || 1);

      if (order.payment_method === 'balance') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: totalAmount,
          wallet_type: 'balance',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { balance: (member.balance || 0) - totalAmount }
        });
      } else if (order.payment_method === 'cash') {
        await createTransaction.mutateAsync({
          type: 'withdraw',
          amount: totalAmount,
          wallet_type: 'cash',
          from_member_id: member.id,
          from_member_name: member.name,
          note: transactionNote
        });

        await updateMember.mutateAsync({
          id: member.id,
          data: { cash_balance: (member.cash_balance || 0) - totalAmount }
        });
      }
    }

    toast.success('結帳完成！');
  };

  const pendingOrders = orders.filter(o => o.status === 'pending');
  const totalAmount = pendingOrders.reduce((sum, o) => sum + (o.price * (o.quantity || 1)), 0);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-orange-50">
      {/* Header */}
      <div className="bg-amber-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-amber-500 -ml-2 mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
              <Coffee className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">訂飲料</h1>
              <p className="text-amber-100 text-sm">AI 辨識 Uber Eats 訂單快速記帳</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Upload and AI Analysis Section */}
        <Card className="p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-600" />
            上傳訂單並 AI 辨識
          </h2>
          
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || analyzing}
              className="bg-amber-500 hover:bg-amber-600 text-white flex-1"
            >
              <Camera className="w-5 h-5 mr-2" />
              {uploading ? '上傳中...' : '拍照或選擇檔案'}
            </Button>
          </div>

          {uploadedFileUrl && (
            <div className="mb-4">
              <img src={uploadedFileUrl} alt="Uploaded order" className="max-w-full h-auto rounded-lg border" />
            </div>
          )}

          {analyzing && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto mb-3" />
              <p className="text-slate-600">AI 正在分析訂單...</p>
            </div>
          )}

          {analyzedOrders.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-semibold text-slate-800">AI 辨識結果（請確認並修改）</h3>
              {analyzedOrders.map((order, index) => (
                <Card key={index} className="p-4 border-2 border-amber-200">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">成員 *</label>
                      <Select
                        value={order.member_id}
                        onValueChange={(value) => updateAnalyzedOrder(index, 'member_id', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="選擇成員" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map(m => (
                            <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">飲料名稱 *</label>
                      <Input
                        value={order.drink_name}
                        onChange={(e) => updateAnalyzedOrder(index, 'drink_name', e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">價格 *</label>
                      <Input
                        type="number"
                        value={order.price}
                        onChange={(e) => updateAnalyzedOrder(index, 'price', parseFloat(e.target.value) || 0)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">數量</label>
                      <Input
                        type="number"
                        value={order.quantity || 1}
                        onChange={(e) => updateAnalyzedOrder(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="h-9"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-600 mb-1 block">付款方式</label>
                      <Select
                        value={order.payment_method}
                        onValueChange={(value) => updateAnalyzedOrder(index, 'payment_method', value)}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="balance">餘額</SelectItem>
                          <SelectItem value="cash">現金</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <Input
                      value={order.note || ''}
                      onChange={(e) => updateAnalyzedOrder(index, 'note', e.target.value)}
                      placeholder="備註（甜度、冰塊等）"
                      className="flex-1 h-9"
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAnalyzedOrder(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </Card>
              ))}
              
              {/* Payment Summary Table */}
              <Card className="p-4 bg-gradient-to-br from-emerald-50 to-green-50 border-2 border-emerald-300">
                <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                  支付摘要
                </h4>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-white border-b-2 border-emerald-200">
                      <tr>
                        <th className="px-3 py-2 text-left text-sm font-semibold text-slate-700">成員</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-slate-700">品項數</th>
                        <th className="px-3 py-2 text-right text-sm font-semibold text-slate-700">總金額</th>
                        <th className="px-3 py-2 text-center text-sm font-semibold text-slate-700">付款方式</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-emerald-100">
                      {(() => {
                        const summary = analyzedOrders.reduce((acc, order) => {
                          const key = order.member_name || '未指定';
                          if (!acc[key]) {
                            acc[key] = {
                              member_name: key,
                              count: 0,
                              total: 0,
                              payment_method: order.payment_method
                            };
                          }
                          acc[key].count += order.quantity || 1;
                          acc[key].total += order.price * (order.quantity || 1);
                          return acc;
                        }, {});
                        
                        return Object.values(summary).map((item, idx) => (
                          <tr key={idx} className="bg-white hover:bg-emerald-50">
                            <td className="px-3 py-3 font-medium text-slate-800">{item.member_name}</td>
                            <td className="px-3 py-3 text-right text-slate-700">{item.count} 項</td>
                            <td className="px-3 py-3 text-right font-bold text-emerald-600 text-lg">${item.total.toLocaleString()}</td>
                            <td className="px-3 py-3 text-center">
                              <Badge className={item.payment_method === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
                                {item.payment_method === 'cash' ? '現金' : 'RC Pay'}
                              </Badge>
                            </td>
                          </tr>
                        ));
                      })()}
                      <tr className="bg-emerald-100 font-bold">
                        <td className="px-3 py-3 text-slate-800">總計</td>
                        <td className="px-3 py-3 text-right text-slate-800">
                          {analyzedOrders.reduce((sum, o) => sum + (o.quantity || 1), 0)} 項
                        </td>
                        <td className="px-3 py-3 text-right text-emerald-700 text-xl">
                          ${analyzedOrders.reduce((sum, o) => sum + (o.price * (o.quantity || 1)), 0).toLocaleString()}
                        </td>
                        <td></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <Button
                onClick={handleSaveAnalyzedOrders}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white py-6 text-lg"
              >
                <CheckCircle className="w-5 h-5 mr-2" />
                確認並儲存所有訂單
              </Button>
            </div>
          )}
        </Card>

        {/* Orders List */}
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700">訂購日期：</label>
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-40"
              />
            </div>
            {currentUser?.role === 'admin' && pendingOrders.length > 0 && (
              <Button
                onClick={handleCheckoutAll}
                className="bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                結帳全部（${totalAmount.toLocaleString()}）
              </Button>
            )}
          </div>

          {ordersLoading ? (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-amber-300 border-t-amber-600 rounded-full animate-spin mx-auto" />
            </div>
          ) : orders.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Coffee className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              此日期沒有訂單
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-amber-50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">成員</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">飲料</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">數量</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">單價</th>
                    <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700">小計</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">付款</th>
                    <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">狀態</th>
                    {currentUser?.role === 'admin' && (
                      <th className="px-4 py-3 text-center text-sm font-semibold text-slate-700">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orders.map(order => {
                    const subtotal = order.price * (order.quantity || 1);
                    return (
                      <tr key={order.id} className="hover:bg-amber-50">
                        <td className="px-4 py-3 text-slate-800">{order.member_name}</td>
                        <td className="px-4 py-3">
                          <div className="text-slate-800">{order.drink_name}</div>
                          {order.note && (
                            <div className="text-xs text-slate-500">{order.note}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">{order.quantity || 1}</td>
                        <td className="px-4 py-3 text-right text-slate-700">${order.price}</td>
                        <td className="px-4 py-3 text-right font-semibold text-amber-600">${subtotal}</td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={order.payment_method === 'cash' ? 'bg-amber-500' : 'bg-blue-500'}>
                            {order.payment_method === 'cash' ? '現金' : '餘額'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={order.status === 'completed' ? 'bg-green-500' : 'bg-slate-400'}>
                            {order.status === 'completed' ? '已完成' : '待處理'}
                          </Badge>
                        </td>
                        {currentUser?.role === 'admin' && (
                          <td className="px-4 py-3 text-center">
                            {order.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => deleteOrder.mutate(order.id)}
                                className="h-8 w-8 text-red-500 hover:text-red-700"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}