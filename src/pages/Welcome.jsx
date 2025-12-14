import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Wallet, ShoppingCart, User } from "lucide-react";
import { createPageUrl } from "@/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function Welcome() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showGuestDialog, setShowGuestDialog] = useState(false);
  const [guestName, setGuestName] = useState('');

  useEffect(() => {
    const checkAuth = async () => {
      const auth = await base44.auth.isAuthenticated();
      if (auth) {
        // If already logged in, check if they have a member
        try {
          const user = await base44.auth.me();
          const members = await base44.entities.Member.list();
          const linkedMember = members.find(m => 
            m.user_emails && m.user_emails.includes(user.email)
          );
          if (linkedMember) {
            // Has linked member - check if internal
            if (linkedMember.is_internal) {
              window.location.href = createPageUrl('Home');
            } else {
              window.location.href = createPageUrl('GroupBuy');
            }
            return;
          }
        } catch (error) {
          console.error('Error checking user:', error);
        }
      }
      setIsAuthenticated(auth);
    };
    checkAuth();
  }, []);

  const handleRCPay = async () => {
    const auth = await base44.auth.isAuthenticated();
    if (!auth) {
      base44.auth.redirectToLogin(createPageUrl('Welcome'));
    } else {
      window.location.href = createPageUrl('Home');
    }
  };

  const handleGroupBuy = () => {
    setShowGuestDialog(true);
  };

  const handleGuestSubmit = async (e) => {
    e.preventDefault();
    if (!guestName.trim()) return;

    // Store guest name in localStorage
    localStorage.setItem('guest_name', guestName.trim());
    window.location.href = createPageUrl('GroupBuy');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-slate-800 mb-2">歡迎使用</h1>
          <p className="text-slate-600">請選擇您要使用的服務</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RC Pay Card */}
          <Card 
            className="p-8 hover:shadow-xl transition-all cursor-pointer border-2 hover:border-amber-400"
            onClick={handleRCPay}
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-amber-400 rounded-2xl flex items-center justify-center mx-auto">
                <Wallet className="w-10 h-10 text-slate-900" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">RC Pay</h2>
              <p className="text-slate-600 text-sm">
                團隊小金庫管理系統
              </p>
              <Button className="w-full bg-slate-800 hover:bg-slate-700">
                <User className="w-4 h-4 mr-2" />
                登入/註冊
              </Button>
            </div>
          </Card>

          {/* Group Buy Card */}
          <Card 
            className="p-8 hover:shadow-xl transition-all cursor-pointer border-2 hover:border-purple-400"
            onClick={handleGroupBuy}
          >
            <div className="text-center space-y-4">
              <div className="w-20 h-20 bg-purple-600 rounded-2xl flex items-center justify-center mx-auto">
                <ShoppingCart className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-2xl font-bold text-slate-800">團購網</h2>
              <p className="text-slate-600 text-sm">
                輕鬆開團、跟團購物
              </p>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                訪客進入
              </Button>
            </div>
          </Card>
        </div>
      </Card>

      {/* Guest Name Dialog */}
      <Dialog open={showGuestDialog} onOpenChange={setShowGuestDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>請輸入您的姓名</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleGuestSubmit} className="space-y-4 mt-4">
            <div>
              <Label htmlFor="guestName">英文姓名</Label>
              <Input
                id="guestName"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="請輸入英文姓名"
                className="mt-2"
              />
            </div>
            <Button 
              type="submit" 
              className="w-full bg-purple-600 hover:bg-purple-700"
              disabled={!guestName.trim()}
            >
              進入團購網
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}