import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function BatchImportDialog({ open, onOpenChange, groupBuyId, members, onImport }) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');

    try {
      // Upload file first
      const uploadResult = await base44.integrations.Core.UploadFile({ file });
      
      // Extract data using the schema
      const extractResult = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url: uploadResult.file_url,
        json_schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  member_name: { type: "string", description: "成員姓名" },
                  product_name: { type: "string", description: "產品名稱" },
                  quantity: { type: "number", description: "數量" },
                  price: { type: "number", description: "單價" },
                  note: { type: "string", description: "備註" }
                },
                required: ["member_name", "product_name", "quantity", "price"]
              }
            }
          }
        }
      });

      if (extractResult.status === 'error') {
        setError(extractResult.details || '檔案解析失敗');
        setUploading(false);
        return;
      }

      const items = extractResult.output?.items || [];
      if (items.length === 0) {
        setError('檔案中沒有找到有效的產品資料');
        setUploading(false);
        return;
      }

      // Match member names to IDs
      const itemsWithMemberIds = items.map(item => {
        const member = members.find(m => 
          m.name.toLowerCase() === item.member_name.toLowerCase().trim()
        );
        
        if (!member) {
          throw new Error(`找不到成員：${item.member_name}`);
        }

        return {
          group_buy_id: groupBuyId,
          member_id: member.id,
          member_name: member.name,
          product_name: item.product_name,
          quantity: item.quantity,
          price: item.price,
          note: item.note || ''
        };
      });

      await onImport(itemsWithMemberIds);
      setUploading(false);
      onOpenChange(false);
    } catch (error) {
      setError(error.message || '匯入失敗');
      setUploading(false);
    }
  };

  const downloadTemplate = () => {
    const template = `member_name,product_name,quantity,price,note
小明,洋芋片,2,50,原味
小華,巧克力,1,100,黑巧克力
小美,餅乾,3,30,`;
    
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = '團購匯入範本.csv';
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>批量匯入產品</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              請上傳包含以下欄位的 CSV 或 Excel 檔案：
              <ul className="list-disc list-inside mt-2 text-sm">
                <li>member_name（成員姓名）</li>
                <li>product_name（產品名稱）</li>
                <li>quantity（數量）</li>
                <li>price（單價）</li>
                <li>note（備註，可選）</li>
              </ul>
            </AlertDescription>
          </Alert>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Button
              variant="outline"
              onClick={downloadTemplate}
              className="w-full"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2" />
              下載範本檔案
            </Button>

            <Button
              onClick={() => document.getElementById('batch-import-file').click()}
              disabled={uploading}
              className="w-full bg-purple-600 hover:bg-purple-700"
            >
              <Upload className="w-4 h-4 mr-2" />
              {uploading ? '匯入中...' : '選擇檔案匯入'}
            </Button>
            
            <input
              id="batch-import-file"
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            取消
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}