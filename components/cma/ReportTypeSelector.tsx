"use client";

import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Home, TrendingUp, Activity } from 'lucide-react';

interface ReportTypeSelectorProps {
  currentType: 'sold' | 'active' | 'both';
  onTypeChange: (type: 'sold' | 'active' | 'both') => void;
  soldCount: number;
  activeCount: number;
}

const ReportTypeSelector: React.FC<ReportTypeSelectorProps> = ({
  currentType,
  onTypeChange,
  soldCount,
  activeCount
}) => {
  return (
    <div className="mb-6 border-b pb-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity className="h-5 w-5 text-[#660D39]" />
        <h3 className="text-sm font-semibold text-[#484247] font-montserrat">Report Focus</h3>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          variant={currentType === 'sold' ? 'default' : 'outline'}
          onClick={() => onTypeChange('sold')}
          className={`${currentType === 'sold' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10'} font-montserrat`}
        >
          <Home className="mr-2 h-4 w-4" />
          Sold Properties
          <Badge variant="secondary" className="ml-2">
            {soldCount}
          </Badge>
        </Button>

        <Button
          variant={currentType === 'active' ? 'default' : 'outline'}
          onClick={() => onTypeChange('active')}
          className={`${currentType === 'active' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10'} font-montserrat`}
        >
          <TrendingUp className="mr-2 h-4 w-4" />
          Active Listings
          <Badge variant="secondary" className="ml-2">
            {activeCount}
          </Badge>
        </Button>

        <Button
          variant={currentType === 'both' ? 'default' : 'outline'}
          onClick={() => onTypeChange('both')}
          className={`${currentType === 'both' ? 'bg-[#660D39] hover:bg-[#670038]' : 'border-[#660D39] text-[#484247] hover:bg-[#660D39]/10'} font-montserrat`}
        >
          <Activity className="mr-2 h-4 w-4" />
          Comprehensive
          <Badge variant="secondary" className="ml-2">
            {soldCount + activeCount}
          </Badge>
        </Button>
      </div>
    </div>
  );
};

export default ReportTypeSelector;