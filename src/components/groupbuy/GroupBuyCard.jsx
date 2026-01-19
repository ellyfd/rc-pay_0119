import React, { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, Users, Calendar, ExternalLink, Plus, Eye } from "lucide-react";
import DiscountProgressBar from "./DiscountProgressBar";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GroupBuyCard({ groupBuy, currentUser, members, items = [] }) {
  const isOrganizer = currentUser && groupBuy.created_by === currentUser.email;
  const isOpen = groupBuy.status === 'open';

  // Calculate total quantity for this group buy
  const totalQuantity = items
    .filter(item => item.group_buy_id === groupBuy.id)
    .reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + item.quantity;
    }, 0);

  // Calculate total amount for this group buy
  const totalAmount = items
    .filter(item => item.group_buy_id === groupBuy.id)
    .reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + (item.price * item.quantity);
    }, 0);

  // Status logic
  const isClosed = groupBuy.status === 'closed';
  const isFullyPaid = groupBuy.is_fully_paid === true;
  
  const statusColor = isOpen ? 'bg-green-500' : 
                      isClosed && !isFullyPaid ? 'bg-amber-500' : 
                      'bg-blue-500';
  
  const statusLabel = isOpen ? '進行中' :
                      isClosed && !isFullyPaid ? '待收款' :
                      '已完成';

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
            <Badge className={statusColor}>
              {statusLabel}
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

        {/* Discount Progress */}
        {groupBuy.discount_rules && groupBuy.discount_rules.length > 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
            <DiscountProgressBar 
              discountRules={groupBuy.discount_rules}
              currentQuantity={totalQuantity}
              currentAmount={totalAmount}
            />
          </div>
        )}

        {/* Actions */}
        <div className="pt-2">
          {isOpen ? (
            <Link to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.id}>
              <Button className="w-full bg-purple-600 hover:bg-purple-700">
                <Plus className="w-4 h-4 mr-2" />
                我要跟團
              </Button>
            </Link>
          ) : isClosed && !isFullyPaid ? (
            <Link to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.id}>
              <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white">
                <Eye className="w-4 h-4 mr-2" />
                查看收款進度
              </Button>
            </Link>
          ) : (
            <Link to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.id}>
              <Button variant="outline" className="w-full">
                <Eye className="w-4 h-4 mr-2" />
                查看詳情
              </Button>
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}