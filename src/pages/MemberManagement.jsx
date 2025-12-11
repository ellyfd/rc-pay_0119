import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, UserPlus, Edit, Trash2, Eye, EyeOff, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import AddMemberDialog from "@/components/AddMemberDialog";
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

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

export default function MemberManagement() {
  const [showAddMember, setShowAddMember] = useState(false);
  const [deletingMember, setDeletingMember] = useState(null);
  const [user, setUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me().then(setUser).catch(() => setUser(null));
  }, []);

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto mb-3" />
          <p className="text-slate-500">載入中...</p>
        </Card>
      </div>
    );
  }

  if (user.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center">
          <p className="text-slate-500 mb-4">此頁面僅限管理員訪問</p>
          <Link to={createPageUrl('Home')}>
            <Button>返回首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: async () => {
      const memberList = await base44.entities.Member.list('-created_date');
      return memberList.sort((a, b) => {
        const totalA = (a.balance || 0) + (a.cash_balance || 0);
        const totalB = (b.balance || 0) + (b.cash_balance || 0);
        return totalB - totalA;
      });
    }
  });

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
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

      <div className="max-w-5xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-32" />
                  </div>
                </div>
              </Card>
            ))}
          </div>
        ) : members.length === 0 ? (
          <Card className="p-8 text-center border-dashed">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">尚未新增成員</p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {members.map(member => {
              const bgColor = colorMap[member.avatar_color] || "bg-slate-500";
              const totalBalance = (member.balance || 0) + (member.cash_balance || 0);
              
              return (
                <Card key={member.id} className={`p-4 ${!member.is_active ? 'opacity-60 border-dashed' : ''}`}>
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}>
                      {member.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-slate-800 truncate">{member.name}</h3>
                        {!member.is_active && (
                          <Badge variant="secondary" className="text-xs">已隱藏</Badge>
                        )}
                      </div>
                      <div className="flex gap-3 text-sm mb-2">
                        <div>
                          <span className="text-slate-500">錢包 </span>
                          <span className={`font-bold ${member.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                            ${member.balance?.toLocaleString() || 0}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-500">現金 </span>
                          <span className={`font-bold ${member.cash_balance >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                            ${member.cash_balance?.toLocaleString() || 0}
                          </span>
                        </div>
                      </div>
                      <div className="text-xs text-slate-500">
                        總餘額 <span className={`font-semibold ${totalBalance >= 0 ? 'text-slate-700' : 'text-red-600'}`}>
                          ${totalBalance.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
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
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingMember(member)}
                        className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <AddMemberDialog
        open={showAddMember}
        onOpenChange={setShowAddMember}
        onAdd={handleAddMember}
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