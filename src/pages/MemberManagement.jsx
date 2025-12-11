import React from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Users, Eye, EyeOff } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";

export default function MemberManagement() {
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const handleToggleHidden = async (member) => {
    await updateMember.mutateAsync({
      id: member.id,
      data: { is_hidden: !member.is_hidden }
    });
  };

  const colorMap = {
    blue: "bg-blue-500",
    green: "bg-emerald-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    pink: "bg-pink-500",
    cyan: "bg-cyan-500",
  };

  const visibleMembers = members.filter(m => !m.is_hidden);
  const hiddenMembers = members.filter(m => m.is_hidden);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="bg-slate-900 text-white">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">成員管理</h1>
              <p className="text-slate-400 text-sm">管理成員顯示設定</p>
            </div>
            <Badge variant="outline" className="bg-slate-800 text-white border-slate-700">
              共 {members.length} 位成員
            </Badge>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
        {/* Visible Members */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-slate-400" />
            <h2 className="text-lg font-semibold text-slate-800">顯示於首頁</h2>
            <Badge variant="outline">{visibleMembers.length}</Badge>
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[1, 2, 3].map(i => (
                <Card key={i} className="p-4 animate-pulse">
                  <div className="h-20 bg-slate-200 rounded" />
                </Card>
              ))}
            </div>
          ) : visibleMembers.length === 0 ? (
            <Card className="p-8 text-center border-dashed">
              <p className="text-slate-500">沒有顯示的成員</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {visibleMembers.map(member => {
                const bgColor = colorMap[member.avatar_color] || "bg-slate-500";
                return (
                  <Card key={member.id} className="p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-lg`}>
                          {member.name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{member.name}</h3>
                          <div className="flex gap-3 text-sm">
                            <span className="text-slate-500">
                              錢包 <span className={`font-bold ${member.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                ${member.balance?.toLocaleString() || 0}
                              </span>
                            </span>
                            <span className="text-slate-500">
                              現金 <span className={`font-bold ${member.cash_balance >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                ${member.cash_balance?.toLocaleString() || 0}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleHidden(member)}
                        className="text-slate-400 hover:text-slate-600"
                        title="隱藏成員"
                      >
                        <EyeOff className="w-5 h-5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        {/* Hidden Members */}
        {hiddenMembers.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <EyeOff className="w-5 h-5 text-slate-400" />
              <h2 className="text-lg font-semibold text-slate-800">已隱藏</h2>
              <Badge variant="secondary">{hiddenMembers.length}</Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {hiddenMembers.map(member => {
                const bgColor = colorMap[member.avatar_color] || "bg-slate-500";
                return (
                  <Card key={member.id} className="p-4 bg-slate-50 opacity-60 hover:opacity-100 hover:shadow-md transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-lg`}>
                          {member.name?.charAt(0)}
                        </div>
                        <div>
                          <h3 className="font-semibold text-slate-800">{member.name}</h3>
                          <div className="flex gap-3 text-sm">
                            <span className="text-slate-500">
                              錢包 <span className={`font-bold ${member.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                ${member.balance?.toLocaleString() || 0}
                              </span>
                            </span>
                            <span className="text-slate-500">
                              現金 <span className={`font-bold ${member.cash_balance >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
                                ${member.cash_balance?.toLocaleString() || 0}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleToggleHidden(member)}
                        className="text-slate-400 hover:text-emerald-600"
                        title="顯示成員"
                      >
                        <Eye className="w-5 h-5" />
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}