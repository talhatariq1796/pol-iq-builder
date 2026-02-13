/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown,
  Home, 
  Calendar,
  DollarSign,
  BarChart3,
  Activity,
  Clock,
  MapPin
} from 'lucide-react';
import { ComprehensiveStats, formatCurrency, formatLargeNumber } from '@/lib/utils/cmaStatistics';
import { CMAProperty, calculateTimeOnMarket } from './types';
import { calculateMarketMomentum } from '@/lib/pdf/data/extractors';

interface EnhancedKPICardsProps {
  stats: ComprehensiveStats;
  properties: CMAProperty[];
  reportType: 'sold' | 'active' | 'both';
}

const EnhancedKPICards: React.FC<EnhancedKPICardsProps> = ({ stats, properties, reportType }) => {
  const [activeTab, setActiveTab] = React.useState('current');

  // Filter and enrich properties based on report type (same logic as EnhancedAIAnalysis)
  const filteredProperties = React.useMemo(() => {
    // First, enrich all properties with calculated time_on_market if missing
    const enrichedProperties = properties.map(p => {
      if (!p.time_on_market || p.time_on_market <= 0) {
        const calculatedDOM = calculateTimeOnMarket(p);
        return { ...p, time_on_market: calculatedDOM };
      }
      return p;
    });

    // Then filter by report type
    if (reportType === 'sold') {
      return enrichedProperties.filter(p => p.status === 'sold' || p.st?.toUpperCase() === 'SO');
    } else if (reportType === 'active') {
      return enrichedProperties.filter(p => p.status === 'active' || p.st?.toUpperCase() === 'AC');
    }
    return enrichedProperties; // 'both' returns all
  }, [properties, reportType]);

  // Calculate market momentum using FILTERED properties with calculated time_on_market
  const marketMomentum = React.useMemo(() =>
    calculateMarketMomentum(filteredProperties),
    [filteredProperties]
  );
  
  // Calculate market trends with safe access and prevent infinite render loops
  const monthlyAvg = React.useMemo(() => stats.monthly?.avgPrice || 0, [stats.monthly?.avgPrice]);
  const annualAvg = React.useMemo(() => stats.annual?.avgPrice || 0, [stats.annual?.avgPrice]);
  const monthlyAppreciation = React.useMemo(() => 
    monthlyAvg > 0 && annualAvg > 0 
      ? Math.round(((monthlyAvg - annualAvg) / annualAvg) * 100)
      : 0
  , [monthlyAvg, annualAvg]);
  
  // Determine which stats to show based on report type with fallback
  const primaryStats = reportType === 'sold' ? (stats.soldStats || stats.allTime) : 
                      reportType === 'active' ? (stats.activeStats || stats.allTime) : 
                      (stats.allTime || stats);

  const KPICard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color = 'primary',
    trend
  }: {
    title: string;
    value: string;
    subtitle: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
    color?: 'primary' | 'dark' | 'light' | 'accent';
    trend?: 'up' | 'down' | 'neutral';
  }) => {
    // BHHS Colors only: #660D39 (primary maroon), #670038 (secondary maroon), #484247 (text gray)
    const colorClasses = {
      primary: 'bg-[#660D39]/10 border-[#660D39] text-[#484247]',
      dark: 'bg-[#670038]/10 border-[#670038] text-[#484247]',
      light: 'bg-[#660D39]/5 border-[#660D39]/50 text-[#484247]',
      accent: 'bg-[#8B4B6B]/10 border-[#8B4B6B] text-[#484247]'
    };

    const iconClasses = {
      primary: 'text-[#660D39]',
      dark: 'text-[#670038]',
      light: 'text-[#8B4B6B]',
      accent: 'text-[#660D39]'
    };

    return (
      <Card className={`${colorClasses[color]} border-2 border-[#660D39] transition-all hover:shadow-lg`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2 font-montserrat">
            <Icon className={`h-4 w-4 ${iconClasses[color]}`} />
            {title}
            {trend && (
              <Badge variant={trend === 'up' ? 'default' : trend === 'down' ? 'destructive' : 'secondary'} className="ml-auto bg-[#660D39]">
                {trend === 'up' ? <TrendingUp className="h-3 w-3" /> :
                 trend === 'down' ? <TrendingDown className="h-3 w-3" /> : null}
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${iconClasses[color]} font-montserrat`}>
            {value}
          </div>
          <div className="text-xs text-gray-600 mt-1 font-montserrat">
            {subtitle}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Report Type Indicator with BHHS Branding */}
      <div className="flex items-center gap-4 mb-6">
        <Badge variant="outline" className="bg-gradient-to-r from-[#660D39] to-[#670038] text-white text-sm px-3 py-1 font-montserrat">
          {reportType === 'sold' ? 'Sold Properties Report' :
           reportType === 'active' ? 'Active Listings Report' :
           'Comprehensive Market Report'}
        </Badge>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-[#660D39]/10">
          <TabsTrigger value="current" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white font-montserrat">Current Period</TabsTrigger>
          <TabsTrigger value="monthly" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white font-montserrat">Monthly Trends</TabsTrigger>
          <TabsTrigger value="annual" className="data-[state=active]:bg-[#660D39] data-[state=active]:text-white font-montserrat">Annual Overview</TabsTrigger>
        </TabsList>

        <TabsContent value="current" className="space-y-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title={reportType === 'sold' ? "Avg Sold Price" : "Avg Asking Price"}
              value={formatCurrency(primaryStats?.avgPrice || stats.average_price || 0)}
              subtitle={`Median: ${formatCurrency(primaryStats?.medianPrice || stats.median_price || 0)}`}
              icon={DollarSign}
              color="primary"
              trend={monthlyAppreciation > 0 ? 'up' : monthlyAppreciation < 0 ? 'down' : 'neutral'}
            />

            <KPICard
              title="Price Range"
              value={`${formatLargeNumber(primaryStats?.minPrice || stats.min || 0)} - ${formatLargeNumber(primaryStats?.maxPrice || stats.max || 0)}`}
              subtitle={`Std Dev: ${formatCurrency(primaryStats?.standardDeviation || stats.standardDeviation || 0)}`}
              icon={BarChart3}
              color="dark"
            />

            <KPICard
              title="Avg Rent Estimate"
              value={formatCurrency(primaryStats?.avgRent || 0)}
              subtitle={`Range: ${formatCurrency(primaryStats?.minRent || 0)} - ${formatCurrency(primaryStats?.maxRent || 0)}`}
              icon={Home}
              color="accent"
            />

            <KPICard
              title="Time on Market"
              value={`${primaryStats?.avgTimeOnMarket || stats.average_dom || 0} days`}
              subtitle={`Range: ${primaryStats?.minTimeOnMarket || 0} - ${primaryStats?.maxTimeOnMarket || 0} days`}
              icon={Clock}
              color="light"
            />
          </div>

          {/* Additional metrics for sold properties */}
          {reportType !== 'active' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <KPICard
                title="Properties Sold"
                value={(stats.soldStats?.count || stats.sold_properties || 0).toString()}
                subtitle={`${Math.round(((stats.soldStats?.count || stats.sold_properties || 0) / (stats.total_properties || 1)) * 100)}% of total`}
                icon={Home}
                color="primary"
              />

              <KPICard
                title="Avg Price/SqFt"
                value={stats.price_per_sqft > 0 ? `$${stats.price_per_sqft}` : "N/A"}
                subtitle={stats.price_per_sqft > 0 ? "Market rate" : "Insufficient data"}
                icon={Activity}
                color="dark"
              />

              <KPICard
                title="Market Momentum"
                value={marketMomentum.classification}
                subtitle={`Composite score: ${marketMomentum.score.toFixed(0)}/100`}
                icon={TrendingUp}
                color={
                  marketMomentum.classification === 'Accelerating' ? "primary" : 
                  marketMomentum.classification === 'Steady' ? "light" : 
                  "accent"
                }
              />
            </div>
          )}

          {/* Additional metrics for active properties */}
          {reportType !== 'sold' && (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
              <KPICard
                title="Active Listings"
                value={(stats.activeStats?.count || stats.active_properties || 0).toString()}
                subtitle={`${Math.round(((stats.activeStats?.count || stats.active_properties || 0) / (stats.total_properties || 1)) * 100)}% of total`}
                icon={Home}
                color="light"
              />

              <KPICard
                title="Inventory Level"
                value={stats.inventoryLevel?.toUpperCase() || "MEDIUM"}
                subtitle="Market supply"
                icon={BarChart3}
                color={stats.inventoryLevel === 'low' ? "accent" : stats.inventoryLevel === 'high' ? "primary" : "light"}
              />

              <KPICard
                title="Market Activity"
                value={(primaryStats?.avgTimeOnMarket || stats.average_dom || 0) < 45 ? "High" : (primaryStats?.avgTimeOnMarket || stats.average_dom || 0) < 90 ? "Medium" : "Low"}
                subtitle="Buyer interest"
                icon={Activity}
                color={(primaryStats?.avgTimeOnMarket || stats.average_dom || 0) < 45 ? "primary" : (primaryStats?.avgTimeOnMarket || stats.average_dom || 0) < 90 ? "light" : "accent"}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Monthly Avg Price"
              value={formatCurrency(stats.monthly?.avgPrice || 0)}
              subtitle={`vs Annual: ${monthlyAppreciation > 0 ? '+' : ''}${monthlyAppreciation}%`}
              icon={DollarSign}
              color="primary"
              trend={monthlyAppreciation > 0 ? 'up' : monthlyAppreciation < 0 ? 'down' : 'neutral'}
            />

            <KPICard
              title="Monthly Range"
              value={`${formatLargeNumber(stats.monthly?.minPrice || 0)} - ${formatLargeNumber(stats.monthly?.maxPrice || 0)}`}
              subtitle={`${stats.monthly?.count || 0} properties`}
              icon={BarChart3}
              color="dark"
            />

            <KPICard
              title="Monthly Rent Est"
              value={formatCurrency(stats.monthly?.avgRent || 0)}
              subtitle={`Median: ${formatCurrency(stats.monthly?.medianRent || 0)}`}
              icon={Home}
              color="accent"
            />

            <KPICard
              title="Monthly DOM"
              value={`${stats.monthly?.avgTimeOnMarket || 0} days`}
              subtitle={`Median: ${stats.monthly?.medianTimeOnMarket || 0} days`}
              icon={Clock}
              color="light"
            />
          </div>
        </TabsContent>

        <TabsContent value="annual" className="space-y-4 mt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <KPICard
              title="Annual Avg Price"
              value={formatCurrency(stats.annual?.avgPrice || 0)}
              subtitle={`vs All-Time: ${formatCurrency((stats.allTime?.avgPrice || 0) - (stats.annual?.avgPrice || 0))}`}
              icon={DollarSign}
              color="primary"
            />

            <KPICard
              title="Annual Range"
              value={`${formatLargeNumber(stats.annual?.minPrice || 0)} - ${formatLargeNumber(stats.annual?.maxPrice || 0)}`}
              subtitle={`${stats.annual?.count || 0} properties`}
              icon={BarChart3}
              color="dark"
            />

            <KPICard
              title="Annual Rent Est"
              value={formatCurrency(stats.annual?.avgRent || 0)}
              subtitle={`Range: ${formatCurrency(stats.annual?.minRent || 0)} - ${formatCurrency(stats.annual?.maxRent || 0)}`}
              icon={Home}
              color="accent"
            />

            <KPICard
              title="Annual DOM"
              value={`${stats.annual?.avgTimeOnMarket || 0} days`}
              subtitle={`Range: ${stats.annual?.minTimeOnMarket || 0} - ${stats.annual?.maxTimeOnMarket || 0} days`}
              icon={Clock}
              color="light"
            />
          </div>

          {/* Annual market insights with BHHS Branding */}
          <Card className="mt-6 border-2 border-[#660D39]">
            <CardHeader className="bg-gradient-to-r from-[#660D39]/10 to-[#670038]/10">
              <CardTitle className="flex items-center gap-2 text-[#484247] font-montserrat">
                <MapPin className="h-5 w-5 text-[#660D39]" />
                Annual Market Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                <div className="bg-[#660D39]/10 p-3 rounded-lg border border-[#660D39]/30">
                  <div className="font-semibold text-[#484247] font-montserrat">Market Performance</div>
                  <div className="text-[#484247] font-montserrat">
                    {monthlyAppreciation > 5 ? "Strong appreciation" :
                     monthlyAppreciation > 0 ? "Positive growth" :
                     monthlyAppreciation > -5 ? "Stable market" : "Market decline"}
                  </div>
                </div>
                <div className="bg-[#660D39]/10 p-3 rounded-lg border border-[#660D39]/30">
                  <div className="font-semibold text-[#484247] font-montserrat">Liquidity</div>
                  <div className="text-[#484247] font-montserrat">
                    {(stats.annual?.avgTimeOnMarket || 0) < 45 ? "High liquidity" :
                     (stats.annual?.avgTimeOnMarket || 0) < 90 ? "Normal liquidity" : "Lower liquidity"}
                  </div>
                </div>
                <div className="bg-[#660D39]/10 p-3 rounded-lg border border-[#660D39]/30">
                  <div className="font-semibold text-[#484247] font-montserrat">Investment Potential</div>
                  <div className="text-[#484247] font-montserrat">
                    {((stats.annual?.avgRent || 0) / (stats.annual?.avgPrice || 1)) > 0.005 ? "Strong rental yield" :
                     ((stats.annual?.avgRent || 0) / (stats.annual?.avgPrice || 1)) > 0.003 ? "Good rental yield" : "Moderate rental yield"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default EnhancedKPICards;