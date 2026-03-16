import React, { useState, useMemo } from 'react';
import React, { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useCurrentUser } from '@/components/hooks/useCurrentUser';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, History } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TransactionItem from "@/components/TransactionItem";

export default function TransactionHistory() {
  const [page, setPage] = useState(1);
  const pageSize = 20; // Keep consistent with other pages

  // P1-5: 延迟加载 + staleTime，避免一次拉 6 张表全量数据
  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions', 'all'],
    queryFn: async () => {
      const all = await base44.entities.Transaction.list('-created_date');
      return all.filter(t => t.status !== 'pending');
    },
    staleTime: 30 * 1000,
  });

  const totalPages = useMemo(() => 
    Math.ceil(allTransactions.length / pageSize),
    [allTransactions.length, pageSize]
  );
  
  const transactions = useMemo(() => 
    allTransactions.slice((page - 1) * pageSize, page * pageSize),
    [allTransactions, page, pageSize]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-3 md:mb-4 -ml-2 h-8 md:h-10">
              <ArrowLeft className="w-4 h-4 mr-1 md:mr-2" />
              <span className="text-sm md:text-base">返回首頁</span>
            </Button>
          </Link>
          <div className="flex items-center gap-2 md:gap-3">
            <div className="w-8 h-8 md:w-10 md:h-10 bg-amber-400 rounded-lg md:rounded-xl flex items-center justify-center">
              <History className="w-5 h-5 md:w-6 md:h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">交易紀錄</h1>
              <p className="text-slate-400 text-xs md:text-sm">共 {allTransactions.length} 筆交易</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-3 md:px-4 py-4 md:py-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                  <div className="flex-1">
                    <div className="h-4 bg-slate-200 rounded w-32 mb-2" />
                    <div className="h-3 bg-slate-200 rounded w-20" />
                  </div>
                  <div className="h-6 bg-slate-200 rounded w-16" />
                </div>
              </Card>
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <Card className="p-12 text-center border-dashed">
            <History className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">尚無交易紀錄</p>
          </Card>
        ) : (
          <>
            <div className="space-y-2 md:space-y-3">
              {transactions.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4 md:mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                  size="sm"
                  className="h-8 md:h-10 px-3 md:px-4 text-xs md:text-sm"
                >
                  上一頁
                </Button>
                <span className="text-xs md:text-sm text-slate-600">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
                  size="sm"
                  className="h-8 md:h-10 px-3 md:px-4 text-xs md:text-sm"
                >
                  下一頁
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}