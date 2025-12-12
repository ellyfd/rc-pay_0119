import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, History } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import TransactionItem from "@/components/TransactionItem";

export default function TransactionHistory() {
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const { data: allTransactions = [], isLoading } = useQuery({
    queryKey: ['transactions'],
    queryFn: () => base44.entities.Transaction.list('-created_date', 1000)
  });

  const totalPages = Math.ceil(allTransactions.length / pageSize);
  const transactions = allTransactions.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      {/* Header */}
      <div className="bg-slate-900 text-white">
        <div className="max-w-4xl mx-auto px-4 py-6">
          <Link to={createPageUrl('Home')}>
            <Button variant="ghost" className="text-white hover:bg-slate-800 mb-4 -ml-2">
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首頁
            </Button>
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-400 rounded-xl flex items-center justify-center">
              <History className="w-6 h-6 text-slate-900" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">交易紀錄</h1>
              <p className="text-slate-400 text-sm">共 {allTransactions.length} 筆交易</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
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
            <div className="space-y-3">
              {transactions.map((transaction) => (
                <TransactionItem key={transaction.id} transaction={transaction} />
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setPage(page - 1)}
                  disabled={page === 1}
                >
                  上一頁
                </Button>
                <span className="text-sm text-slate-600">
                  第 {page} / {totalPages} 頁
                </span>
                <Button
                  variant="outline"
                  onClick={() => setPage(page + 1)}
                  disabled={page === totalPages}
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