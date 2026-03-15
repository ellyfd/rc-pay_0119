import React from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Trash2 } from "lucide-react";

// P2-16 & P2-17: 統一商品列表編輯元件
export default function ProductListEditor({ products, setProducts }) {
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

  return (
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
                  {products.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeProduct(index)}
                      className="h-10 w-10 text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
  );
}