import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import imageCompression from 'browser-image-compression';
import { toast } from "sonner";
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
import { Plus, Trash2, FileText, Link2, Lock, Upload, Sparkles } from "lucide-react";
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
    organizer_id: '',
    link_settings: {
      expiration_days: null,
      access_type: 'public'
    }
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
  const [selectedTemplate, setSelectedTemplate] = useState('');

  const { data: templates = [] } = useQuery({
    queryKey: ['groupBuyTemplates'],
    queryFn: () => base44.entities.GroupBuyTemplate.list('-created_date')
  });

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

  const handleTemplateSelect = (templateId) => {
    setSelectedTemplate(templateId);
    if (!templateId) return;

    const template = templates.find(t => t.id === templateId);
    if (template) {
      setFormData(prev => ({
        ...prev,
        title: template.title || '',
        description: template.description || '',
        product_link: template.product_link || '',
        image_url: template.image_url || ''
      }));
      setProducts(template.products || [{
        product_name: '',
        price: 0,
        description: ''
      }]);
      setDiscountRules(template.discount_rules || []);
      if (template.image_url) {
        setImageUrls([template.image_url]);
      }
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        let fileToUpload = file;
        if (file.type.startsWith('image/')) {
          const options = {
            maxSizeMB: 1,
            maxWidthOrHeight: 1920,
            useWebWorker: true
          };
          try {
            fileToUpload = await imageCompression(file, options);
          } catch (compressionError) {
            console.warn('圖片壓縮失敗，使用原始檔案', compressionError);
          }
        }
        const result = await base44.integrations.Core.UploadFile({ file: fileToUpload });
        uploadedUrls.push(result.file_url);
      }
      
      const newImageUrls = [...imageUrls, ...uploadedUrls];
      setImageUrls(newImageUrls);
      
      if (!formData.image_url && uploadedUrls.length > 0) {
        setFormData({ ...formData, image_url: uploadedUrls[0] });
      }
      toast.success(`成功上傳 ${uploadedUrls.length} 張圖片！`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index) => {
    const newImageUrls = imageUrls.filter((_, i) => i !== index);
    setImageUrls(newImageUrls);
    
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
        toast.success(`AI 成功識別 ${result.products.length} 個產品！`);
      } else {
        toast.warning('未能識別出產品資訊，請手動輸入。');
      }
    } catch (error) {
      console.error('AI analysis error:', error);
      toast.error('AI 分析失敗：' + error.message);
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

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      toast.error('請輸入團購標題！');
      return;
    }

    if (!formData.organizer_id) {
      toast.error('請選擇開團者！');
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
      organizer_id: '',
      link_settings: {
        expiration_days: null,
        access_type: 'public'
      }
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
          {/* Template Selection */}
          {templates.length > 0 && (
            <div>
              <Label>從範本快速建立</Label>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="選擇範本（選填）" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>不使用範本</SelectItem>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        {template.template_name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

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

          {/* AI Image Upload & Analysis */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">AI 快速辨識商品</h3>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => document.getElementById('groupbuy-image').click()}
                  disabled={uploading}
                  className="bg-white hover:bg-purple-50"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? '上傳中...' : '上傳圖片'}
                </Button>
                <input
                  id="groupbuy-image"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                
                {imageUrls.length > 0 && (
                  <>
                    <span className="text-sm text-green-600 font-medium">✓ 已上傳 {imageUrls.length} 張</span>
                    <Button
                      type="button"
                      onClick={handleAnalyzeImage}
                      disabled={analyzing}
                      className="ml-auto bg-purple-600 hover:bg-purple-700 text-white"
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      {analyzing ? '分析中...' : 'AI 識別產品'}
                    </Button>
                  </>
                )}
              </div>
              
              {imageUrls.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {imageUrls.map((url, index) => (
                    <div key={index} className="relative group">
                      <img
                        src={url}
                        alt={`Preview ${index + 1}`}
                        className="w-full aspect-square object-cover rounded-lg border border-purple-200"
                      />
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
              <table className="w-full table-fixed">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[40%]">商品名稱</th>
                    <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-[25%]">單價</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[25%]">說明</th>
                    <th className="text-center px-2 py-2 text-sm font-semibold text-slate-700 w-[10%]"></th>
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
                      <td className="px-2 py-2 text-center">
                        {products.length > 1 &&
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeProduct(index)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 mx-auto">

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

          {/* Link Settings */}
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center gap-2">
              <Link2 className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-slate-800">分享連結設定</h3>
            </div>

            <div className="space-y-3 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="w-4 h-4 text-slate-600" />
                  <Label htmlFor="access-type" className="text-sm font-medium">訪問權限</Label>
                </div>
                <Select
                  value={formData.link_settings.access_type}
                  onValueChange={(value) => setFormData({
                    ...formData,
                    link_settings: { ...formData.link_settings, access_type: value }
                  })}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">公開</SelectItem>
                    <SelectItem value="members_only">僅成員</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="expiration" className="text-sm font-medium">連結有效期（天數）</Label>
                <Input
                  id="expiration"
                  type="number"
                  min="1"
                  placeholder="不設限（留空表示永久有效）"
                  value={formData.link_settings.expiration_days || ''}
                  onChange={(e) => setFormData({
                    ...formData,
                    link_settings: { 
                      ...formData.link_settings, 
                      expiration_days: e.target.value ? parseInt(e.target.value) : null 
                    }
                  })}
                  className="h-9"
                />
                <p className="text-xs text-slate-500">
                  {formData.link_settings.expiration_days 
                    ? `連結將在 ${formData.link_settings.expiration_days} 天後過期`
                    : '連結永久有效'}
                </p>
              </div>
            </div>
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