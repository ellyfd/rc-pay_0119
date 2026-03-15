import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import AdminGuard from '@/components/AdminGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Package, Edit, Trash2, Eye, EyeOff, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import ProductCatalogFormDialog from "@/components/catalog/ProductCatalogFormDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ProductCatalog() {
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  // P1-5: 延迟加载 + staleTime，避免一次拉 6 张表全量数据
  const { data: products = [], isLoading } = useQuery({
    queryKey: ['productCatalog'],
    queryFn: () => base44.entities.ProductCatalog.list('-created_date'),
    staleTime: 60 * 1000,
  });

  const createProduct = useMutation({
    mutationFn: (data) => base44.entities.ProductCatalog.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productCatalog'] })
  });

  const updateProduct = useMutation({
    mutationFn: ({ id, data }) => base44.entities.ProductCatalog.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productCatalog'] })
  });

  const deleteProduct = useMutation({
    mutationFn: (id) => base44.entities.ProductCatalog.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['productCatalog'] })
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

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <LoadingSpinner message="載入中..." />
      </div>
    );
  }

  // P2-8: 使用 AdminGuard 元件檢查權限
  const guard = <AdminGuard currentUser={currentUser} isLoading={userLoading} icon={Package} />;
  if (guard) return guard;

  // Get unique categories
  const categories = useMemo(() => 
    ['all', ...new Set(products.map(p => p.category).filter(Boolean))],
    [products]
  );

  // Filter products
  const filteredProducts = useMemo(() => 
    products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (p.description && p.description.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesCategory = selectedCategory === 'all' || p.category === selectedCategory;
      return matchesSearch && matchesCategory;
    }),
    [products, searchTerm, selectedCategory]
  );

  // Group by category
  const groupedProducts = useMemo(() => 
    filteredProducts.reduce((acc, product) => {
      const cat = product.category || '未分類';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(product);
      return acc;
    }, {}),
    [filteredProducts]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">產品目錄</h1>
              <p className="text-slate-400 text-sm">統一管理所有產品，可用於訂餐和團購</p>
            </div>
            <Button
              onClick={() => {
                setEditingProduct(null);
                setShowForm(true);
              }}
              className="bg-white text-slate-900 hover:bg-slate-100"
            >
              <Plus className="w-5 h-5 mr-2" />
              新增產品
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters */}
        <Card className="p-4 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                <Input
                  placeholder="搜尋產品名稱或描述..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="w-full md:w-48">
              <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">所有分類</SelectItem>
                  {categories.filter(c => c !== 'all').map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </Card>

        {/* Products */}
        {isLoading ? (
          <LoadingSpinner message="載入產品中..." />
        ) : filteredProducts.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500 text-lg mb-2">
              {searchTerm || selectedCategory !== 'all' ? '沒有符合條件的產品' : '尚未新增產品'}
            </p>
            {!searchTerm && selectedCategory === 'all' && (
              <p className="text-slate-400 text-sm">點擊「新增產品」開始建立產品目錄</p>
            )}
          </Card>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedProducts).map(([category, categoryProducts]) => (
              <section key={category}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold text-slate-800">{category}</h2>
                  <Badge variant="outline">{categoryProducts.length}</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryProducts.map(product => (
                    <Card key={product.id} className="overflow-hidden">
                      {product.image_url && (
                        <div className="aspect-video bg-slate-100 overflow-hidden">
                          <img
                            src={product.image_url}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-800 mb-1">{product.name}</h3>
                            {!product.is_active && (
                              <Badge variant="secondary" className="mb-2">已停用</Badge>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(product)}
                              className="h-8 w-8"
                              title={product.is_active ? '停用' : '啟用'}
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
                              className="h-8 w-8"
                            >
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDeletingProduct(product)}
                              className="h-10 w-10 text-red-500"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        {product.description && (
                          <p className="text-sm text-slate-500 mb-3 line-clamp-2">{product.description}</p>
                        )}
                        {product.base_price && (
                          <p className="text-lg font-bold text-slate-800">
                            參考價 ${product.base_price.toLocaleString()}
                          </p>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <ProductCatalogFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        product={editingProduct}
        existingCategories={categories.filter(c => c !== 'all')}
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