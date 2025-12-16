import React, { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Upload, Sparkles, Save, Trash2, Edit2, Coffee } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export default function DrinkOrder() {
  const [orderDate, setOrderDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [uploadedImageUrl, setUploadedImageUrl] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [editingIndex, setEditingIndex] = useState(null);
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
    mutationFn: (id) => base44.entities.DrinkOrder.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drinkOrders'] });
      toast.success('訂單已刪除！');
    }
  });

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
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這張 Uber Eats 訂單圖片，提取以下資訊：
1. 每個人點的飲料名稱和價格
2. 如果圖片中有顯示訂購人的名字，請一併提取
3. 計算每個人的小計

請回傳 JSON 格式的資料，包含一個訂單項目陣列。每個項目包含：
- member_name: 訂購人名字（如果圖片中有的話，否則留空）
- item_name: 飲料名稱
- price: 價格（數字）

請確保價格是數字格式，不要包含貨幣符號。`,
        file_urls: [uploadedImageUrl],
        response_json_schema: {
          type: "object",
          properties: {
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
          const matchedMember = members.find(m => 
            item.member_name && m.name.includes(item.member_name)
          );
          return {
            member_id: matchedMember?.id || '',
            member_name: matchedMember?.name || item.member_name || '',
            item_name: item.item_name,
            price: item.price
          };
        });
        setOrderItems(processedItems);
        toast.success(`AI 成功識別 ${processedItems.length} 個項目！`);
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

    await createOrder.mutateAsync({
      order_date: orderDate,
      image_url: uploadedImageUrl,
      items: orderItems,
      total_amount: totalAmount,
      status: 'pending'
    });

    setOrderItems([]);
    setUploadedImageUrl('');
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
      price: 0
    }]);
  };

  const getTotalAmount = () => {
    return orderItems.reduce((sum, item) => sum + (item.price || 0), 0);
  };

  const handleBatchFillMember = (memberId) => {
    if (!memberId) return;
    const member = members.find(m => m.id === memberId);
    if (!member) return;

    const newItems = orderItems.map(item => {
      if (!item.member_id) {
        return {
          ...item,
          member_id: memberId,
          member_name: member.name
        };
      }
      return item;
    });
    setOrderItems(newItems);
    toast.success(`已批次填入 ${member.name}`);
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
        {/* 上傳與分析區 */}
        <Card className="p-6">
          <div className="space-y-4">
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
              
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-white"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? '上傳中...' : '上傳圖片/PDF'}
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
          </div>
        </Card>

        {/* 訂單表格 */}
        {orderItems.length > 0 && (
          <Card>
            <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
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
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px]">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 w-[25%]">成員</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700 w-[40%]">訂購內容</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700 w-[20%]">金額</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700 w-[15%]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {orderItems.map((item, index) => (
                    <tr key={index} className="hover:bg-slate-50">
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
                    <td colSpan="2" className="px-4 py-3 text-right text-slate-800">總金額</td>
                    <td className="px-4 py-3 text-right text-orange-600 text-lg">
                      ${getTotalAmount().toLocaleString()}
                    </td>
                    <td></td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="p-4 bg-slate-50 border-t flex justify-between">
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
          </Card>
        )}

        {/* 今日訂單列表 */}
        {orders.length > 0 && (
          <Card>
            <div className="p-4 bg-slate-50 border-b">
              <h3 className="font-semibold text-slate-800">
                {format(new Date(orderDate), 'yyyy/MM/dd')} 的訂單
              </h3>
            </div>
            <div className="divide-y">
              {orders.map(order => (
                <div key={order.id} className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-sm text-slate-500">
                        {format(new Date(order.created_date), 'HH:mm')}
                      </span>
                      <span className="ml-3 text-sm font-semibold text-orange-600">
                        ${order.total_amount.toLocaleString()}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteOrder.mutate(order.id)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[500px] text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left px-3 py-2 text-slate-700">成員</th>
                          <th className="text-left px-3 py-2 text-slate-700">項目</th>
                          <th className="text-right px-3 py-2 text-slate-700">金額</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {order.items?.map((item, idx) => (
                          <tr key={idx}>
                            <td className="px-3 py-2">{item.member_name}</td>
                            <td className="px-3 py-2">{item.item_name}</td>
                            <td className="px-3 py-2 text-right">${item.price}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}