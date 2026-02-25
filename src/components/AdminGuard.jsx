import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import LoadingSpinner from "@/components/ui/LoadingSpinner";
import { Package } from "lucide-react";

// P2-8: 統一的管理員權限檢查元件
export default function AdminGuard({ currentUser, isLoading, icon: Icon = Package }) {
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <LoadingSpinner message="載入中..." />
      </div>
    );
  }

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex items-center justify-center">
        <Card className="p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Icon className="w-8 h-8 text-red-600" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">無權限訪問</h2>
          <p className="text-slate-500 mb-4">此頁面僅限管理員使用</p>
          <Link to={createPageUrl('Home')}>
            <Button className="w-full">返回首頁</Button>
          </Link>
        </Card>
      </div>
    );
  }

  return null;
}