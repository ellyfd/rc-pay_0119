import React from 'react';
import { Card } from "@/components/ui/card";
import { Package } from "lucide-react";

export default function EmptyState({ icon: Icon = Package, title, description, children }) {
  return (
    <Card className="p-8 md:p-12 text-center border-dashed">
      <Icon className="w-12 h-12 md:w-16 md:h-16 text-slate-300 mx-auto mb-3 md:mb-4" />
      {title && <p className="text-slate-500 text-base md:text-lg mb-1">{title}</p>}
      {description && <p className="text-slate-400 text-sm mt-1">{description}</p>}
      {children}
    </Card>
  );
}
