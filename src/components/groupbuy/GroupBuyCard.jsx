import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Calendar, ExternalLink, Plus } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GroupBuyCard({ groupBuy, currentUser, members }) {
  const isOrganizer = currentUser && groupBuy.created_by === currentUser.email;
  const isOpen = groupBuy.status === 'open';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      {/* Image */}
      {groupBuy.image_url && (
        <div className="aspect-video bg-slate-100 overflow-hidden">
          <img
            src={groupBuy.image_url}
            alt={groupBuy.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-4 space-y-3">
        {/* Title & Status */}
        <div>
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="font-semibold text-slate-800 line-clamp-2">{groupBuy.title}</h3>
            <Badge className={
              groupBuy.status === 'open' ? 'bg-green-500' :
              groupBuy.status === 'closed' ? 'bg-amber-500' :
              'bg-slate-500'
            }>
              {groupBuy.status === 'open' ? '進行中' :
               groupBuy.status === 'closed' ? '已截止' :
               '已結單'}
            </Badge>
          </div>
          {groupBuy.description && (
            <p className="text-sm text-slate-500 line-clamp-2">{groupBuy.description}</p>
          )}
        </div>

        {/* Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2 text-slate-600">
            <Users className="w-4 h-4" />
            <span>開團者：</span>
            <Link 
              to={createPageUrl('MemberDetail') + '?id=' + groupBuy.organizer_id}
              className="text-purple-600 hover:text-purple-700 hover:underline"
            >
              {groupBuy.organizer_name}
            </Link>
          </div>
          {groupBuy.deadline && (
            <div className="flex items-center gap-2 text-slate-600">
              <Calendar className="w-4 h-4" />
              <span>截止：{format(new Date(groupBuy.deadline), 'yyyy/MM/dd')}</span>
            </div>
          )}
          {groupBuy.product_link && (
            <a
              href={groupBuy.product_link}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
            >
              <ExternalLink className="w-4 h-4" />
              <span>查看商品連結</span>
            </a>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Link to={createPageUrl(`GroupBuyDetail?id=${groupBuy.id}`)} className="flex-1">
            <Button variant="outline" className="w-full">
              <Package className="w-4 h-4 mr-2" />
              查看詳情
            </Button>
          </Link>
          {isOpen && !isOrganizer && (
            <Link to={createPageUrl(`GroupBuyDetail?id=${groupBuy.id}`)} className="flex-1">
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                我要跟團
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}