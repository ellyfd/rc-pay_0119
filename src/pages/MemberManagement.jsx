import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import AdminGuard from '@/components/AdminGuard';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, UserPlus, Edit, Eye, EyeOff, Users } from "lucide-react";
// P3-10: 移除未使用的 Trash2 import
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { getAvatarColorStyle } from "@/components/utils/colorMap";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import AddMemberDialog from "@/components/AddMemberDialog";
import EditMemberDialog from "@/components/EditMemberDialog";
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

export default function MemberManagement() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [deletingMember, setDeletingMember] = useState(null);
  const { user: currentUser, isLoading: userLoading } = useCurrentUser();
  const queryClient = useQueryClient();

  // P1-8: queryFn 只取数据，排序交给 useMemo
  const { data: rawMembers = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('-created_date'),
    staleTime: 30 * 1000,
  });

  const members = useMemo(() =>
    [...rawMembers].sort((a, b) => {
      const totalA = (a.balance || 0) + (a.cash_balance || 0);
      const totalB = (b.balance || 0) + (b.cash_balance || 0);
      return totalB - totalA;
    }),
    [rawMembers]
  );

  const createMember = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const deleteMember = useMutation({
    mutationFn: (id) => base44.entities.Member.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleAddMember = async (memberData) => {
    await createMember.mutateAsync(memberData);
    setShowAddMember(false);
  };

  const handleEditMember = async (memberData) => {
    await updateMember.mutateAsync({
      id: editingMember.id,
      data: memberData
    });
    setEditingMember(null);
  };

  const handleToggleActive = async (member) => {
    await updateMember.mutateAsync({
      id: member.id,
      data: { is_active: !member.is_active }
    });
  };

  const handleDelete = async () => {
    if (deletingMember) {
      await deleteMember.mutateAsync(deletingMember.id);
      setDeletingMember(null);
    }
  };

  if (userLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <LoadingSpinner message="載入中..." />
      </div>
    );
  }

  // P2-8: 使用 AdminGuard 元件檢查權限
  const guard = <AdminGuard currentUser={currentUser} isLoading={userLoading} icon={Users} />;
  if (guard) return guard;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-slate-900 text-white">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Users className="w-6 h-6" />
                成員管理
              </h1>
              <p className="text-slate-400 text-sm mt-1">新增、編輯或刪除成員</p>
            </div>
            <Button
              onClick={() => setShowAddMember(true)}
              className="bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              <UserPlus className="w-5 h-5 mr-2" />
              新增成員
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <LoadingSpinner message="載入成員中..." />
        ) : members.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">尚未新增成員</p>
          </Card>
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">成員</th>
                    <th className="text-left px-4 py-3 text-sm font-semibold text-slate-700">關聯帳號</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">錢包餘額</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">現金餘額</th>
                    <th className="text-right px-4 py-3 text-sm font-semibold text-slate-700">總餘額</th>
                    <th className="text-center px-4 py-3 text-sm font-semibold text-slate-700">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {members.map(member => {
                    const bgColor = getAvatarColorStyle(member.avatar_color);
                    const totalBalance = (member.balance || 0) + (member.cash_balance || 0);
                    
                    return (
                      <tr key={member.id} className={`hover:bg-slate-50 ${!member.is_active ? 'opacity-60' : ''}`}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                              {member.name?.charAt(0)}
                            </div>
                            <span className="font-medium text-slate-800">{member.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-sm">
                          {member.user_emails && member.user_emails.length > 0 ? (
                            <div className="space-y-0.5">
                              {member.user_emails.map((email, idx) => (
                                <Link
                                  key={idx}
                                  to={createPageUrl('UserDetail') + '?email=' + encodeURIComponent(email)}
                                  className="block text-purple-600 hover:text-purple-700 hover:underline"
                                >
                                  {email}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">未綁定</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${member.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ${member.balance?.toLocaleString() || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${member.cash_balance >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            ${member.cash_balance?.toLocaleString() || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-bold ${totalBalance >= 0 ? 'text-slate-800' : 'text-red-600'}`}>
                            ${totalBalance.toLocaleString()}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1 justify-center">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEditingMember(member)}
                              className="h-8 w-8"
                              title="編輯成員"
                            >
                              <Edit className="w-4 h-4 text-slate-600" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleToggleActive(member)}
                              className="h-8 w-8"
                              title={member.is_active ? '從首頁隱藏' : '在首頁顯示'}
                            >
                              {member.is_active ? (
                                <Eye className="w-4 h-4 text-slate-600" />
                              ) : (
                                <EyeOff className="w-4 h-4 text-slate-400" />
                              )}
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        onAdd={handleAddMember}
      />

      <EditMemberDialog
        open={!!editingMember}
        onOpenChange={() => setEditingMember(null)}
        member={editingMember}
        onSave={handleEditMember}
        onDelete={(member) => {
          setEditingMember(null);
          setDeletingMember(member);
        }}
      />

      <AlertDialog open={!!deletingMember} onOpenChange={() => setDeletingMember(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>確認刪除成員</AlertDialogTitle>
            <AlertDialogDescription>
              確定要刪除「{deletingMember?.name}」嗎？此操作無法復原，該成員的所有交易紀錄將保留。
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