import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Calendar, ExternalLink, Users, Package, ShoppingCart, Lock, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import AddItemDialog from "@/components/groupbuy/AddItemDialog";
import DiscountProgressBar from "@/components/groupbuy/DiscountProgressBar";

export default function PublicGroupBuy() {
  const [linkId, setLinkId] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [showAddItem, setShowAddItem] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setLinkId(params.get('link'));
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const user = await base44.auth.me();
        setCurrentUser(user);
      } catch (error) {
        console.log('User not logged in');
      }
    };
    loadUser();
  }, []);

  const { data: groupBuy, isLoading: groupBuyLoading, error } = useQuery({
    queryKey: ['publicGroupBuy', linkId],
    queryFn: async () => {
      const allGroupBuys = await base44.entities.GroupBuy.list();
      return allGroupBuys.find(gb => gb.shareable_link_id === linkId);
    },
    enabled: !!linkId,
    retry: 1
  });

  const { data: items = [] } = useQuery({
    queryKey: ['groupBuyItems', groupBuy?.id],
    queryFn: async () => {
      const allItems = await base44.entities.GroupBuyItem.list('-created_date');
      return allItems.filter(item => item.group_buy_id === groupBuy.id);
    },
    enabled: !!groupBuy?.id
  });

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['groupBuyProducts', groupBuy?.id],
    queryFn: async () => {
      const allProducts = await base44.entities.GroupBuyProduct.list('-created_date');
      return allProducts.filter(p => p.group_buy_id === groupBuy.id);
    },
    enabled: !!groupBuy?.id
  });

  const createItem = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyItem.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuyItems'] });
      toast.success('已成功加入團購！');
      setShowAddItem(false);
    },
    onError: (error) => {
      toast.error('加入團購失敗：' + error.message);
    }
  });

  const handleAddItem = async (itemData) => {
    await createItem.mutateAsync({
      ...itemData,
      group_buy_id: groupBuy.id
    });
  };

  // Check if link is valid
  const isLinkExpired = groupBuy?.link_expiration && new Date(groupBuy.link_expiration) < new Date();
  const isMembersOnly = groupBuy?.link_access_type === 'members_only';
  const isOpen = groupBuy?.status === 'open';

  // Check if current user is a member
  const userMember = members.find(m => 
    m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
  );

  const canJoin = isOpen && !isLinkExpired && (!isMembersOnly || userMember);

  const getTotalQuantity = () => {
    return items.reduce((sum, item) => {
      const isSplitItem = item.note && item.note.includes('平分');
      if (isSplitItem && !item.note.includes(`${item.member_name}訂購`)) {
        return sum;
      }
      return sum + item.quantity;
    }, 0);
  };

  if (groupBuyLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  if (!groupBuy || error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">找不到團購</h2>
          <p className="text-slate-600 mb-4">此分享連結可能無效或已被刪除</p>
          <Link to={createPageUrl('GroupBuy')}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              前往團購專區
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isLinkExpired) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-16 h-16 text-amber-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">連結已過期</h2>
          <p className="text-slate-600 mb-4">此團購的分享連結已失效</p>
          <Link to={createPageUrl('GroupBuy')}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              瀏覽其他團購
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  if (isMembersOnly && !currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Lock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">需要登入</h2>
          <p className="text-slate-600 mb-4">此團購僅限成員訪問，請先登入</p>
          <Button 
            onClick={() => base44.auth.redirectToLogin(window.location.href)}
            className="bg-purple-600 hover:bg-purple-700"
          >
            登入
          </Button>
        </Card>
      </div>
    );
  }

  if (isMembersOnly && !userMember) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <Lock className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-slate-800 mb-2">無訪問權限</h2>
          <p className="text-slate-600 mb-4">此團購僅限成員參與</p>
          <Link to={createPageUrl('Home')}>
            <Button className="bg-purple-600 hover:bg-purple-700">
              返回首頁
            </Button>
          </Link>
        </Card>
      </div>
    );
  }

  const participantCount = new Set(items.map(item => item.member_id)).size;
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Card className="overflow-hidden">
          {groupBuy.image_url && (
            <div className="relative bg-slate-100 h-64">
              <img
                src={groupBuy.image_url}
                alt={groupBuy.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          
          <div className="p-6 space-y-6">
            <div>
              <div className="flex items-start justify-between mb-3">
                <h1 className="text-3xl font-bold text-slate-800">{groupBuy.title}</h1>
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
                <p className="text-slate-600 whitespace-pre-wrap">{groupBuy.description}</p>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 text-slate-600">
                <Users className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-sm">開團者</p>
                  <p className="font-medium text-slate-800">{groupBuy.organizer_name}</p>
                </div>
              </div>
              
              {groupBuy.deadline && (
                <div className="flex items-center gap-3 text-slate-600">
                  <Calendar className="w-5 h-5 text-purple-500" />
                  <div>
                    <p className="text-sm">截止日期</p>
                    <p className="font-medium text-slate-800">
                      {format(new Date(groupBuy.deadline), 'yyyy/MM/dd')}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {groupBuy.product_link && (
              <a
                href={groupBuy.product_link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-purple-600 hover:text-purple-700"
              >
                <ExternalLink className="w-5 h-5" />
                <span className="font-medium">查看商品連結</span>
              </a>
            )}

            {groupBuy.discount_rules && groupBuy.discount_rules.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <p className="font-semibold text-amber-800 mb-2">📊 數量折扣規則</p>
                {groupBuy.discount_rules
                  .sort((a, b) => a.min_quantity - b.min_quantity)
                  .map((rule, idx) => (
                    <p key={idx} className="text-sm text-amber-700">
                      • 滿 {rule.min_quantity} 件：{rule.discount_percent}% off
                    </p>
                  ))}
                <div className="mt-3 pt-3 border-t border-amber-200">
                  <DiscountProgressBar 
                    discountRules={groupBuy.discount_rules}
                    currentQuantity={getTotalQuantity()}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4 py-4 border-t border-b">
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">參與人數</p>
                <p className="text-2xl font-bold text-purple-600">{participantCount}</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 mb-1">總金額</p>
                <p className="text-2xl font-bold text-slate-800">${totalAmount.toLocaleString()}</p>
              </div>
            </div>

            {products.length > 0 && (
              <div>
                <h3 className="font-semibold text-slate-800 mb-3">團購商品</h3>
                <div className="space-y-2">
                  {products.map((product) => (
                    <div key={product.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-slate-800">{product.product_name}</p>
                        {product.description && (
                          <p className="text-sm text-slate-600">{product.description}</p>
                        )}
                      </div>
                      <p className="font-bold text-purple-600">${product.price.toLocaleString()}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canJoin ? (
              <Button
                onClick={() => setShowAddItem(true)}
                className="w-full bg-purple-600 hover:bg-purple-700 h-12 text-lg"
              >
                <ShoppingCart className="w-5 h-5 mr-2" />
                我要跟團
              </Button>
            ) : !isOpen ? (
              <div className="text-center py-4">
                <p className="text-slate-600">此團購已結束</p>
              </div>
            ) : null}

            {currentUser && (
              <div className="text-center">
                <Link to={createPageUrl('GroupBuyDetail') + '?id=' + groupBuy.id}>
                  <Button variant="outline" className="w-full">
                    查看完整團購詳情
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </Card>
      </div>

      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        members={members}
        currentUser={currentUser}
        item={null}
        onAdd={handleAddItem}
        presetProducts={products}
      />
    </div>
  );
}