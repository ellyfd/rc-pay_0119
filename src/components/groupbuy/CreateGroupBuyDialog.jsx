import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter } from
"@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateGroupBuyDialog({ open, onOpenChange, onCreate, members = [] }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_link: '',
    image_url: '',
    deadline: '',
    note: '',
    organizer_id: ''
  });
  const [products, setProducts] = useState([{
    product_name: '',
    price: 0,
    description: ''
  }]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: result.file_url });
    } catch (error) {
      alert('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleAnalyzeImage = async () => {
    if (!formData.image_url) return;

    setAnalyzing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請分析這張圖片，提取出所有產品資訊。請以JSON格式回傳產品列表，每個產品包含：product_name（產品名稱）、price（價格，如果沒有明確價格請設為0）、description（規格或說明）。`,
        file_urls: [formData.image_url],
        response_json_schema: {
          type: "object",
          properties: {
            products: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  product_name: { type: "string" },
                  price: { type: "number" },
                  description: { type: "string" }
                },
                required: ["product_name", "price"]
              }
            }
          },
          required: ["products"]
        }
      });

      if (result.products && result.products.length > 0) {
        setProducts(result.products);
        alert(`成功識別 ${result.products.length} 個產品！`);
      } else {
        alert('未能識別出產品資訊，請手動輸入。');
      }
    } catch (error) {
      alert('分析失敗：' + error.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, {
      product_name: '',
      price: 0,
      description: ''
    }]);
  };

  const removeProduct = (index) => {
    if (products.length > 1) {
      setProducts(products.filter((_, i) => i !== index));
    }
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleSubmit = () => {
    if (!formData.title.trim()) {
      alert('請輸入團購標題！');
      return;
    }

    if (!formData.organizer_id) {
      alert('請選擇開團者！');
      return;
    }

    // Filter valid products
    const validProducts = products.filter((p) => p.product_name && p.price > 0);

    onCreate({
      ...formData,
      products: validProducts
    });

    setFormData({
      title: '',
      description: '',
      product_link: '',
      image_url: '',
      deadline: '',
      note: '',
      organizer_id: ''
    });
    setProducts([{
      product_name: '',
      price: 0,
      description: ''
    }]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>開始新團購</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Organizer */}
          <div>
            <Label>開團者 *</Label>
            <Select 
              value={formData.organizer_id} 
              onValueChange={(value) => setFormData({ ...formData, organizer_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="選擇開團者" />
              </SelectTrigger>
              <SelectContent>
                {members.map(member => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div>
            <Label>團購標題 *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例：日本零食團購、韓國美妝團..." />

          </div>

          {/* Description */}
          <div>
            <Label>團購說明</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="說明團購內容、注意事項等..."
              rows={3} />

          </div>

          {/* Product Link */}
          <div>
            <Label>商品連結</Label>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url" />

          </div>

          {/* Image Upload */}
          <div>
            <Label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">商品圖片
(上傳圖片利用AI識別，快速新增商品列表)
            </Label>
            <div className="flex items-center gap-3">
              <Button type="button" variant="outline"
                onClick={() => document.getElementById('groupbuy-image').click()}
                disabled={uploading}>

                <Upload className="w-4 h-4 mr-2" />
                {uploading ? '上傳中...' : '上傳圖片'}
              </Button>
              <input
                id="groupbuy-image"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden" />

              {formData.image_url &&
              <>
                  <span className="text-sm text-green-600">✓ 已上傳</span>
                  <Button
                  type="button"
                  variant="outline"
                  onClick={handleAnalyzeImage}
                  disabled={analyzing}
                  className="ml-auto">

                    {analyzing ? '分析中...' : '🤖 AI 識別產品'}
                  </Button>
                </>
              }
            </div>
            {formData.image_url &&
            <div className="mt-3">
                <img
                src={formData.image_url}
                alt="Preview"
                className="w-full max-w-xs rounded-lg border" />

              </div>
            }
          </div>

          {/* Deadline */}
          <div>
            <Label>截止日期</Label>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} />

          </div>

          {/* Note */}
          <div>
            <Label>備註</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="其他說明..." />

          </div>

          {/* Products */}
          <div>
            <Label className="mb-2 block">預設商品列表（選填）</Label>
            <p className="text-xs text-slate-500 mb-3">新增商品讓參與者更方便選購，也可以稍後再新增</p>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">商品名稱</th>
                    <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-32">單價</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">說明</th>
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {products.map((product, index) =>
                  <tr key={index}>
                      <td className="px-3 py-2">
                        <Input
                        value={product.product_name}
                        onChange={(e) => updateProduct(index, 'product_name', e.target.value)}
                        placeholder="洋芋片、口紅..."
                        className="h-9" />

                      </td>
                      <td className="px-3 py-2">
                        <Input
                        type="number"
                        min="0"
                        value={product.price}
                        onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                        className="h-9 text-right" />

                      </td>
                      <td className="px-3 py-2">
                        <Input
                        value={product.description}
                        onChange={(e) => updateProduct(index, 'description', e.target.value)}
                        placeholder="規格、說明..."
                        className="h-9" />

                      </td>
                      <td className="px-3 py-2 text-center">
                        {products.length > 1 &&
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProduct(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700">

                            <Trash2 className="w-4 h-4" />
                          </Button>
                      }
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <Button
              type="button"
              onClick={addProduct}
              variant="outline"
              className="w-full mt-2">

              <Plus className="w-4 h-4 mr-2" />
              新增商品
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!formData.title.trim() || !formData.organizer_id}
            className="bg-purple-600 hover:bg-purple-700">

            建立團購
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>);

}