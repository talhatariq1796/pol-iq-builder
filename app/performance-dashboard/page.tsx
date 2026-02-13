'use client';

import { useEffect, useState } from 'react';
import { PerformanceMonitor } from '@/utils/performance-monitor';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { RefreshCw, AlertCircle } from 'lucide-react';

const monitor = new PerformanceMonitor();

export default function PerformanceDashboard() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchReport = async () => {
    try {
      setLoading(true);
      const performanceReport = monitor.getPerformanceReport();
      setReport(performanceReport);
    } catch (err) {
      setError('Failed to fetch performance data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
    const interval = setInterval(fetchReport, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="p-4">Loading performance data...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-red-500 flex items-center gap-2">
        <AlertCircle className="h-5 w-5" />
        {error}
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Performance Dashboard</h1>
        <Button onClick={fetchReport} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Total Operations</CardTitle>
            <CardDescription>Across all components</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {report?.totalMetrics || 0}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Error Rate</CardTitle>
            <CardDescription>System-wide error percentage</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-red-500">
              {((report?.errorCount / report?.totalMetrics) * 100).toFixed(1)}%
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Last Updated</CardTitle>
            <CardDescription>Performance data timestamp</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {new Date(report?.timestamp).toLocaleTimeString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Component Performance */}
      <Card>
        <CardHeader>
          <CardTitle>Component Performance</CardTitle>
          <CardDescription>Performance metrics by component</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Operations</TableHead>
                <TableHead>Success Rate</TableHead>
                <TableHead>Avg Duration</TableHead>
                <TableHead>Max Duration</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(report?.components || {}).map(([component, data]: [string, any]) => (
                <TableRow key={component}>
                  <TableCell className="font-medium">{component}</TableCell>
                  <TableCell>{data.totalOperations}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={data.avgSuccessRate * 100} className="w-24" />
                      <span>{(data.avgSuccessRate * 100).toFixed(1)}%</span>
                    </div>
                  </TableCell>
                  <TableCell>{data.avgDuration.toFixed(2)}ms</TableCell>
                  <TableCell>{data.maxDuration.toFixed(2)}ms</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Slowest Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Slowest Operations</CardTitle>
          <CardDescription>Top 5 slowest operations</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report?.slowestOperations.map((op: any, index: number) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{op.component}</TableCell>
                  <TableCell>{op.operation}</TableCell>
                  <TableCell>{op.duration.toFixed(2)}ms</TableCell>
                  <TableCell>{new Date(op.timestamp).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Error Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>Error Metrics</CardTitle>
          <CardDescription>Recent error occurrences</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Component</TableHead>
                <TableHead>Operation</TableHead>
                <TableHead>Error Details</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monitor.getErrorMetrics().map((metric, index) => (
                <TableRow key={index}>
                  <TableCell className="font-medium">{metric.component}</TableCell>
                  <TableCell>{metric.operation}</TableCell>
                  <TableCell>{JSON.stringify(metric.details?.error)}</TableCell>
                  <TableCell>{new Date(metric.timestamp).toLocaleTimeString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
} 