import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, Edit, Trash2, Copy } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TemplateFormDialog from "@/components/groupbuy/TemplateFormDialog";
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

export default function GroupBuyTemplates() {
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [deletingTemplate, setDeletingTemplate] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        toast.error('載入使用者資料失敗');
      }
    };
    loadUser();
  }, []);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['groupBuyTemplates'],
    queryFn: () => base44.entities.GroupBuyTemplate.list('-created_date')
  });

  const createTemplate = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyTemplate.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyTemplates'] });
      setShowForm(false);
      setEditingTemplate(null);
    }
  });

  const updateTemplate = useMutation({
    mutationFn: ({ id, data }) => base44.entities.GroupBuyTemplate.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyTemplates'] });
      setShowForm(false);
      setEditingTemplate(null);
    }
  });

  const deleteTemplate = useMutation({
    mutationFn: (id) => base44.entities.GroupBuyTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyTemplates'] });
      setDeletingTemplate(null);
    }
  });

  const handleSaveTemplate = async (templateData) => {
    if (editingTemplate) {
      await updateTemplate.mutateAsync({ id: editingTemplate.id, data: templateData });
    } else {
      await createTemplate.mutateAsync(templateData);
    }
  };

  const handleDuplicate = async (template) => {
    const duplicateData = {
      template_name: `${template.template_name} (副本)`,
      title: template.title,
      description: template.description,
      product_link: template.product_link,
      image_url: template.image_url,
      discount_rules: template.discount_rules,
      products: template.products
    };
    await createTemplate.mutateAsync(duplicateData);
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="bg-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('GroupBuy')}>
            <Button variant="ghost" className="text-white hover:bg-purple-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回團購列表
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">團購範本管理</h1>
              <p className="text-purple-200 text-sm mt-1">建立和管理常用的團購設定範本</p>
            </div>
            <Button
              onClick={() => {
                setEditingTemplate(null);
                setShowForm(true);
              }}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              <Plus className="w-4 h-4 mr-2" />
              新增範本
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-6 animate-pulse">
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-4" />
                <div className="h-4 bg-slate-200 rounded w-full mb-2" />
                <div className="h-4 bg-slate-200 rounded w-2/3" />
              </Card>
            ))}
          </div>
        ) : templates.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <p className="text-slate-500 text-lg mb-2">尚未建立任何範本</p>
            <p className="text-slate-400 text-sm">建立範本來快速設定團購</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map(template => (
              <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
                {template.image_url && (
                  <img
                    src={template.image_url}
                    alt={template.template_name}
                    className="w-full h-32 object-cover rounded-lg mb-4"
                  />
                )}
                <h3 className="font-semibold text-lg text-slate-800 mb-2">{template.template_name}</h3>
                {template.title && (
                  <p className="text-sm text-slate-600 mb-2">標題：{template.title}</p>
                )}
                {template.products && template.products.length > 0 && (
                  <p className="text-xs text-slate-500 mb-3">
                    包含 {template.products.length} 個商品
                  </p>
                )}
                {template.discount_rules && template.discount_rules.length > 0 && (
                  <p className="text-xs text-amber-600 mb-3">
                    設有 {template.discount_rules.length} 個折扣規則
                  </p>
                )}
                <div className="flex gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditingTemplate(template);
                      setShowForm(true);
                    }}
                    className="flex-1"
                  >
                    <Edit className="w-3 h-3 mr-1" />
                    編輯
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDuplicate(template)}
                    className="flex-1"
                  >
                    <Copy className="w-3 h-3 mr-1" />
                    複製
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDeletingTemplate(template)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <TemplateFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        template={editingTemplate}
        onSave={handleSaveTemplate}
      />

      <AlertDialog open={!!deletingTemplate} onOpenChange={() => setDeletingTemplate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除範本</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingTemplate?.template_name}」嗎？此操作無法復原。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTemplate.mutate(deletingTemplate.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              刪除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}