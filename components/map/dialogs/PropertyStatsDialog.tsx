/**
 * Property Statistics Dialog for Layer Actions
 * 
 * Shows comprehensive statistics for real estate property layers.
 * Provides broker-relevant insights and metrics.
 */

import React, { useMemo } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  BarChart3, 
  TrendingUp, 
  MapPin, 
  Home, 
  DollarSign, 
  Calendar,
  Bed,
  Bath,
  Square,
  X
} from 'lucide-react';
import type { RealEstateProperty } from '../RealEstatePointLayerManager';

interface PropertyStatsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  layerTitle: string;
  properties: RealEstateProperty[];
}

interface PropertyStats {
  count: number;
  priceStats: {
    min: number;
    max: number;
    avg: number;
    median: number;
  };
  bedroomStats: {
    min: number;
    max: number;
    avg: number;
    distribution: Record<string, number>;
  };
  bathroomStats: {
    min: number;
    max: number;
    avg: number;
  };
  municipalityDistribution: Record<string, number>;
  priceRangeDistribution: Record<string, number>;
  timeOnMarketStats?: {
    min: number;
    max: number;
    avg: number;
  };
}

const PropertyStatsDialog: React.FC<PropertyStatsDialogProps> = ({
  isOpen,
  onClose,
  layerTitle,
  properties
}) => {
  // Calculate comprehensive statistics
  const stats: PropertyStats = useMemo(() => {
    if (!properties.length) {
      return {
        count: 0,
        priceStats: { min: 0, max: 0, avg: 0, median: 0 },
        bedroomStats: { min: 0, max: 0, avg: 0, distribution: {} },
        bathroomStats: { min: 0, max: 0, avg: 0 },
        municipalityDistribution: {},
        priceRangeDistribution: {}
      };
    }

    // Filter out properties with invalid prices
    const validProperties = properties.filter(p => {
      const price = typeof p.askedsold_price === 'number' ? p.askedsold_price : 
                   typeof p.price === 'number' ? p.price : 
                   typeof p.price === 'string' ? parseFloat(p.price.replace(/[^0-9.-]+/g, '')) : 0;
      return price > 0;
    });

    const prices = validProperties.map(p => {
      const price = typeof p.askedsold_price === 'number' ? p.askedsold_price : 
                   typeof p.price === 'number' ? p.price : 
                   typeof p.price === 'string' ? parseFloat(p.price.replace(/[^0-9.-]+/g, '')) : 0;
      return price;
    }).filter(p => p > 0);

    const bedrooms = validProperties
      .map(p => p.bedrooms_number || 0)
      .filter(b => b >= 0);

    const bathrooms = validProperties
      .map(p => p.bathrooms_number || 0)
      .filter(b => b >= 0);

    // Price statistics
    const sortedPrices = [...prices].sort((a, b) => a - b);
    const priceStats = {
      min: Math.min(...prices),
      max: Math.max(...prices),
      avg: prices.reduce((sum, p) => sum + p, 0) / prices.length,
      median: sortedPrices.length % 2 === 0 
        ? (sortedPrices[sortedPrices.length / 2 - 1] + sortedPrices[sortedPrices.length / 2]) / 2
        : sortedPrices[Math.floor(sortedPrices.length / 2)]
    };

    // Bedroom statistics and distribution
    const bedroomDistribution: Record<string, number> = {};
    bedrooms.forEach(b => {
      const key = b.toString();
      bedroomDistribution[key] = (bedroomDistribution[key] || 0) + 1;
    });

    const bedroomStats = {
      min: Math.min(...bedrooms),
      max: Math.max(...bedrooms),
      avg: bedrooms.reduce((sum, b) => sum + b, 0) / bedrooms.length,
      distribution: bedroomDistribution
    };

    // Bathroom statistics
    const bathroomStats = {
      min: Math.min(...bathrooms),
      max: Math.max(...bathrooms),
      avg: bathrooms.reduce((sum, b) => sum + b, 0) / bathrooms.length
    };

    // Municipality distribution
    const municipalityDistribution: Record<string, number> = {};
    validProperties.forEach(p => {
      const municipality = p.municipalityborough || 'Unknown';
      municipalityDistribution[municipality] = (municipalityDistribution[municipality] || 0) + 1;
    });

    // Price range distribution
    const priceRangeDistribution: Record<string, number> = {
      'Under $300K': 0,
      '$300K - $500K': 0,
      '$500K - $750K': 0,
      '$750K - $1M': 0,
      '$1M - $1.5M': 0,
      'Over $1.5M': 0
    };

    prices.forEach(price => {
      if (price < 300000) priceRangeDistribution['Under $300K']++;
      else if (price < 500000) priceRangeDistribution['$300K - $500K']++;
      else if (price < 750000) priceRangeDistribution['$500K - $750K']++;
      else if (price < 1000000) priceRangeDistribution['$750K - $1M']++;
      else if (price < 1500000) priceRangeDistribution['$1M - $1.5M']++;
      else priceRangeDistribution['Over $1.5M']++;
    });

    // Time on market statistics (if available)
    let timeOnMarketStats;
    const timeOnMarketValues = validProperties
      .map(p => p.days_on_market)
      .filter(d => typeof d === 'number' && d >= 0);

    if (timeOnMarketValues.length > 0) {
      timeOnMarketStats = {
        min: Math.min(...timeOnMarketValues),
        max: Math.max(...timeOnMarketValues),
        avg: timeOnMarketValues.reduce((sum, d) => sum + d, 0) / timeOnMarketValues.length
      };
    }

    return {
      count: validProperties.length,
      priceStats,
      bedroomStats,
      bathroomStats,
      municipalityDistribution,
      priceRangeDistribution,
      timeOnMarketStats
    };
  }, [properties]);

  // Helper function to format currency
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value);
  };

  // Helper function to format percentage
  const formatPercentage = (value: number, total: number): string => {
    return ((value / total) * 100).toFixed(1) + '%';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {layerTitle} Statistics
              <Badge variant="secondary">
                {stats.count} properties
              </Badge>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {/* Price Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <DollarSign className="h-4 w-4" />
                Price Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average:</span>
                  <span className="font-medium">{formatCurrency(stats.priceStats.avg)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Median:</span>
                  <span className="font-medium">{formatCurrency(stats.priceStats.median)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Range:</span>
                  <span className="font-medium">
                    {formatCurrency(stats.priceStats.min)} - {formatCurrency(stats.priceStats.max)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Bedroom Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bed className="h-4 w-4" />
                Bedroom Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average:</span>
                  <span className="font-medium">{stats.bedroomStats.avg.toFixed(1)}</span>
                </div>
                <Separator className="my-2" />
                {Object.entries(stats.bedroomStats.distribution)
                  .sort(([a], [b]) => parseInt(a) - parseInt(b))
                  .slice(0, 4)
                  .map(([bedrooms, count]) => (
                    <div key={bedrooms} className="flex justify-between">
                      <span className="text-gray-600">{bedrooms} bed{parseInt(bedrooms) !== 1 ? 's' : ''}:</span>
                      <span className="font-medium">
                        {count} ({formatPercentage(count, stats.count)})
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>

          {/* Bathroom Statistics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <Bath className="h-4 w-4" />
                Bathroom Stats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Average:</span>
                  <span className="font-medium">{stats.bathroomStats.avg.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Range:</span>
                  <span className="font-medium">
                    {stats.bathroomStats.min} - {stats.bathroomStats.max}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time on Market (if available) */}
          {stats.timeOnMarketStats && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4" />
                  Time on Market
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Average:</span>
                    <span className="font-medium">{Math.round(stats.timeOnMarketStats.avg)} days</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Range:</span>
                    <span className="font-medium">
                      {stats.timeOnMarketStats.min} - {stats.timeOnMarketStats.max} days
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Price Range Distribution */}
          <Card className="md:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <TrendingUp className="h-4 w-4" />
                Price Range Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {Object.entries(stats.priceRangeDistribution).map(([range, count]) => (
                  <div key={range} className="flex justify-between">
                    <span className="text-gray-600">{range}:</span>
                    <span className="font-medium">
                      {count} ({formatPercentage(count, stats.count)})
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Top Municipalities */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4" />
                Top Municipalities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {Object.entries(stats.municipalityDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 5)
                  .map(([municipality, count]) => (
                    <div key={municipality} className="flex justify-between">
                      <span className="text-gray-600 truncate" title={municipality}>
                        {municipality.length > 12 ? municipality.substring(0, 12) + '...' : municipality}:
                      </span>
                      <span className="font-medium">
                        {count} ({formatPercentage(count, stats.count)})
                      </span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Summary Insights */}
        <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
          <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
            <Home className="h-4 w-4" />
            Key Insights
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
            <div>
              • Average price is <strong>{formatCurrency(stats.priceStats.avg)}</strong> with a median of <strong>{formatCurrency(stats.priceStats.median)}</strong>
            </div>
            <div>
              • Most common bedroom count: <strong>
                {Object.entries(stats.bedroomStats.distribution).reduce((a, b) => 
                  stats.bedroomStats.distribution[a[0]] > stats.bedroomStats.distribution[b[0]] ? a : b
                )[0]} bedrooms
              </strong>
            </div>
            <div>
              • Properties range from <strong>{formatCurrency(stats.priceStats.min)}</strong> to <strong>{formatCurrency(stats.priceStats.max)}</strong>
            </div>
            <div>
              • Top municipality: <strong>
                {Object.entries(stats.municipalityDistribution).reduce((a, b) => 
                  stats.municipalityDistribution[a[0]] > stats.municipalityDistribution[b[0]] ? a : b
                )[0] || 'N/A'}
              </strong>
            </div>
            {stats.timeOnMarketStats && (
              <div className="md:col-span-2">
                • Average time on market: <strong>{Math.round(stats.timeOnMarketStats.avg)} days</strong>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PropertyStatsDialog;