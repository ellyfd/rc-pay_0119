import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import { Upload, Plus, Trash2, Sparkles, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function CreateGroupBuyDialog({ open, onOpenChange, onCreate, members = [], currentUser }) {
  const fileInputRef = React.useRef(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_link: '',
    image_url: '',
    deadline: '',
    organizer_id: ''
  });
  const [discountRules, setDiscountRules] = useState([]);
  const [discountRuleType, setDiscountRuleType] = useState('quantity'); // 全局折扣類型
  const [discountType, setDiscountType] = useState('percent'); // 全局折扣方式
  const [fixedDiscountAllocation, setFixedDiscountAllocation] = useState('per_item'); // 固定金額折扣分攤方式
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
    if (files.length === 0) {
      console.log('No files selected');
      return;
    }

    console.log(`開始上傳 ${files.length} 個檔案`);
    setUploading(true);
    
    try {
      const uploadedUrls = [];
      
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`上傳檔案 ${i + 1}:`, file.name, file.type, file.size);
        
        if (!file.type.startsWith('image/')) {
          toast.warning(`${file.name} 不是圖片檔案`);
          continue;
        }
        
        try {
          const result = await base44.integrations.Core.UploadFile({ file: file });
          console.log('上傳成功:', result.file_url);
          uploadedUrls.push(result.file_url);
          toast.success(`已上傳 ${file.name}`);
        } catch (uploadError) {
          console.error(`上傳 ${file.name} 失敗:`, uploadError);
          toast.error(`${file.name} 上傳失敗`);
        }
      }
      
      if (uploadedUrls.length > 0) {
        const newImageUrls = [...imageUrls, ...uploadedUrls];
        setImageUrls(newImageUrls);
        console.log('所有圖片 URLs:', newImageUrls);
        
        if (!formData.image_url) {
          setFormData({ ...formData, image_url: uploadedUrls[0] });
        }
        
        toast.success(`成功上傳 ${uploadedUrls.length} 張圖片`);
      }
      
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('上傳錯誤:', error);
      toast.error('上傳失敗：' + (error.message || '未知錯誤'));
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
    
    toast.success('已移除圖片');
  };

  const handleAnalyzeImage = async () => {
    if (imageUrls.length === 0) {
      toast.warning('請先上傳圖片');
      return;
    }

    console.log('開始 AI 分析，圖片 URLs:', imageUrls);
    setAnalyzing(true);
    
    try {
      toast.info('AI 正在分析圖片...');
      
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `請仔細分析這些圖片中的產品資訊。提取所有產品的名稱、價格和規格說明。如果圖片中有價格資訊請一定要提取出來。請回傳 JSON 格式的產品列表。`,
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

      console.log('AI 分析結果:', result);

      if (result && result.products && result.products.length > 0) {
        setProducts(result.products);
        toast.success(`AI 成功識別 ${result.products.length} 個產品！`);
      } else {
        toast.warning('AI 未能識別出產品資訊，請手動輸入');
      }
    } catch (error) {
      console.error('AI 分析錯誤:', error);
      toast.error('AI 分析失敗：' + (error.message || '未知錯誤'));
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

    await onCreate({
      ...formData,
      products: validProducts,
      discount_rules: discountRules.filter(r => {
        const hasCondition = (r.type === 'quantity' && r.min_quantity > 0) || 
                            (r.type === 'amount' && r.min_amount > 0);
        const hasDiscount = (r.discount_type === 'percent' && r.discount_percent > 0) || 
                           (r.discount_type === 'fixed' && r.discount_amount > 0);
        return hasCondition && hasDiscount;
      }),
      fixed_discount_allocation: fixedDiscountAllocation
    });

    setFormData({
      title: '',
      description: '',
      product_link: '',
      image_url: '',
      deadline: '',
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

        <div className="space-y-5">
          {/* Template Selection */}
          {templates.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <Label className="text-blue-900 font-semibold flex items-center gap-2 mb-2">
                <FileText className="w-4 h-4" />
                從範本快速建立（選填）
              </Label>
              <p className="text-xs text-blue-700 mb-2">使用之前儲存的範本，快速填入團購資訊</p>
              <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
                <SelectTrigger className="bg-white">
                  <SelectValue placeholder="選擇範本..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={null}>不使用範本</SelectItem>
                  {templates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.template_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Basic Info Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">📝 基本資訊</h3>
            
            {/* Title */}
            <div>
              <Label className="text-slate-700">團購標題 <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500 mb-1.5">設定一個吸引人的標題，讓大家知道這是什麼團購</p>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例：日本零食團購、韓國美妝團..." />
            </div>

            {/* Description */}
            <div>
              <Label className="text-slate-700">團購說明（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">詳細說明團購內容、注意事項、運費規則等</p>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="例：日本零食，運費平分，預計到貨時間..."
                rows={3} />
            </div>

            {/* Deadline */}
            <div>
              <Label className="text-slate-700">截止日期（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">設定團購截止時間</p>
              <Input
                type="date"
                value={formData.deadline}
                onChange={(e) => setFormData({ ...formData, deadline: e.target.value })} />
            </div>
          </div>

          {/* AI Analysis Section */}
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">🤖 AI 快速辨識商品</h3>
            </div>
            <p className="text-xs text-purple-700 mb-3">上傳商品圖片，AI 會自動識別商品名稱和價格</p>
            
            {/* Image Upload */}
            <div>
              <Label className="text-sm">上傳圖片（可多張）</Label>
              <div className="flex items-center gap-3">
                <Button type="button" variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="bg-white">
                  <Upload className="w-4 h-4 mr-2" />
                  {uploading ? '上傳中...' : '上傳圖片'}
                </Button>
                <input
                  ref={fileInputRef}
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
          </div>

          {/* Product Link */}
          <div>
            <Label className="text-slate-700">商品連結（選填）</Label>
            <p className="text-xs text-slate-500 mb-1.5">可貼上購物網站連結，方便參與者查看商品詳情</p>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url" />
          </div>

          {/* Discount Rules */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2 mb-3">💰 團購優惠規則（選填）</h3>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-amber-800 leading-relaxed">
                  <span className="font-semibold">設定折扣規則範例：</span><br/>
                  • 按數量：滿 10 件打 9 折、滿 20 件全團折 $500<br/>
                  • 按金額：滿 $5,000 打 9 折、滿 $10,000 全團折 $1,000
                </p>
              </div>
            </div>
            
            {/* Global Type Selectors */}
            <div className="space-y-3">
              <div className="flex gap-4 p-3 bg-slate-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">折扣類型：</Label>
                  <Select value={discountRuleType} onValueChange={setDiscountRuleType}>
                    <SelectTrigger className="h-9 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="quantity">數量</SelectItem>
                      <SelectItem value="amount">金額</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm whitespace-nowrap">優惠方式：</Label>
                  <Select value={discountType} onValueChange={setDiscountType}>
                    <SelectTrigger className="h-9 w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percent">百分比</SelectItem>
                      <SelectItem value="fixed">固定金額</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {discountType === 'fixed' && (
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Label className="text-sm text-blue-900 font-semibold mb-2 block">固定金額折扣分攤方式</Label>
                  <Select value={fixedDiscountAllocation} onValueChange={setFixedDiscountAllocation}>
                    <SelectTrigger className="h-9 bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proportional">
                        <div>
                          <div className="font-medium">按比例分攤</div>
                          <div className="text-xs text-slate-500">依各商品原價比例分配折扣</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="per_item">
                        <div>
                          <div className="font-medium">按項目分攤</div>
                          <div className="text-xs text-slate-500">每個商品平均分攤折扣</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="per_member">
                        <div>
                          <div className="font-medium">按人頭數分攤</div>
                          <div className="text-xs text-slate-500">每位參與者平均分攤折扣</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {discountRules.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-2">
                <table className="w-full">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">
                        達標條件 ({discountRuleType === 'quantity' ? '數量' : '金額'})
                      </th>
                      <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700">
                        折扣 ({discountType === 'percent' ? '百分比' : '固定金額'})
                      </th>
                      <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {discountRules.map((rule, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          {discountRuleType === 'amount' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">$</span>
                              <Input
                                type="number"
                                min="1"
                                value={rule.min_amount || 0}
                                onChange={(e) => {
                                  const newRules = [...discountRules];
                                  newRules[index].min_amount = parseInt(e.target.value) || 0;
                                  setDiscountRules(newRules);
                                }}
                                placeholder="1000"
                                className="h-9"
                              />
                            </div>
                          ) : (
                            <Input
                              type="number"
                              min="1"
                              value={rule.min_quantity || 0}
                              onChange={(e) => {
                                const newRules = [...discountRules];
                                newRules[index].min_quantity = parseInt(e.target.value) || 0;
                                setDiscountRules(newRules);
                              }}
                              placeholder="10"
                              className="h-9"
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          {discountType === 'fixed' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-slate-600">-$</span>
                              <Input
                                type="number"
                                min="0"
                                value={rule.discount_amount || 0}
                                onChange={(e) => {
                                  const newRules = [...discountRules];
                                  newRules[index].discount_amount = parseFloat(e.target.value) || 0;
                                  setDiscountRules(newRules);
                                }}
                                placeholder="100"
                                className="h-9"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="0"
                                max="100"
                                value={rule.discount_percent || 0}
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
                          )}
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
              onClick={() => {
                const newRule = {
                  type: discountRuleType,
                  discount_type: discountType
                };
                if (discountRuleType === 'quantity') {
                  newRule.min_quantity = 0;
                } else {
                  newRule.min_amount = 0;
                }
                if (discountType === 'percent') {
                  newRule.discount_percent = 0;
                } else {
                  newRule.discount_amount = 0;
                }
                setDiscountRules([...discountRules, newRule]);
              }}
              variant="outline"
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增折扣規則
            </Button>
          </div>

          {/* Products */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2 mb-3">🛍️ 商品列表（選填）</h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-3">
                <p className="text-xs text-green-800 leading-relaxed">
                  <span className="font-semibold">提示：</span>先新增商品列表，參與者就能快速點選訂購。也可以建立團購後再慢慢新增商品。
                </p>
              </div>
            </div>
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full table-auto">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[40%]">商品名稱</th>
                    <th className="text-right px-3 py-2 text-sm font-semibold text-slate-700 w-[25%]">單價</th>
                    <th className="text-left px-3 py-2 text-sm font-semibold text-slate-700 w-[25%]">說明</th>
                    <th className="text-center px-3 py-2 text-sm font-semibold text-slate-700 w-[10%]"></th>
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