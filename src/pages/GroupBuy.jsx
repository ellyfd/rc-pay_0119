import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, ShoppingCart, Users, Package } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import GroupBuyCard from "@/components/groupbuy/GroupBuyCard";
import CreateGroupBuyDialog from "@/components/groupbuy/CreateGroupBuyDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function GroupBuy() {
  const [showCreate, setShowCreate] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const queryClient = useQueryClient();

  React.useEffect(() => {
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

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name')
  });

  const { data: groupBuys = [], isLoading } = useQuery({
    queryKey: ['groupBuys'],
    queryFn: () => base44.entities.GroupBuy.list('-created_date')
  });

  const createGroupBuy = useMutation({
    mutationFn: (data) => base44.entities.GroupBuy.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuys'] });
      setShowCreate(false);
    }
  });

  const createGroupBuyProduct = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyProduct.create(data)
  });

  const handleCreate = async (data) => {
    if (!currentUser) return;
    
    const { products, ...groupBuyData } = data;
    
    // Find member by matching email or name
    const organizerMember = members.find(m => 
      m.name === currentUser.full_name || 
      m.name === (currentUser.full_name || currentUser.email)
    );
    
    // Create group buy
    const groupBuy = await createGroupBuy.mutateAsync({
      ...groupBuyData,
      organizer_id: currentUser.id,
      organizer_member_id: organizerMember?.id || null,
      organizer_name: currentUser.full_name || currentUser.email
    });
    
    // Create products if any
    if (products && products.length > 0) {
      for (const product of products) {
        await createGroupBuyProduct.mutateAsync({
          ...product,
          group_buy_id: groupBuy.id
        });
      }
    }
  };

  const openGroupBuys = groupBuys.filter(gb => gb.status === 'open');
  const closedGroupBuys = groupBuys.filter(gb => gb.status === 'closed' || gb.status === 'completed');

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto" />
          <p className="text-slate-500 mt-4">載入中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-pink-50">
      {/* Header */}
      <div className="bg-purple-600 text-white">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-purple-500 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center">
                <ShoppingCart className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">團購專區</h1>
                <p className="text-purple-100 text-sm">開團、跟團、輕鬆購</p>
              </div>
            </div>
            <Button
              onClick={() => setShowCreate(true)}
              className="bg-white text-purple-600 hover:bg-purple-50"
            >
              <Plus className="w-5 h-5 mr-2" />
              我要開團
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="open" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2 mb-6">
            <TabsTrigger value="open">
              進行中 {openGroupBuys.length > 0 && (
                <span className="ml-2 bg-purple-600 text-white text-xs px-2 py-0.5 rounded-full">
                  {openGroupBuys.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="closed">已結束</TabsTrigger>
          </TabsList>

          <TabsContent value="open">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="p-4 animate-pulse">
                    <div className="h-48 bg-slate-200 rounded mb-4" />
                    <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-1/2" />
                  </Card>
                ))}
              </div>
            ) : openGroupBuys.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 text-lg mb-2">目前沒有進行中的團購</p>
                <p className="text-slate-400 text-sm">點擊「我要開團」開始第一個團購！</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {openGroupBuys.map(groupBuy => (
                  <GroupBuyCard
                    key={groupBuy.id}
                    groupBuy={groupBuy}
                    currentUser={currentUser}
                    members={members}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed">
            {closedGroupBuys.length === 0 ? (
              <Card className="p-12 text-center border-dashed">
                <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">沒有已結束的團購</p>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {closedGroupBuys.map(groupBuy => (
                  <GroupBuyCard
                    key={groupBuy.id}
                    groupBuy={groupBuy}
                    currentUser={currentUser}
                    members={members}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <CreateGroupBuyDialog
        open={showCreate}
        onOpenChange={setShowCreate}
        onCreate={handleCreate}
      />
    </div>
  );
}