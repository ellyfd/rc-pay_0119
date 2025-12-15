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
import { Upload, Plus, Trash2, ZoomIn, X } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  const [showImageModal, setShowImageModal] = useState(false);
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
      setDiscountRules(groupBuy.discount_rules || []);
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
      discount_rules: discountRules.filter(r => r.min_quantity > 0)
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

        <div className="space-y-4">
          {/* Title */}
          <div>
            <Label>團購標題 *</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例：日本零食團購、韓國美妝團..."
            />
          </div>

          {/* Description */}
          <div>
            <Label>團購說明</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="說明團購內容、注意事項等..."
              rows={3}
            />
          </div>

          {/* Product Link */}
          <div>
            <Label>商品連結</Label>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url"
            />
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
            <Label>截止日期</Label>
            <Input
              type="date"
              value={formData.deadline}
              onChange={(e) => setFormData({ ...formData, deadline: e.target.value })}
            />
          </div>

          {/* Note */}
          <div>
            <Label>備註</Label>
            <Input
              value={formData.note}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="其他說明..."
            />
          </div>

          {/* Discount Rules */}
          <div>
            <Label className="mb-2 block">數量折扣規則</Label>
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
            <Label className="mb-2 block">商品列表</Label>
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