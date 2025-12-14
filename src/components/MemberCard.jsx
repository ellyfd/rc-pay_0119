import React from 'react';
import { Card } from "@/components/ui/card";
import { User } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
  orange: "bg-orange-500",
  pink: "bg-pink-500",
  cyan: "bg-cyan-500",
};

export default function MemberCard({ member, onClick, selected }) {
  const bgColor = colorMap[member.avatar_color] || "bg-slate-500";
  
  const totalBalance = (member.balance || 0) + (member.cash_balance || 0);
  
  const CardContent = () => (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className={`w-10 h-10 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-base flex-shrink-0`}>
            {member.name?.charAt(0)}
          </div>
          <h3 className="font-semibold text-sm text-slate-800 truncate flex-1">{member.name}</h3>
        </div>
        <div className="grid grid-cols-2 gap-2 text-center">
          <div className="bg-emerald-50 rounded p-1.5">
            <p className="text-xs text-slate-500">錢包</p>
            <p className={`text-sm font-bold ${member.balance >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              ${member.balance?.toLocaleString() || 0}
            </p>
          </div>
          <div className="bg-amber-50 rounded p-1.5">
            <p className="text-xs text-slate-500">現金</p>
            <p className={`text-sm font-bold ${member.cash_balance >= 0 ? 'text-amber-600' : 'text-red-500'}`}>
              ${member.cash_balance?.toLocaleString() || 0}
            </p>
          </div>
        </div>
        <div className="text-center bg-slate-50 rounded p-1.5">
          <p className="text-xs text-slate-500">總額</p>
          <p className={`text-base font-bold ${totalBalance >= 0 ? 'text-slate-800' : 'text-red-500'}`}>
            ${totalBalance.toLocaleString()}
          </p>
        </div>
      </div>
  );

  if (onClick) {
    return (
      <Card 
        className={`p-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
          selected ? 'ring-2 ring-amber-400 shadow-lg' : ''
        }`}
        onClick={() => onClick(member)}
      >
        <CardContent />
      </Card>
    );
  }

  return (
    <Link to={createPageUrl('MemberDetail') + `?id=${member.id}`}>
      <Card className="p-3 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardContent />
      </Card>
    </Link>
  );
}