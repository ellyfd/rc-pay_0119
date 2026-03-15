import React, { useState, useEffect } from 'react';
import { toast } from "sonner";
import { base44 } from '@/api/base44Client';
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
import { Upload, Plus, Trash2 } from "lucide-react";

export default function TemplateFormDialog({ open, onOpenChange, template, onSave }) {
  const [formData, setFormData] = useState({
    template_name: '',
    title: '',
    description: '',
    product_link: '',
    image_url: ''
  });
  const [products, setProducts] = useState([]);
  const [discountRules, setDiscountRules] = useState([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (template) {
      setFormData({
        template_name: template.template_name || '',
        title: template.title || '',
        description: template.description || '',
        product_link: template.product_link || '',
        image_url: template.image_url || ''
      });
      setProducts(template.products || []);
      setDiscountRules(template.discount_rules || []);
    } else {
      setFormData({
        template_name: '',
        title: '',
        description: '',
        product_link: '',
        image_url: ''
      });
      setProducts([]);
      setDiscountRules([]);
    }
  }, [template, open]);

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const result = await base44.integrations.Core.UploadFile({ file });
      setFormData({ ...formData, image_url: result.file_url });
    } catch (error) {
      toast.error('上傳失敗：' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const addProduct = () => {
    setProducts([...products, { product_name: '', price: 0, description: '' }]);
  };

  const removeProduct = (index) => {
    setProducts(products.filter((_, i) => i !== index));
  };

  const updateProduct = (index, field, value) => {
    const newProducts = [...products];
    newProducts[index][field] = value;
    setProducts(newProducts);
  };

  const handleSubmit = () => {
    if (!formData.template_name.trim()) {
      toast.error('請輸入範本名稱');
      return;
    }

    const templateData = {
      ...formData,
      products: products.filter(p => p.product_name && p.price > 0),
      discount_rules: discountRules.filter(r => r.min_quantity > 0)
    };

    onSave(templateData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? '編輯範本' : '新增範本'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label>範本名稱 *</Label>
            <Input
              value={formData.template_name}
              onChange={(e) => setFormData({ ...formData, template_name: e.target.value })}
              placeholder="例：日本零食團購範本"
            />
          </div>

          <div>
            <Label>團購標題</Label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="例：日本零食團購"
            />
          </div>

          <div>
            <Label>團購說明</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="說明團購內容..."
              rows={3}
            />
          </div>

          <div>
            <Label>商品連結</Label>
            <Input
              value={formData.product_link}
              onChange={(e) => setFormData({ ...formData, product_link: e.target.value })}
              placeholder="https://..."
              type="url"
            />
          </div>

          <div>
            <Label>商品圖片</Label>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => document.getElementById('template-image').click()}
                disabled={uploading}
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploading ? '上傳中...' : '上傳圖片'}
              </Button>
              <input
                id="template-image"
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
              <img
                src={formData.image_url}
                alt="Preview"
                className="mt-3 w-32 h-32 object-cover rounded-lg"
              />
            )}
          </div>

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
                            className="h-10 w-10 text-red-500 hover:text-red-700"
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
                            className="h-10 w-10 text-red-500 hover:text-red-700"
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
            disabled={!formData.template_name.trim()}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {template ? '更新' : '建立'}範本
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}