import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Coffee, Camera, Sparkles, CheckCircle, Trash2, Settings } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";
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

export default function DrinkOrder() {
  const fileInputRef = React.useRef(null);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [orderStatus, setOrderStatus] = useState('pending');
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageUrl, setImageUrl] = useState('');
  const [recognizedOrders, setRecognizedOrders] = useState([]);
  const [deletingOrder, setDeletingOrder] = useState(null);
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

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['drinkOrders', selectedDate, orderStatus],
    queryFn: async () => {
      const allOrders = await base44.entities.DrinkOrder.list('-created_date');
      return allOrders.filter(order => 
        order.order_date === selectedDate && order.status === orderStatus
      );
    }
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const createOrder = useMutation({
    mutationFn: async (orderData) => base44.entities.DrinkOrder.create(orderData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
    }
  });

  const updateOrder = useMutation({
    mutationFn: ({ id, data }) => base44.entities.DrinkOrder.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinkOrders'] })
  });

  const deleteOrder = useMutation({
    mutationFn: (id) => base44.entities.DrinkOrder.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['drinkOrders'] })
  });

  const createTransaction = useMutation({
    mutationFn: async (data) => base44.entities.Transaction.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['transactions'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/') && file.type !== 'application/pdf') {
      toast.error('請上傳圖片或 PDF 檔案！');
      return;
    }

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file: file });
      setImageUrl(result.file_url);
      toast.success('圖片已上傳！');
      
      // Auto-start AI analysis
      await handleAnalyzeImage(result.file_url);
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

  const handleAnalyzeImage = async (url) => {
    const imageToAnalyze = url || imageUrl;
    if (!imageToAnalyze) {
      toast.warning('請先上傳圖片');
      return;
    }

    setAnalyzing(true);
    try {
      toast.info('AI 正在分析訂單圖片...');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這張 Uber Eats 訂單截圖。提取所有飲料的資訊，包括：
1. 飲料名稱
2. 單價
3. 數量
4. 如果有備註（例如：少冰、半糖等），也請一併提取
5. 如果圖片中有訂購人的名字或暱稱，請提取出來

請回傳一個包含所有飲料訂單的 JSON 格式資料。`,
        file_urls: [imageToAnalyze],
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
                  quantity: { type: "number" },
                  note: { type: "string" },
                  member_name: { type: "string" }
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
          let matchedMember = null;
          if (order.member_name) {
            matchedMember = allMembers.find(m => 
              m.name.toLowerCase().includes(order.member_name.toLowerCase()) ||
              order.member_name.toLowerCase().includes(m.name.toLowerCase())
            );
          }
          
          return {
            ...order,
            quantity: order.quantity || 1,
            member_id: matchedMember?.id || '',
            member_name: matchedMember?.name || order.member_name || '',
            payment_method: 'balance',
            order_date: selectedDate,
            image_url: imageToAnalyze
          };
        });
        
        setRecognizedOrders(processedOrders);
        toast.success(`AI 成功識別 ${processedOrders.length} 筆飲料訂單！`);
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

  const handleUpdateRecognizedOrder = (index, field, value) => {
    const newOrders = [...recognizedOrders];
    newOrders[index][field] = value;
    
    // If member is selected, update member_id and member_name
    if (field === 'member_id') {
      const member = allMembers.find(m => m.id === value);
      if (member) {
        newOrders[index].member_name = member.name;
      }
    }
    
    setRecognizedOrders(newOrders);
  };

  const handleSaveRecognizedOrders = async () => {
    const validOrders = recognizedOrders.filter(order => 
      order.drink_name && order.price > 0 && order.member_id
    );

    if (validOrders.length === 0) {
      toast.error('請至少完成一筆有效的訂單（需要飲料名稱、價格和成員）');
      return;
    }

    try {
      for (const order of validOrders) {
        await createOrder.mutateAsync({
          ...order,
          status: 'pending'
        });
      }
      
      toast.success(`成功建立 ${validOrders.length} 筆飲料訂單！`);
      setRecognizedOrders([]);
      setImageUrl('');
    } catch (error) {
      toast.error('建立訂單失敗：' + error.message);
    }
  };

  const handleCheckoutAll = async () => {
    if (!confirm(`確認要結帳 ${orders.length} 筆訂單嗎？`)) return;

    for (const order of orders) {
      const member = allMembers.find(m => m.id === order.member_id);
      if (!member) continue;

      // Update order status
      await updateOrder.mutateAsync({
        id: order.id,
        data: { status: 'completed' }
      });

      const transactionNote = `${format(new Date(order.order_date), 'yyyy/MM/dd')} 飲料 - ${order.drink_name}`;
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

  const handleDelete = async () => {
    if (!deletingOrder) return;
    await deleteOrder.mutateAsync(deletingOrder.id);
    setDeletingOrder(null);
  };

  const totalAmount = orders.reduce((sum, order) => sum + (order.price * (order.quantity || 1)), 0);

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50">
      <div className="bg-blue-600 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-blue-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <Coffee className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">訂飲料</h1>
                <p className="text-blue-100 text-sm">快速記錄 Uber Eats 飲料訂單</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {/* AI Upload Section */}
        {recognizedOrders.length === 0 && (
          <Card className="p-6 mb-6 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-200">
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <Sparkles className="w-6 h-6 text-purple-600" />
                <h2 className="text-xl font-bold text-slate-800">AI 智能辨識</h2>
              </div>
              <p className="text-slate-600 mb-4">拍照或上傳 Uber Eats 訂單截圖或 PDF 明細，AI 自動辨識飲料和價格</p>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || analyzing}
                className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-6 text-lg"
              >
                <Camera className="w-5 h-5 mr-2" />
                {uploading ? '上傳中...' : analyzing ? 'AI 分析中...' : '上傳截圖或 PDF'}
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,.pdf"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </Card>
        )}

        {/* Recognized Orders */}
        {recognizedOrders.length > 0 && (
          <Card className="p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-slate-800">AI 辨識結果</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setRecognizedOrders([]);
                  setImageUrl('');
                }}
              >
                取消
              </Button>
            </div>

            {imageUrl && (
              <div className="mb-4">
                {imageUrl.endsWith('.pdf') ? (
                  <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-2">
                    <Coffee className="w-4 h-4" />
                    查看 PDF 明細
                  </a>
                ) : (
                  <img src={imageUrl} alt="訂單截圖" className="max-w-xs rounded-lg border" />
                )}
              </div>
            )}

            <div className="space-y-3 mb-4">
              {recognizedOrders.map((order, index) => (
                <div key={index} className="grid grid-cols-12 gap-2 items-center p-3 bg-slate-50 rounded-lg">
                  <div className="col-span-3">
                    <input
                      type="text"
                      value={order.drink_name}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'drink_name', e.target.value)}
                      placeholder="飲料名稱"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={order.price}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'price', parseFloat(e.target.value) || 0)}
                      placeholder="價格"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-1">
                    <input
                      type="number"
                      value={order.quantity}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'quantity', parseInt(e.target.value) || 1)}
                      placeholder="數量"
                      min="1"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={order.member_id}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'member_id', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="">選擇成員</option>
                      {allMembers.map(member => (
                        <option key={member.id} value={member.id}>{member.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="col-span-2">
                    <select
                      value={order.payment_method}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'payment_method', e.target.value)}
                      className="w-full px-2 py-1 border rounded text-sm"
                    >
                      <option value="balance">餘額</option>
                      <option value="cash">現金</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <input
                      type="text"
                      value={order.note || ''}
                      onChange={(e) => handleUpdateRecognizedOrder(index, 'note', e.target.value)}
                      placeholder="備註"
                      className="w-full px-2 py-1 border rounded text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>

            <Button
              onClick={handleSaveRecognizedOrders}
              className="w-full bg-blue-600 hover:bg-blue-700"
            >
              確認並建立訂單
            </Button>
          </Card>
        )}

        {/* Date and Status Filter */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <label className="font-semibold text-slate-700 text-sm whitespace-nowrap">訂購日期：</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1.5 border rounded text-sm"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={orderStatus === 'pending' ? 'default' : 'outline'}
                onClick={() => setOrderStatus('pending')}
                className={orderStatus === 'pending' ? 'bg-blue-600' : ''}
              >
                待處理
              </Button>
              <Button
                variant={orderStatus === 'completed' ? 'default' : 'outline'}
                onClick={() => setOrderStatus('completed')}
                className={orderStatus === 'completed' ? 'bg-slate-600' : ''}
              >
                已完成
              </Button>
            </div>
          </div>

          {orders.length > 0 && (
            <div className="flex items-center justify-between gap-3 pt-3 border-t">
              <div className="text-left">
                <p className="text-xs text-slate-500">訂單數</p>
                <p className="text-lg font-bold text-slate-800">{orders.length}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-slate-500">總金額</p>
                <p className="text-lg font-bold text-blue-600">${totalAmount.toLocaleString()}</p>
              </div>
              {currentUser?.role === 'admin' && orderStatus === 'pending' && (
                <Button
                  onClick={handleCheckoutAll}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  結帳全部
                </Button>
              )}
            </div>
          )}
        </Card>

        {/* Orders List */}
        {ordersLoading ? (
          <Card className="p-8 text-center">
            <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">載入中...</p>
          </Card>
        ) : orders.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Coffee className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">此日期沒有{orderStatus === 'pending' ? '待處理' : '已完成'}訂單</p>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-blue-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">成員</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">飲料</th>
                    <th className="px-4 py-3 text-center font-semibold text-slate-700 border-b">數量</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 border-b">單價</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700 border-b">小計</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">付款</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700 border-b">備註</th>
                    {currentUser?.role === 'admin' && orderStatus === 'pending' && (
                      <th className="px-4 py-3 text-center font-semibold text-slate-700 border-b">操作</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const subtotal = order.price * (order.quantity || 1);
                    return (
                      <tr key={order.id} className="border-b hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{order.member_name}</div>
                          <div className="text-xs text-slate-500">
                            {format(new Date(order.created_date), 'HH:mm')}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{order.drink_name}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{order.quantity || 1}</td>
                        <td className="px-4 py-3 text-right text-slate-700">${order.price}</td>
                        <td className="px-4 py-3 text-right font-bold text-blue-600">${subtotal}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-1 rounded ${order.payment_method === 'cash' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                            {order.payment_method === 'cash' ? '現金' : '餘額'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{order.note || '-'}</td>
                        {currentUser?.role === 'admin' && orderStatus === 'pending' && (
                          <td className="px-4 py-3 text-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingOrder(order)}
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                  <tr className="bg-blue-50 font-bold">
                    <td colSpan="4" className="px-4 py-3 text-right">總計</td>
                    <td className="px-4 py-3 text-right text-blue-600">${totalAmount.toLocaleString()}</td>
                    <td colSpan={currentUser?.role === 'admin' && orderStatus === 'pending' ? "3" : "2"}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <AlertDialog open={!!deletingOrder} onOpenChange={() => setDeletingOrder(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除訂單</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingOrder?.member_name}」的「{deletingOrder?.drink_name}」訂單嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-500 hover:bg-red-600">
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}