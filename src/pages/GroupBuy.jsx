import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Plus, ShoppingCart, Users, Package, FileText, Filter } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import GroupBuyCard from "@/components/groupbuy/GroupBuyCard";
import CreateGroupBuyDialog from "@/components/groupbuy/CreateGroupBuyDialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export default function GroupBuy() {
  const [showCreate, setShowCreate] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [filterType, setFilterType] = useState('all'); // all, my_organized, my_joined
  const [sortBy, setSortBy] = useState('latest'); // latest, deadline, participants
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
    queryFn: () => base44.entities.GroupBuy.list('-created_date'),
    select: (data) => data // Can add transformation here if needed
  });

  const { data: allGroupBuyItems = [] } = useQuery({
    queryKey: ['allGroupBuyItems'],
    queryFn: () => base44.entities.GroupBuyItem.list(),
    select: (items) => items // Fetch once and reuse
  });

  const createGroupBuy = useMutation({
    mutationFn: (data) => base44.entities.GroupBuy.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groupBuys'] });
      setShowCreate(false);
      toast.success('團購已成功建立！');
    },
    onError: (error) => {
      toast.error('建立團購失敗：' + error.message);
    }
  });

  const createGroupBuyProduct = useMutation({
    mutationFn: (data) => base44.entities.GroupBuyProduct.create(data),
    onError: (error) => {
      toast.error('建立商品失敗：' + error.message);
    }
  });

  const handleCreate = async (data) => {
    const { products, organizer_id, link_settings, ...groupBuyData } = data;
    
    // Find organizer member
    const organizerMember = members.find(m => m.id === organizer_id);
    if (!organizerMember) return;
    
    // Generate unique shareable link ID
    const shareable_link_id = `gb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Calculate link expiration if set
    let link_expiration = null;
    if (link_settings?.expiration_days) {
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + link_settings.expiration_days);
      link_expiration = expirationDate.toISOString();
    }
    
    // Create group buy with link settings
    const groupBuy = await createGroupBuy.mutateAsync({
      ...groupBuyData,
      organizer_id: organizer_id,
      organizer_name: organizerMember.name,
      shareable_link_id,
      link_expiration,
      link_access_type: link_settings?.access_type || 'public'
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

  // Find current user's member
  const currentMember = members.find(m => 
    m.user_emails && currentUser && m.user_emails.includes(currentUser.email)
  );

  // Filter function
  const filterGroupBuys = (gbs) => {
    let filtered = gbs;
    
    if (filterType === 'my_organized' && currentMember) {
      filtered = filtered.filter(gb => gb.organizer_id === currentMember.id);
    } else if (filterType === 'my_joined' && currentMember) {
      const myGroupBuyIds = allGroupBuyItems
        .filter(item => item.member_id === currentMember.id)
        .map(item => item.group_buy_id);
      filtered = filtered.filter(gb => myGroupBuyIds.includes(gb.id));
    }
    
    return filtered;
  };

  // Sort function
  const sortGroupBuys = (gbs) => {
    const sorted = [...gbs];
    
    if (sortBy === 'deadline') {
      sorted.sort((a, b) => {
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return new Date(a.deadline) - new Date(b.deadline);
      });
    } else if (sortBy === 'participants') {
      sorted.sort((a, b) => {
        const aParticipants = new Set(allGroupBuyItems.filter(i => i.group_buy_id === a.id).map(i => i.member_id)).size;
        const bParticipants = new Set(allGroupBuyItems.filter(i => i.group_buy_id === b.id).map(i => i.member_id)).size;
        return bParticipants - aParticipants;
      });
    }
    
    return sorted;
  };

  const openGroupBuys = sortGroupBuys(filterGroupBuys(groupBuys.filter(gb => gb.status === 'open')));
  const closedGroupBuys = sortGroupBuys(filterGroupBuys(groupBuys.filter(gb => gb.status === 'closed' || gb.status === 'completed')));

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
            <div className="flex flex-col-reverse md:flex-row gap-2">
              <Link to={createPageUrl('GroupBuyTemplates')} className="w-full md:w-auto">
                <Button variant="ghost" className="text-white hover:bg-purple-500 w-full">
                  <FileText className="w-5 h-5 mr-2" />
                  範本管理
                </Button>
              </Link>
              <Button
                onClick={() => setShowCreate(true)}
                className="bg-white text-purple-600 hover:bg-purple-50 w-full md:w-auto"
              >
                <Plus className="w-5 h-5 mr-2" />
                我要開團
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Filters and Sort */}
        <div className="mb-6 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] sm:w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部團購</SelectItem>
                <SelectItem value="my_organized">我發起的</SelectItem>
                <SelectItem value="my_joined">我參與的</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[140px] sm:w-[160px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="latest">最新建立</SelectItem>
              <SelectItem value="deadline">截止日期</SelectItem>
              <SelectItem value="participants">參與人數</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
                    items={allGroupBuyItems}
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
                    items={allGroupBuyItems}
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
        members={members}
        currentUser={currentUser}
      />
    </div>
  );
}