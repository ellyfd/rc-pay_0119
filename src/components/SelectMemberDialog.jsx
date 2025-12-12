import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

export default function SelectMemberDialog({ open, members, currentUserEmail, onSelect }) {
  const [selectedMemberId, setSelectedMemberId] = useState(null);

  const handleSubmit = () => {
    if (!selectedMemberId) {
      alert('請選擇一個成員');
      return;
    }
    onSelect(selectedMemberId);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>選擇您的成員帳號</DialogTitle>
          <DialogDescription>
            請選擇要關聯到您系統帳號 ({currentUserEmail}) 的成員
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 max-h-96 overflow-y-auto py-2">
          {members.map(member => {
            const bgColor = colorMap[member.avatar_color] || "bg-slate-500";
            const isSelected = selectedMemberId === member.id;
            
            return (
              <Card
                key={member.id}
                onClick={() => setSelectedMemberId(member.id)}
                className={`p-4 cursor-pointer transition-all hover:shadow-md ${
                  isSelected ? 'ring-2 ring-purple-600 bg-purple-50' : ''
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center text-white font-bold flex-shrink-0`}>
                    {member.name?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{member.name}</p>
                    <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                      <span>餘額 ${((member.balance || 0) + (member.cash_balance || 0)).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button 
            onClick={handleSubmit} 
            disabled={!selectedMemberId}
            className="bg-purple-600 hover:bg-purple-700"
          >
            確認選擇
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}