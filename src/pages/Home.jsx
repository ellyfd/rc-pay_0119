import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, ShoppingCart, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import SelectMemberDialog from "@/components/SelectMemberDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Home() {
  const [currentUser, setCurrentUser] = useState(null);
  const [showSelectMember, setShowSelectMember] = useState(false);
  const [showGroupBuyRegister, setShowGroupBuyRegister] = useState(false);
  const [englishName, setEnglishName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.error('Failed to load user:', error);
      }
    };
    loadUser();
  }, []);

  const { data: allMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('-created_date')
  });

  const updateMember = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Member.update(id, data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  const createMember = useMutation({
    mutationFn: (data) => base44.entities.Member.create(data),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['members'] })
  });

  // Check if user is linked and internal, auto redirect
  useEffect(() => {
    if (currentUser && allMembers.length > 0 && !membersLoading) {
      const linkedMember = allMembers.find(member => 
        member.user_emails && member.user_emails.includes(currentUser.email)
      );
      
      if (linkedMember && linkedMember.is_internal) {
        navigate(createPageUrl('RCPayHome'));
      }
    }
  }, [currentUser, allMembers, membersLoading, navigate]);

  const handleRCPayClick = () => {
    setShowSelectMember(true);
  };

  const handleGroupBuyClick = () => {
    setShowGroupBuyRegister(true);
  };

  const handleSelectMember = async (memberId) => {
    const member = allMembers.find(m => m.id === memberId);
    if (!member || !currentUser) return;

    const updatedEmails = [...(member.user_emails || []), currentUser.email];
    await updateMember.mutateAsync({
      id: memberId,
      data: { user_emails: updatedEmails }
    });
    setShowSelectMember(false);
    navigate(createPageUrl('RCPayHome'));
  };

  const handleGroupBuyRegister = async () => {
    if (!englishName.trim()) {
      alert('請輸入英文姓名');
      return;
    }

    setIsCreating(true);
    try {
      const colors = ['blue', 'green', 'purple', 'orange', 'pink', 'cyan'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newMember = await createMember.mutateAsync({
        name: englishName.trim(),
        avatar_color: randomColor,
        is_internal: false,
        user_emails: [currentUser.email]
      });

      setShowGroupBuyRegister(false);
      setEnglishName('');
      navigate(createPageUrl('GroupBuy'));
    } catch (error) {
      alert('註冊失敗：' + error.message);
    } finally {
      setIsCreating(false);
    }
  };

  if (membersLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-slate-300 border-t-slate-800 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-4xl w-full">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-16 h-16 bg-amber-400 rounded-2xl flex items-center justify-center">
              <Wallet className="w-10 h-10 text-slate-900" />
            </div>
            <h1 className="text-5xl font-bold text-white tracking-tight">RC Pay</h1>
          </div>
          <p className="text-slate-400 text-lg">選擇您要使用的服務</p>
        </div>

        {/* Options */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RC Pay Option */}
          <Card 
            className="p-8 hover:shadow-2xl transition-all cursor-pointer group border-2 hover:border-amber-400"
            onClick={handleRCPayClick}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-amber-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <Wallet className="w-12 h-12 text-amber-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">RC Pay</h2>
                <p className="text-slate-600">團隊小金庫管理系統</p>
                <p className="text-sm text-slate-500 mt-2">管理餘額、交易記錄、訂餐</p>
              </div>
              <Button className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold group-hover:gap-3 transition-all">
                進入 RC Pay
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </Card>

          {/* Group Buy Option */}
          <Card 
            className="p-8 hover:shadow-2xl transition-all cursor-pointer group border-2 hover:border-purple-400"
            onClick={handleGroupBuyClick}
          >
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="w-20 h-20 bg-purple-100 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                <ShoppingCart className="w-12 h-12 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-800 mb-2">團購專區</h2>
                <p className="text-slate-600">開團、跟團、輕鬆購</p>
                <p className="text-sm text-slate-500 mt-2">團購下單、支付管理</p>
              </div>
              <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold group-hover:gap-3 transition-all">
                進入團購專區
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {/* Select Member Dialog for RC Pay */}
      <SelectMemberDialog
        open={showSelectMember}
        members={allMembers}
        currentUserEmail={currentUser?.email}
        onSelect={handleSelectMember}
      />

      {/* Register Dialog for Group Buy */}
      <Dialog open={showGroupBuyRegister} onOpenChange={setShowGroupBuyRegister}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>團購專區註冊</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label>英文姓名 *</Label>
              <Input
                value={englishName}
                onChange={(e) => setEnglishName(e.target.value)}
                placeholder="請輸入英文姓名"
                disabled={isCreating}
              />
            </div>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowGroupBuyRegister(false);
                setEnglishName('');
              }}
              disabled={isCreating}
            >
              取消
            </Button>
            <Button 
              onClick={handleGroupBuyRegister}
              disabled={!englishName.trim() || isCreating}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {isCreating ? '註冊中...' : '完成註冊'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}