'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Award,
  Users,
  Target,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { PerformanceAnalyzer } from '@/lib/canvassing/PerformanceAnalyzer';
import { ProgressStore } from '@/lib/canvassing/ProgressStore';
import type {
  LeaderboardEntry,
  PrecinctAnalytics,
  TemporalAnalytics,
  ConversionFunnel,
} from '@/lib/canvassing/types-analytics';
import type { PerformanceInsight } from '@/lib/canvassing/PerformanceAnalyzer';

type VolunteerBadge = 'Top Performer' | 'Most Improved' | 'Reliable' | 'Contact Master' | 'Speed Demon' | 'Veteran';

interface PerformanceAnalyticsProps {
  universeId: string;
  className?: string;
}

export function PerformanceAnalytics({
  universeId,
  className = '',
}: PerformanceAnalyticsProps) {
  const [period, setPeriod] = useState<'week' | 'last_week' | 'month' | 'all'>('week');
  const [activeTab, setActiveTab] = useState('volunteers');
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [turfPerformance, setTurfPerformance] = useState<PrecinctAnalytics[]>([]);
  const [temporalPattern, setTemporalPattern] = useState<TemporalAnalytics | null>(null);
  const [conversionFunnel, setConversionFunnel] = useState<ConversionFunnel | null>(null);
  const [insights, setInsights] = useState<PerformanceInsight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [universeId, period]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // Load volunteer rankings
      const rankings = PerformanceAnalyzer.getVolunteerRankings(universeId, 'doors');
      // Convert rankings to leaderboard entries
      const leaderboardData: LeaderboardEntry[] = rankings.slice(0, 10).map((r, i) => ({
        rank: i + 1,
        volunteerId: r.volunteerId,
        volunteerName: r.volunteerName,
        metric: 'doors' as const,
        value: r.metrics.totalDoors,
      }));
      setLeaderboard(leaderboardData);

      // Temporal patterns
      const temporalData = PerformanceAnalyzer.analyzeTemporalPatterns(universeId);
      setTemporalPattern(temporalData);

      // Conversion funnel
      const conversionData = PerformanceAnalyzer.buildConversionFunnel(universeId, { contactRate: 0.35, commitmentRate: 0.10 });
      setConversionFunnel(conversionData);

      // Generate insights (needs turfs parameter, use empty for now)
      const insightsData = PerformanceAnalyzer.generateInsights(universeId, []);
      setInsights(insightsData);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeColor = (badge: VolunteerBadge): string => {
    const colors: Record<VolunteerBadge, string> = {
      'Top Performer': 'bg-amber-100 text-amber-800 border-amber-300',
      'Most Improved': 'bg-green-100 text-green-800 border-green-300',
      'Reliable': 'bg-blue-100 text-blue-800 border-blue-300',
      'Contact Master': 'bg-purple-100 text-purple-800 border-purple-300',
      'Speed Demon': 'bg-orange-100 text-orange-800 border-orange-300',
      'Veteran': 'bg-gray-100 text-gray-800 border-gray-300',
    };
    return colors[badge] || '';
  };

  const getTrendIcon = (trend: 'improving' | 'stable' | 'declining') => {
    if (trend === 'improving') {
      return <TrendingUp className="h-4 w-4 text-green-600" />;
    } else if (trend === 'declining') {
      return <TrendingDown className="h-4 w-4 text-red-600" />;
    }
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getStatusBadge = (status: 'ahead' | 'on_track' | 'behind' | 'stalled') => {
    const variants: Record<string, string> = {
      ahead: 'bg-green-100 text-green-800 border-green-300',
      on_track: 'bg-blue-100 text-blue-800 border-blue-300',
      behind: 'bg-orange-100 text-orange-800 border-orange-300',
      stalled: 'bg-red-100 text-red-800 border-red-300',
    };
    return (
      <Badge variant="outline" className={variants[status]}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  const getInsightColor = (type: PerformanceInsight['type']) => {
    const colors: Record<string, string> = {
      warning: 'border-orange-300 bg-orange-50',
      success: 'border-green-300 bg-green-50',
      info: 'border-blue-300 bg-blue-50',
      opportunity: 'border-purple-300 bg-purple-50',
    };
    return colors[type] || 'border-gray-300';
  };

  const getInsightIcon = (type: PerformanceInsight['type']) => {
    const icons: Record<string, JSX.Element> = {
      warning: <Alert className="h-4 w-4 text-orange-600" />,
      success: <Award className="h-4 w-4 text-green-600" />,
      info: <BarChart3 className="h-4 w-4 text-blue-600" />,
      opportunity: <Lightbulb className="h-4 w-4 text-purple-600" />,
    };
    return icons[type] || null;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center h-64">
          <div className="text-gray-500">Loading analytics...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Performance Analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="volunteers">
              <Users className="h-4 w-4 mr-1" />
              Volunteers
            </TabsTrigger>
            <TabsTrigger value="turfs">
              <Target className="h-4 w-4 mr-1" />
              Turfs
            </TabsTrigger>
            <TabsTrigger value="trends">
              <BarChart3 className="h-4 w-4 mr-1" />
              Trends
            </TabsTrigger>
            <TabsTrigger value="conversion">
              <TrendingUp className="h-4 w-4 mr-1" />
              Conversion
            </TabsTrigger>
            <TabsTrigger value="insights">
              <Lightbulb className="h-4 w-4 mr-1" />
              Insights
            </TabsTrigger>
          </TabsList>

          {/* Volunteers Tab */}
          <TabsContent value="volunteers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Volunteer Leaderboard</h3>
              <Select
                value={period}
                onValueChange={(value) => setPeriod(value as typeof period)}
              >
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="week">This Week</SelectItem>
                  <SelectItem value="last_week">Last Week</SelectItem>
                  <SelectItem value="month">This Month</SelectItem>
                  <SelectItem value="all">All Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Volunteer</TableHead>
                  <TableHead className="text-right">Value</TableHead>
                  <TableHead className="text-right">Metric</TableHead>
                  <TableHead className="w-20">Change</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leaderboard.map((volunteer) => (
                  <TableRow key={volunteer.volunteerId}>
                    <TableCell className="font-semibold">
                      {volunteer.rank <= 3 && (
                        <Award
                          className={`h-5 w-5 inline mr-1 ${
                            volunteer.rank === 1
                              ? 'text-yellow-500'
                              : volunteer.rank === 2
                              ? 'text-gray-400'
                              : 'text-amber-600'
                          }`}
                        />
                      )}
                      {volunteer.rank}
                    </TableCell>
                    <TableCell className="font-medium">
                      {volunteer.volunteerName}
                    </TableCell>
                    <TableCell className="text-right">
                      {volunteer.value.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      {volunteer.metric}
                    </TableCell>
                    <TableCell className="text-center">
                      {volunteer.change === 'up' && <TrendingUp className="h-4 w-4 text-green-600" />}
                      {volunteer.change === 'down' && <TrendingDown className="h-4 w-4 text-red-600" />}
                      {volunteer.change === 'same' && <Minus className="h-4 w-4 text-gray-400" />}
                      {volunteer.change === 'new' && <Badge variant="outline">New</Badge>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {leaderboard.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No volunteer data available for this period
              </div>
            )}
          </TabsContent>

          {/* Turfs Tab */}
          <TabsContent value="turfs" className="space-y-4">
            <h3 className="text-lg font-semibold">Turf Performance Rankings</h3>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Rank</TableHead>
                  <TableHead>Turf</TableHead>
                  <TableHead className="text-right">Efficiency Score</TableHead>
                  <TableHead className="text-right">Doors/Hour</TableHead>
                  <TableHead className="text-right">Contact Rate</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {turfPerformance.map((turf, idx) => (
                  <TableRow key={turf.precinctId}>
                    <TableCell className="font-semibold">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{turf.precinctName}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Progress
                          value={turf.efficiencyScore}
                          className="w-16"
                        />
                        <span className="text-sm font-medium">
                          {turf.efficiencyScore.toFixed(0)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {turf.averageDoorsPerHour.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-right">
                      {(turf.contactRate * 100).toFixed(1)}%
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{turf.totalSessions} sessions</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {turfPerformance.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No turf performance data available
              </div>
            )}
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends" className="space-y-4">
            <h3 className="text-lg font-semibold">Temporal Patterns</h3>

            {temporalPattern ? (
              <div className="grid grid-cols-2 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Best Day of Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][temporalPattern.bestDayOfWeek] || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-500">
                      Day {temporalPattern.bestDayOfWeek}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Best Hour</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      {temporalPattern.bestHourOfDay}:00
                    </div>
                    <div className="text-sm text-gray-500">
                      Highest contact rate
                    </div>
                  </CardContent>
                </Card>

                <Card className="col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">Weekly Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {temporalPattern.weeklySummary
                        .slice(0, 7)
                        .map((week) => (
                          <div key={week.weekStart} className="flex items-center justify-between">
                            <span className="text-sm font-medium">Week {week.weekNumber}</span>
                            <div className="flex items-center gap-4">
                              <span className="text-sm text-gray-600">
                                {week.totalDoors} doors
                              </span>
                              <span className="text-sm text-gray-600">
                                {week.averageDoorsPerHour.toFixed(1)}/hr
                              </span>
                              <span className="text-sm text-gray-600">
                                {week.uniqueVolunteers} volunteers
                              </span>
                            </div>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No temporal pattern data available
              </div>
            )}
          </TabsContent>

          {/* Conversion Tab */}
          <TabsContent value="conversion" className="space-y-4">
            <h3 className="text-lg font-semibold">Conversion Funnel</h3>

            {conversionFunnel ? (
              <div className="space-y-6">
                {/* Doors to Contacts */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Doors Knocked → Contacts Made</span>
                      <span className="text-2xl font-bold">
                        {(conversionFunnel.contactRate * 100).toFixed(1)}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Doors Knocked</span>
                        <span className="font-semibold">
                          {conversionFunnel.doorsKnocked.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={100} className="h-8 bg-blue-100" />
                      <div className="flex justify-between text-sm">
                        <span>Contacts Made</span>
                        <span className="font-semibold">
                          {conversionFunnel.contactsMade.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={conversionFunnel.contactRate * 100} className="h-8 bg-green-100" />
                      <div className="text-xs text-gray-500 mt-2">
                        Target: {(conversionFunnel.targetContactRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Contacts to Positive */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Contacts → Positive Responses</span>
                      <span className="text-2xl font-bold">
                        {(conversionFunnel.positiveRate * 100).toFixed(1)}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Contacts Made</span>
                        <span className="font-semibold">
                          {conversionFunnel.contactsMade.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={100} className="h-8 bg-green-100" />
                      <div className="flex justify-between text-sm">
                        <span>Positive Responses</span>
                        <span className="font-semibold">
                          {conversionFunnel.positiveConversations.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={conversionFunnel.positiveRate * 100} className="h-8 bg-yellow-100" />
                    </div>
                  </CardContent>
                </Card>

                {/* Positive to Commitments */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>Positive Responses → Commitments</span>
                      <span className="text-2xl font-bold">
                        {(conversionFunnel.commitmentRate * 100).toFixed(1)}%
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Positive Responses</span>
                        <span className="font-semibold">
                          {conversionFunnel.positiveConversations.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={100} className="h-8 bg-yellow-100" />
                      <div className="flex justify-between text-sm">
                        <span>Commitments</span>
                        <span className="font-semibold">
                          {conversionFunnel.commitments.toLocaleString()}
                        </span>
                      </div>
                      <Progress value={conversionFunnel.commitmentRate * 100} className="h-8 bg-purple-100" />
                      <div className="text-xs text-gray-500 mt-2">
                        Target: {(conversionFunnel.targetCommitmentRate * 100).toFixed(1)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No conversion data available
              </div>
            )}
          </TabsContent>

          {/* Insights Tab */}
          <TabsContent value="insights" className="space-y-4">
            <h3 className="text-lg font-semibold">Performance Insights</h3>

            <div className="space-y-3">
              {insights.map((insight, idx) => (
                <Alert
                  key={idx}
                  className={`border ${getInsightColor(insight.type)}`}
                >
                  <div className="flex items-start gap-3">
                    {getInsightIcon(insight.type)}
                    <div className="flex-1">
                      <AlertDescription className="text-sm">
                        <div className="font-medium mb-1">{insight.title}</div>
                        <div className="text-xs text-gray-700">{insight.description}</div>
                        {insight.recommendation && (
                          <div className="text-xs text-gray-600 mt-2">
                            <strong>Recommendation:</strong> {insight.recommendation}
                          </div>
                        )}
                      </AlertDescription>
                    </div>
                  </div>
                </Alert>
              ))}
            </div>

            {insights.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                No insights available yet
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
