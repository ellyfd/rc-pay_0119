import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import imageCompression from 'browser-image-compression';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Upload, Plus, Trash2, ZoomIn, X, ChevronDown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export default function EditGroupBuyDialog({ open, onOpenChange, groupBuy, onSave }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    product_link: '',
    image_url: '',
    deadline: '',
    note: ''
  });
  const [uploading, setUploading] = useState(false);
  const [products, setProducts] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [discountRuleType, setDiscountRuleType] = useState('quantity');
  const [discountType, setDiscountType] = useState('percent');
  const [fixedDiscountAllocation, setFixedDiscountAllocation] = useState('per_item');
  const [showImageModal, setShowImageModal] = useState(false);
  const [showTipExample, setShowTipExample] = useState(false);
  const [showAllocationTip, setShowAllocationTip] = useState(false);
  const queryClient = useQueryClient();

  const { data: existingProducts = [] } = useQuery({
    queryKey: ['groupBuyProducts', groupBuy?.id],
    queryFn: async () => {
      const allProducts = await base44.entities.GroupBuyProduct.list('-created_date');
      return allProducts.filter(p => p.group_buy_id === groupBuy?.id);
    },
    enabled: !!groupBuy?.id && open
  });

  useEffect(() => {
    if (groupBuy) {
      setFormData({
        title: groupBuy.title || '',
        description: groupBuy.description || '',
        product_link: groupBuy.product_link || '',
        image_url: groupBuy.image_url || '',
        deadline: groupBuy.deadline || '',
        note: groupBuy.note || ''
      });
      const rules = groupBuy.discount_rules || [];
      setDiscountRules(rules);
      setFixedDiscountAllocation(groupBuy.fixed_discount_allocation || 'per_item');
      
      // 根據現有折扣規則設定類型
      if (rules.length > 0) {
        const firstRule = rules[0];
        setDiscountRuleType(firstRule.type || 'quantity');
        setDiscountType(firstRule.discount_type || 'percent');
      }
    }
  }, [groupBuy]);

  useEffect(() => {
    if (existingProducts.length > 0) {
      setProducts(existingProducts.map(p => ({
        id: p.id,
        product_name: p.product_name,
        price: p.price,
        description: p.description || ''
      })));
    } else {
      setProducts([]);
    }
  }, [existingProducts]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Compress image before upload
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
      setFormData({ ...formData, image_url: result.file_url });
    } catch (error) {
      const toast = await import('sonner');
      toast.toast.error('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
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
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleSubmit = async () => {
    if (!formData.title.trim()) {
      const toast = await import('sonner');
      toast.toast.error('請輸入團購標題！');
      return;
    }

    // Save group buy data
    await onSave({
      ...formData,
      discount_rules: discountRules.filter(r => {
        const hasCondition = (r.type === 'quantity' && r.min_quantity > 0) || 
                            (r.type === 'amount' && r.min_amount > 0);
        const hasDiscount = (r.discount_type === 'percent' && r.discount_percent > 0) || 
                           (r.discount_type === 'fixed' && r.discount_amount > 0);
        return hasCondition && hasDiscount;
      }),
      fixed_discount_allocation: fixedDiscountAllocation
    });

    // Handle products
    const validProducts = products.filter(p => p.product_name && p.price > 0);
    
    // Delete removed products
    for (const existingProduct of existingProducts) {
      const stillExists = validProducts.find(p => p.id === existingProduct.id);
      if (!stillExists) {
        await base44.entities.GroupBuyProduct.delete(existingProduct.id);
      }
    }

    // Update or create products
    for (const product of validProducts) {
      if (product.id) {
        // Update existing
        await base44.entities.GroupBuyProduct.update(product.id, {
          product_name: product.product_name,
          price: product.price,
          description: product.description
        });
      } else {
        // Create new
        await base44.entities.GroupBuyProduct.create({
          group_buy_id: groupBuy.id,
          product_name: product.product_name,
          price: product.price,
          description: product.description
        });
      }
    }

    queryClient.invalidateQueries({ queryKey: ['groupBuyProducts'] });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>編輯團購</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Basic Info Section */}
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-800 text-sm border-b pb-2">📝 基本資訊</h3>
            
            {/* Title */}
            <div>
              <Label className="text-slate-700">團購標題 <span className="text-red-500">*</span></Label>
              <p className="text-xs text-slate-500 mb-1.5">設定一個吸引人的標題</p>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="例：日本零食團購、韓國美妝團..."
              />
            </div>

            {/* Description */}
            <div>
              <Label className="text-slate-700">團購說明（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">詳細說明團購內容、注意事項等</p>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="說明團購內容、注意事項等..."
                rows={3}
              />
            </div>

            {/* Product Link */}
            <div>
              <Label className="text-slate-700">商品連結（選填）</Label>
              <p className="text-xs text-slate-500 mb-1.5">可貼上購物網站連結</p>
              <Input
                value={formData.product_link}
                onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
                placeholder="https://..."
                type="url"
              />
            </div>
          </div>

          {/* Image Upload */}
          <div>
            <Label>商品圖片</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('edit-groupbuy-image').click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? '上傳中...' : '上傳圖片'}
              </Button>
              <input
                id="edit-groupbuy-image"
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
              {formData.image_url && (
                <span className="text-sm text-green-600">✓ 已上傳</span>
              )}
            </div>
            {formData.image_url && (
              <div 
                className="mt-3 relative bg-slate-100 rounded-lg overflow-hidden cursor-pointer group h-48 max-w-xs"
                onClick={() => setShowImageModal(true)}
              >
                <img
                  src={formData.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center">
                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
            )}
          </div>

          {/* Deadline */}
          <div>
            <Label className="text-slate-700">截止日期（選填）</Label>
            <p className="text-xs text-slate-500 mb-1.5">設定團購截止時間</p>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          {/* Note */}
          <div>
            <Label className="text-slate-700">備註（選填）</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="其他說明..."
            />
          </div>

          {/* Discount Rules */}
          <div className="space-y-3">
            <div>
              <h3 className="font-semibold text-slate-800 text-sm border-b pb-2 mb-3">💰 團購優惠規則（選填）</h3>
              
              {/* Example Tips - Collapsible */}
              <Collapsible open={showTipExample} onOpenChange={setShowTipExample} className="mb-3">
                <CollapsibleTrigger className="w-full">
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 hover:bg-amber-100 transition-colors">
                    <ChevronDown className={`w-4 h-4 text-amber-700 transition-transform ${showTipExample ? 'rotate-180' : ''}`} />
                    <span className="text-xs font-semibold text-amber-800">📌 設定折扣規則範例</span>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 border-t-0">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    • 按數量：滿 10 件打 9 折、滿 20 件全團折 $500<br/>
                    • 按金額：滿 $5,000 打 9 折、滿 $10,000 全團折 $1,000
                  </p>
                </CollapsibleContent>
              </Collapsible>
            </div>
            
            {/* Global Type Selectors */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 p-3 bg-slate-50 rounded-lg border">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-slate-700">折扣類型</Label>
                <Select value={discountRuleType} onValueChange={setDiscountRuleType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="quantity">數量</SelectItem>
                    <SelectItem value="amount">金額</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs font-medium text-slate-700">優惠方式</Label>
                <Select value={discountType} onValueChange={setDiscountType}>
                  <SelectTrigger className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">百分比</SelectItem>
                    <SelectItem value="fixed">固定金額</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {discountType === 'fixed' && (
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-medium text-slate-700">分攤方式</Label>
                  <Select value={fixedDiscountAllocation} onValueChange={setFixedDiscountAllocation}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="proportional">按比例</SelectItem>
                      <SelectItem value="per_item">按項目</SelectItem>
                      <SelectItem value="per_member">按人數</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {discountRules.length > 0 && (
              <div className="border rounded-lg overflow-hidden mb-2">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">
                        {discountRuleType === 'quantity' ? '達標數量' : '達標金額'}
                      </th>
                      <th className="text-left px-3 py-2 text-xs font-semibold text-slate-700">
                        {discountType === 'percent' ? '折扣百分比' : '折扣金額'}
                      </th>
                      <th className="text-center px-3 py-2 text-xs font-semibold text-slate-700 w-12"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {discountRules.map((rule, index) => (
                      <tr key={index} className="hover:bg-slate-50">
                        <td className="px-3 py-1.5">
                          {discountRuleType === 'amount' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-500">$</span>
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
                                className="h-8 text-sm"
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
                              className="h-8 text-sm"
                            />
                          )}
                        </td>
                        <td className="px-3 py-1.5">
                          {discountType === 'fixed' ? (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-slate-500">-$</span>
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
                                className="h-8 text-sm"
                              />
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
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
                                className="h-8 text-sm"
                              />
                              <span className="text-xs text-slate-500">%</span>
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-1.5 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => setDiscountRules(discountRules.filter((_, i) => i !== index))}
                            className="h-7 w-7 text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
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
              <p className="text-xs text-slate-500 mb-3">管理團購的商品項目，方便參與者選購</p>
            </div>
            {products.length > 0 ? (
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
                    {products.map((product, index) => (
                      <tr key={index}>
                        <td className="px-3 py-2">
                          <Input
                            value={product.product_name}
                            onChange={(e) => updateProduct(index, 'product_name', e.target.value)}
                            placeholder="洋芋片、口紅..."
                            className="h-9"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            value={product.price}
                            onChange={(e) => updateProduct(index, 'price', parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="h-9 text-right"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Input
                            value={product.description}
                            onChange={(e) => updateProduct(index, 'description', e.target.value)}
                            placeholder="規格、說明..."
                            className="h-9"
                          />
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeProduct(index)}
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
            ) : null}
            <Button
              type="button"
              onClick={addProduct}
              variant="outline"
              className="w-full mt-2"
            >
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
            disabled={!formData.title.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            儲存變更
            </Button>
            </DialogFooter>

            {/* Image Modal */}
            {showImageModal && formData.image_url && (
            <div 
            className="fixed inset-0 z-50 bg-black/90 overflow-auto p-4"
            onClick={() => setShowImageModal(false)}
            >
            <button
              onClick={() => setShowImageModal(false)}
              className="sticky top-4 left-full bg-white/10 hover:bg-white/20 rounded-full p-2 transition-colors z-10 mb-4"
            >
              <X className="w-6 h-6 text-white" />
            </button>
            <img
              src={formData.image_url}
              alt="Preview"
              className="w-full h-auto max-w-7xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            />
            </div>
            )}
            </DialogContent>
            </Dialog>
            );
}