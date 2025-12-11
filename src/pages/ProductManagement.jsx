import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Package, Edit, Trash2, Eye, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import ProductFormDialog from "@/components/food/ProductFormDialog";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
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

export default function ProductManagement() {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(user => setCurrentUser(user)).catch(() => {});
  }, []);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list('-created_date')
  });

  const createProduct = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const deleteProduct = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['products'] })
  });

  const handleSave = async (productData) => {
    if (editingProduct) {
      await updateProduct.mutateAsync({ id: editingProduct.id, data: productData });
    } else {
      await createProduct.mutateAsync(productData);
    }
    setShowForm(false);
    setEditingProduct(null);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (deletingProduct) {
      await deleteProduct.mutateAsync(deletingProduct.id);
      setDeletingProduct(null);
    }
  };

  const handleToggleActive = async (product) => {
    await updateProduct.mutateAsync({
      id: product.id,
      data: { is_active: !product.is_active }
    });
  };

  const mealBoxes = products.filter(p => p.category === 'meal_box');
  const sideDishes = products.filter(p => p.category === 'side_dish');

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-50">
      <div className="bg-emerald-600 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link to={createPageUrl('FoodOrder')}>
            <Button variant="ghost" className="text-white hover:bg-emerald-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回訂餐
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">產品管理</h1>
              <p className="text-emerald-100 text-sm">管理餐盒和單點產品</p>
            </div>
            {currentUser?.role === 'admin' && (
              <Button
                onClick={() => {
                  setEditingProduct(null);
                  setShowForm(true);
                }}
                className="bg-white text-emerald-600 hover:bg-emerald-50"
              >
                <Plus className="w-5 h-5 mr-2" />
                新增產品
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Meal Boxes */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            餐盒系列
            <Badge variant="outline">{mealBoxes.length}</Badge>
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-20 bg-slate-200 rounded" />
                </Card>
              ))}
            </div>
          ) : mealBoxes.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-slate-500">尚無餐盒產品</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {mealBoxes.map(product => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-semibold text-slate-800">{product.name}</h3>
                        {product.is_flash && (
                          <Badge className="bg-red-500">快閃</Badge>
                        )}
                        {!product.is_active && (
                          <Badge variant="secondary">已停用</Badge>
                        )}
                      </div>
                      {product.description && (
                        <p className="text-sm text-slate-500 mb-2">{product.description}</p>
                      )}
                      <p className="text-lg font-bold text-emerald-600">NT${product.price}</p>
                    </div>
                    {currentUser?.role === 'admin' && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleToggleActive(product)}
                          title={product.is_active ? '隱藏產品' : '顯示產品'}
                        >
                          {product.is_active ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingProduct(product)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Side Dishes */}
        <section>
          <h2 className="text-xl font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5" />
            單點系列
            <Badge variant="outline">{sideDishes.length}</Badge>
          </h2>
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-16 bg-slate-200 rounded" />
                </Card>
              ))}
            </div>
          ) : sideDishes.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-slate-500">尚無單點產品</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {sideDishes.map(product => (
                <Card key={product.id} className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">{product.name}</h3>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggleActive(product)}
                        title={product.is_active ? '隱藏產品' : '顯示產品'}
                      >
                        {product.is_active ? (
                          <Eye className="w-3 h-3" />
                        ) : (
                          <EyeOff className="w-3 h-3" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleEdit(product)}
                      >
                        <Edit className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-red-500"
                        onClick={() => setDeletingProduct(product)}
                      >
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-bold text-emerald-600">NT${product.price}</p>
                    {currentUser?.role === 'admin' && (
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleToggleActive(product)}
                          title={product.is_active ? '隱藏產品' : '顯示產品'}
                        >
                          {product.is_active ? (
                            <Eye className="w-3 h-3" />
                          ) : (
                            <EyeOff className="w-3 h-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(product)}
                        >
                          <Edit className="w-3 h-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500"
                          onClick={() => setDeletingProduct(product)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                  {!product.is_active && (
                    <Badge variant="secondary" className="mt-2">已停用</Badge>
                  )}
                  </Card>
              ))}
            </div>
          )}
        </section>
      </div>

      <ProductFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        product={editingProduct}
        onSave={handleSave}
      />

      <AlertDialog open={!!deletingProduct} onOpenChange={() => setDeletingProduct(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingProduct?.name}」嗎？此操作無法復原。
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