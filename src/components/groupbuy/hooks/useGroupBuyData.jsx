import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';

export function useGroupBuyData(groupBuyId) {
  const { data: groupBuy, isLoading: groupBuyLoading } = useQuery({
    queryKey: ['groupBuy', groupBuyId],
    queryFn: async () => {
      const allGroupBuys = await base44.entities.GroupBuy.list();
      return allGroupBuys.find(gb => gb.id === groupBuyId);
    },
    enabled: !!groupBuyId,
    staleTime: 30000
  });

  const { data: items = [], isLoading: itemsLoading } = useQuery({
    queryKey: ['groupBuyItems', groupBuyId],
    queryFn: async () => {
      const allItems = await base44.entities.GroupBuyItem.list('-created_date');
      return allItems.filter(item => item.group_buy_id === groupBuyId);
    },
    enabled: !!groupBuyId,
    staleTime: 10000
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['groupBuyProducts', groupBuyId],
    queryFn: async () => {
      const allProducts = await base44.entities.GroupBuyProduct.list('-created_date');
      return allProducts.filter(p => p.group_buy_id === groupBuyId);
    },
    enabled: !!groupBuyId,
    staleTime: 30000
  });

  const { data: members = [], isLoading: membersLoading } = useQuery({
    queryKey: ['members'],
    queryFn: () => base44.entities.Member.list('name'),
    staleTime: 60000
  });

  return {
    groupBuy,
    items,
    products,
    members,
    isLoading: groupBuyLoading || itemsLoading || productsLoading || membersLoading
  };
}