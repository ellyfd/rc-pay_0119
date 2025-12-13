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
import { Upload, Plus, Trash2, Link as LinkIcon, Sparkles } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateGroupBuyDialog({ open, onOpenChange, onCreate, members = [], currentUser }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_link: '',
    image_url: '',
    deadline: '',
    note: '',
    organizer_id: ''
  });
  const [discountRules, setDiscountRules] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);
  const [products, setProducts] = useState([{
    product_name: '',
    price: 0,
    description: ''
  }]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingUrl, setAnalyzingUrl] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Auto-select organizer based on current user
  React.useEffect(() => {
    if (currentUser && members.length > 0 && !formData.organizer_id) {
      const linkedMember = members.find(m => 
        m.user_emails && m.user_emails.includes(currentUser.email)
      );
      if (linkedMember) {
        setFormData(prev => ({ ...prev, organizer_id: linkedMember.id }));
      }
    }
  }, [currentUser, members]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const result = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(result.file_url);
      }
      
      const newImageUrls = [...imageUrls, ...uploadedUrls];
      setImageUrls(newImageUrls);
      
      // Keep the first image as the main image_url for backward compatibility
      if (!formData.image_url && uploadedUrls.length > 0) {
        setFormData({ ...formData, image_url: uploadedUrls[0] });
      }
    } catch (error) {
      alert('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const newImageUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newImageUrls);
    
    // Update main image_url
    if (newImageUrls.length > 0) {
      setFormData({ ...formData, image_url: newImageUrls[0] });
    } else {
      setFormData({ ...formData, image_url: '' });
    }
  };

  const handleAnalyzeImage = async () => {
    if (imageUrls.length === 0) return;

    setAnalyzing(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請分析這些圖片，提取出所有產品資訊。請以JSON格式回傳產品列表，每個產品包含：product_name（產品名稱）、price（價格，如果沒有明確價格請設為0）、description（規格或說明）。`,
        file_urls: imageUrls,
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

  const handleAnalyzeUrl = async () => {
    if (!urlInput.trim()) {
      alert('請輸入網址！');
      return;
    }

    setAnalyzingUrl(true);
    try {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請分析這個網頁 ${urlInput}，提取出所有可用的產品資訊。請以JSON格式回傳產品列表，每個產品包含：product_name（產品名稱）、price（價格，如果沒有明確價格請設為0）、description（規格或說明）。請盡可能完整地提取產品資訊，包括菜單、商品名稱、價格等。`,
        add_context_from_internet: true,
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
        // Auto-fill product_link if not already set
        if (!formData.product_link) {
          setFormData({ ...formData, product_link: urlInput });
        }
        alert(`成功識別 ${result.products.length} 個產品！`);
      } else {
        alert('未能識別出產品資訊，請手動輸入。');
      }
    } catch (error) {
      alert('分析失敗：' + error.message);
    } finally {
      setAnalyzingUrl(false);
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
      products: validProducts,
      discount_rules: discountRules.filter(r => r.min_quantity > 0)
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
    setImageUrls([]);
    setProducts([{
      product_name: '',
      price: 0,
      description: ''
    }]);
    setDiscountRules([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>開始新團購</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
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

          {/* AI Analysis Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">AI 快速辨識商品</h3>
            </div>
            
            {/* Image Upload */}
            <div>
              <Label className="text-sm">方法一：上傳圖片（可多張）</Label>
              <p className="text-xs text-slate-500 mb-2">上傳菜單或商品圖片，AI 自動識別</p>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline"
                  onClick={() => document.getElementById('groupbuy-image').click()}
                  disabled={uploading}
                  className="bg-white">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? '上傳中...' : '上傳圖片'}
                </Button>
                <input
                  id="groupbuy-image"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden" />

                {imageUrls.length > 0 &&
                <>
                    <span className="text-sm text-green-600">✓ 已上傳 {imageUrls.length} 張</span>
                    <Button
                    type="button"
                    variant="outline"
                    onClick={handleAnalyzeImage}
                    disabled={analyzing}
                    className="ml-auto bg-white">
                      {analyzing ? '分析中...' : '🤖 AI 識別產品'}
                    </Button>
                  </>
                }
              </div>
              {imageUrls.length > 0 &&
              <div className="mt-3 grid grid-cols-3 gap-2">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border" />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              }
            </div>

            {/* URL Analysis */}
            <div>
              <Label className="text-sm">方法二：貼上網址（成功率較低）</Label>
              <p className="text-xs text-slate-500 mb-2">貼上餐廳或商品網頁連結，AI 自動識別</p>
              <div className="flex gap-2">
                <Input
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="flex-1 bg-white"
                />
                <Button
                  type="button"
                  onClick={handleAnalyzeUrl}
                  disabled={analyzingUrl || !urlInput.trim()}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <LinkIcon className="w-4 h-4 mr-2" />
                  {analyzingUrl ? '分析中...' : 'AI 辨識'}
                </Button>
              </div>
            </div>
          </div>

          {/* Product Link */}
          <div>
            <Label>商品連結（選填）</Label>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url" />

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

          {/* Discount Rules */}
          <div>
            <Label className="mb-2 block">數量折扣規則（選填）</Label>
            <p className="text-xs text-slate-500 mb-3">設定達到特定數量時的折扣優惠</p>
            {discountRules.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-2">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">最低數量</th>
                      <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">折扣</th>
                      <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {discountRules.map((rule, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="1"
                            value={rule.min_quantity}
                            onChange={(e) => {
                              const newRules = [...discountRules];
                              newRules[index].min_quantity = parseInt(e.target.value) || 0;
                              setDiscountRules(newRules);
                            }}
                            placeholder="10"
                            className="h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={rule.discount_percent}
                              onChange={(e) => {
                                const newRules = [...discountRules];
                                newRules[index].discount_percent = parseFloat(e.target.value) || 0;
                                setDiscountRules(newRules);
                              }}
                              placeholder="10"
                              className="h-9"
                            />
                            <span className="text-sm text-slate-600">% off</span>
                          </div>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDiscountRules(discountRules.filter((_, i) => i !== index))}
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
            )}
            <Button
              type="button"
              onClick={() => setDiscountRules([...discountRules, { min_quantity: 0, discount_percent: 0 }])}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增折扣規則
            </Button>
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

        <DialogFooter className="flex flex-row justify-center gap-2">
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