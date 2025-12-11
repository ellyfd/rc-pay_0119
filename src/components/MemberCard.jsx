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
  
  const CardContent = () => (
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-full ${bgColor} flex items-center justify-center text-white font-bold text-lg`}>
          {member.name?.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-slate-800 truncate">{member.name}</h3>
          <div className="flex gap-3 text-sm">
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
        </div>
      </div>
  );

  if (onClick) {
    return (
      <Card 
        className={`p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1 ${
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
      <Card className="p-4 cursor-pointer transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
        <CardContent />
      </Card>
    </Link>
  );
}