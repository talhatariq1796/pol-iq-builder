/**
 * Budget and Channel Recommendations Component
 * 
 * Provides intelligent budget allocation and media channel recommendations
 * for territory-based campaigns with interactive planning tools.
 */

import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { 
  DollarSign, 
  TrendingUp, 
  Target,
  Zap,
  BarChart3,
  PieChart as PieChartIcon,
  Calculator,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  ArrowRight
} from 'lucide-react';

import { ClusterResult } from '@/lib/clustering/types';
import { 
  CampaignRecommendation, 
  CampaignComparison,
  CampaignPlanningService,
  MediaChannel 
} from '@/lib/clustering/campaign/CampaignPlanningService';

interface BudgetChannelRecommendationsProps {
  territories: ClusterResult[];
  totalBudget?: number;
  onBudgetChange?: (budget: number) => void;
  onExportPlan?: (plan: CampaignComparison) => void;
  className?: string;
}

type BudgetView = 'overview' | 'territory' | 'channel' | 'optimizer';

export function BudgetChannelRecommendations({
  territories,
  totalBudget = 100000,
  onBudgetChange,
  onExportPlan,
  className = ''
}: BudgetChannelRecommendationsProps) {
  const [currentBudget, setCurrentBudget] = useState(totalBudget);
  const [budgetView, setBudgetView] = useState<BudgetView>('overview');
  const [customAllocation, setCustomAllocation] = useState<Record<number, number>>({});

  // Generate campaign recommendations
  const campaignPlan = useMemo(() => {
    const campaignService = CampaignPlanningService.getInstance();
    return campaignService.generateMultiTerritoryRecommendations(
      territories, 
      'analysis-geographic', 
      currentBudget
    );
  }, [territories, currentBudget]);

  const handleBudgetChange = (newBudget: number) => {
    setCurrentBudget(newBudget);
    onBudgetChange?.(newBudget);
  };

  const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96C93F', '#FFA07A', '#DDA0DD'];

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Budget Control Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5" />
                Campaign Budget & Channel Planning
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Optimize budget allocation across {territories.length} territories
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-2xl font-bold text-green-600">
                  ${currentBudget.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Total Budget</div>
              </div>
              
              {onExportPlan && (
                <Button onClick={() => onExportPlan(campaignPlan)}>
                  Export Plan
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {/* Budget Input */}
          <div className="flex items-center gap-4 mb-6">
            <div className="flex-1">
              <Label htmlFor="budget-input" className="text-sm font-medium">
                Total Campaign Budget
              </Label>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg">$</span>
                <Input
                  id="budget-input"
                  type="number"
                  value={currentBudget}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleBudgetChange(Number(e.target.value))}
                  className="text-lg font-medium"
                  min={10000}
                  max={10000000}
                  step={1000}
                />
              </div>
            </div>
            
            <div className="flex-1">
              <Label className="text-sm font-medium">Quick Budget</Label>
              <div className="flex gap-2 mt-1">
                {[50000, 100000, 250000, 500000].map(amount => (
                  <Button
                    key={amount}
                    variant={currentBudget === amount ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleBudgetChange(amount)}
                  >
                    ${amount / 1000}K
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="flex gap-2 mb-4">
            {[
              { key: 'overview', label: 'Overview', icon: BarChart3 },
              { key: 'territory', label: 'By Territory', icon: Target },
              { key: 'channel', label: 'By Channel', icon: TrendingUp },
              { key: 'optimizer', label: 'Optimizer', icon: Zap }
            ].map(({ key, label, icon: Icon }) => (
              <Button
                key={key}
                variant={budgetView === key ? "default" : "outline"}
                size="sm"
                onClick={() => setBudgetView(key as BudgetView)}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Budget Overview */}
      {budgetView === 'overview' && (
        <BudgetOverview 
          campaignPlan={campaignPlan} 
          totalBudget={currentBudget}
          colors={colors}
        />
      )}

      {/* Territory Budget Breakdown */}
      {budgetView === 'territory' && (
        <TerritoryBudgetBreakdown 
          campaignPlan={campaignPlan}
          totalBudget={currentBudget}
          colors={colors}
        />
      )}

      {/* Channel Recommendations */}
      {budgetView === 'channel' && (
        <ChannelRecommendations 
          campaignPlan={campaignPlan}
          colors={colors}
        />
      )}

      {/* Budget Optimizer */}
      {budgetView === 'optimizer' && (
        <BudgetOptimizer 
          territories={territories}
          currentBudget={currentBudget}
          campaignPlan={campaignPlan}
        />
      )}

      {/* Strategic Insights */}
      <StrategicInsights insights={campaignPlan.strategicInsights} />
    </div>
  );
}

interface BudgetOverviewProps {
  campaignPlan: CampaignComparison;
  totalBudget: number;
  colors: string[];
}

function BudgetOverview({ campaignPlan, totalBudget, colors }: BudgetOverviewProps) {
  // Prepare pie chart data
  const territoryData = campaignPlan.territories.map((territory, index) => ({
    name: territory.territoryName.length > 15 ? 
      territory.territoryName.substring(0, 15) + '...' : 
      territory.territoryName,
    fullName: territory.territoryName,
    value: territory.recommendedBudget.optimal,
    percentage: (territory.recommendedBudget.optimal / campaignPlan.budgetSummary.totalBudget.optimal) * 100,
    color: colors[index % colors.length]
  }));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Budget Allocation Pie Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <PieChartIcon className="h-4 w-4" />
            Budget Allocation by Territory
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={territoryData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percentage }: { name: string; percentage: number }) => `${name}: ${percentage.toFixed(1)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {territoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Budget Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Budget Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-lg font-bold text-blue-600">
                  ${campaignPlan.budgetSummary.totalBudget.optimal.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Recommended</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-lg font-bold text-green-600">
                  ${totalBudget.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">Your Budget</div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Range: ${campaignPlan.budgetSummary.totalBudget.min.toLocaleString()} - ${campaignPlan.budgetSummary.totalBudget.max.toLocaleString()}</span>
              </div>
              
              <div className="flex items-center gap-2">
                {totalBudget >= campaignPlan.budgetSummary.totalBudget.min ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-orange-600" />
                )}
                <span className="text-sm">
                  {totalBudget >= campaignPlan.budgetSummary.totalBudget.min 
                    ? 'Budget is within recommended range'
                    : 'Budget below recommended minimum'
                  }
                </span>
              </div>
            </div>

            {/* Territory Priority List */}
            <div className="mt-4">
              <h4 className="font-medium text-sm mb-2">Territory Priority</h4>
              <div className="space-y-2">
                {campaignPlan.territories
                  .sort((a, b) => {
                    const priorityOrder = { high: 3, medium: 2, low: 1 };
                    return priorityOrder[b.campaignStrategy.priority] - priorityOrder[a.campaignStrategy.priority];
                  })
                  .slice(0, 4)
                  .map((territory, index) => (
                    <div key={territory.territoryId} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={territory.campaignStrategy.priority === 'high' ? 'default' : 
                                   territory.campaignStrategy.priority === 'medium' ? 'secondary' : 'outline'}
                          className="w-12 text-xs"
                        >
                          {territory.campaignStrategy.priority}
                        </Badge>
                        <span className="truncate">{territory.territoryName}</span>
                      </div>
                      <span className="font-medium">${territory.recommendedBudget.optimal.toLocaleString()}</span>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface TerritoryBudgetBreakdownProps {
  campaignPlan: CampaignComparison;
  totalBudget: number;
  colors: string[];
}

function TerritoryBudgetBreakdown({ campaignPlan, totalBudget, colors }: TerritoryBudgetBreakdownProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Territory Budget Breakdown</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Territory</TableHead>
              <TableHead className="text-center">Strategy</TableHead>
              <TableHead className="text-center">Priority</TableHead>
              <TableHead className="text-center">Recommended</TableHead>
              <TableHead className="text-center">Range</TableHead>
              <TableHead className="text-center">% of Total</TableHead>
              <TableHead className="text-center">Expected ROI</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaignPlan.territories.map((territory, index) => {
              const percentage = (territory.recommendedBudget.optimal / campaignPlan.budgetSummary.totalBudget.optimal) * 100;
              return (
                <TableRow key={territory.territoryId}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded"
                        style={{ backgroundColor: colors[index % colors.length] }}
                      />
                      <div>
                        <div className="font-medium">{territory.territoryName}</div>
                        <div className="text-xs text-muted-foreground">
                          {territory.expectedOutcomes.reach.toLocaleString()} reach
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant="outline">{territory.campaignStrategy.type}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={territory.campaignStrategy.priority === 'high' ? 'default' : 
                               territory.campaignStrategy.priority === 'medium' ? 'secondary' : 'outline'}
                    >
                      {territory.campaignStrategy.priority}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center font-medium">
                    ${territory.recommendedBudget.optimal.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center text-xs">
                    ${territory.recommendedBudget.min.toLocaleString()} - 
                    ${territory.recommendedBudget.max.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    <div>{percentage.toFixed(1)}%</div>
                    <Progress value={percentage} className="h-1 mt-1" />
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {territory.expectedOutcomes.projectedROI}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

interface ChannelRecommendationsProps {
  campaignPlan: CampaignComparison;
  colors: string[];
}

function ChannelRecommendations({ campaignPlan, colors }: ChannelRecommendationsProps) {
  // Aggregate channel data across all territories
  const channelData = Object.entries(campaignPlan.budgetSummary.budgetByChannel)
    .map(([channel, budget], index) => ({
      name: channel,
      budget,
      percentage: (budget / campaignPlan.budgetSummary.totalBudget.optimal) * 100,
      color: colors[index % colors.length]
    }))
    .sort((a, b) => b.budget - a.budget);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Channel Budget Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Budget Allocation</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 mb-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channelData} layout="horizontal">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} />
                <Tooltip formatter={(value: number) => `$${value.toLocaleString()}`} />
                <Bar dataKey="budget" fill="#8884d8">
                  {channelData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Channel Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Channel Performance Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {channelData.slice(0, 5).map((channel, index) => (
              <div key={channel.name} className="p-3 border rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: channel.color }}
                    />
                    <span className="font-medium">{channel.name}</span>
                  </div>
                  <span className="font-bold">${channel.budget.toLocaleString()}</span>
                </div>
                
                <div className="flex justify-between text-sm text-muted-foreground mb-1">
                  <span>{channel.percentage.toFixed(1)}% of total budget</span>
                  <span>Est. CPM: $12-18</span>
                </div>
                
                <Progress value={channel.percentage} className="h-1" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface BudgetOptimizerProps {
  territories: ClusterResult[];
  currentBudget: number;
  campaignPlan: CampaignComparison;
}

function BudgetOptimizer({ territories, currentBudget, campaignPlan }: BudgetOptimizerProps) {
  const [optimizationGoal, setOptimizationGoal] = useState<'roi' | 'reach' | 'balance'>('balance');

  const optimizationTips = [
    {
      icon: <Lightbulb className="h-4 w-4 text-yellow-600" />,
      title: 'High-Value Territories',
      description: 'Allocate 60% of budget to territories with scores above 7.0',
      impact: '+15% ROI improvement'
    },
    {
      icon: <Target className="h-4 w-4 text-blue-600" />,
      title: 'Channel Efficiency',
      description: 'Focus on digital channels for better targeting and measurement',
      impact: '+25% cost efficiency'
    },
    {
      icon: <TrendingUp className="h-4 w-4 text-green-600" />,
      title: 'Timing Optimization',
      description: 'Start with high-score territories, then expand to medium-score areas',
      impact: '+20% faster results'
    }
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Budget Optimizer
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Get AI-powered recommendations to optimize your campaign performance
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <Label className="text-sm font-medium">Optimization Goal</Label>
              <Select value={optimizationGoal} onValueChange={(value: any) => setOptimizationGoal(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="roi">Maximize ROI</SelectItem>
                  <SelectItem value="reach">Maximize Reach</SelectItem>
                  <SelectItem value="balance">Balanced Approach</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4">
            {optimizationTips.map((tip, index) => (
              <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                {tip.icon}
                <div className="flex-1">
                  <h4 className="font-medium text-sm">{tip.title}</h4>
                  <p className="text-sm text-muted-foreground mt-1">{tip.description}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">{tip.impact}</Badge>
                    <ArrowRight className="h-3 w-3 text-muted-foreground" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StrategicInsightsProps {
  insights: CampaignComparison['strategicInsights'];
}

function StrategicInsights({ insights }: StrategicInsightsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Target className="h-4 w-4 text-green-600" />
            Top Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {insights.topOpportunities.map((opportunity, index) => (
              <li key={index} className="flex items-start gap-2">
                <CheckCircle className="h-3 w-3 text-green-600 mt-0.5 flex-shrink-0" />
                <span>{opportunity}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-blue-600" />
            Resource Allocation
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {insights.resourceAllocation.map((allocation, index) => (
              <li key={index} className="flex items-start gap-2">
                <BarChart3 className="h-3 w-3 text-blue-600 mt-0.5 flex-shrink-0" />
                <span>{allocation}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-orange-600" />
            Risk Factors
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {insights.riskFactors.map((risk, index) => (
              <li key={index} className="flex items-start gap-2">
                <AlertCircle className="h-3 w-3 text-orange-600 mt-0.5 flex-shrink-0" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-purple-600" />
            Synergies
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            {insights.synergies.map((synergy, index) => (
              <li key={index} className="flex items-start gap-2">
                <Zap className="h-3 w-3 text-purple-600 mt-0.5 flex-shrink-0" />
                <span>{synergy}</span>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}