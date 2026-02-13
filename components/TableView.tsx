import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TimeSeriesDataPoint,
  ComparisonDataPoint,
  MetricConfig,
  VisualizationType,
  AggregationMethod
} from './EnhancedVisualization';

interface TableViewProps {
  data: TimeSeriesDataPoint[] | ComparisonDataPoint[];
  type: VisualizationType;
  metrics: MetricConfig[];
  aggregationMethod: AggregationMethod;
  isLoading?: boolean;
  showConfidence?: boolean;
  onRowClick?: (data: any, index: number) => void;
}

const aggregateData = (
  data: number[], 
  method: AggregationMethod = 'average'
): number => {
  if (data.length === 0) return 0;
  switch (method) {
    case 'sum': return data.reduce((a, b) => a + b, 0);
    case 'average': return data.reduce((a, b) => a + b, 0) / data.length;
    case 'max': return Math.max(...data);
    case 'min': return Math.min(...data);
    default: return data.reduce((a, b) => a + b, 0) / data.length;
  }
};

export default function TableView({
  data,
  type,
  metrics,
  aggregationMethod,
  isLoading = false,
  showConfidence = true,
  onRowClick
}: TableViewProps) {
  const renderCell = (row: any, metric: MetricConfig) => {
    if (isLoading) {
      return <Skeleton className="h-4 w-16" />;
    }

    let value: number;
    let confidence: number | undefined;

    if (type === 'timeseries') {
      value = row.value;
      confidence = row.confidence;
    } else if (type === 'comparison') {
      value = row.values[metric.name];
      confidence = row.confidence;
    } else {
      value = row.value;
      confidence = row.confidence;
    }

    return (
      <div className="space-y-1">
        <div>{metric.format ? metric.format(value) : value.toFixed(2)}</div>
        {showConfidence && confidence !== undefined && (
          <div className="text-xs text-muted-foreground">
            ±{(confidence * 100).toFixed(1)}%
          </div>
        )}
      </div>
    );
  };

  const renderHeaderCell = (metric: MetricConfig) => (
    <div className="space-y-1">
      <div>{metric.name}</div>
      {(metric as any).threshold && (
        <div className="text-xs text-gray-500 space-x-2">
          {(metric as any).threshold.warning && (
            <span className="text-yellow-600">
              W: {(metric as any).threshold.warning}
            </span>
          )}
          {(metric as any).threshold.critical && (
            <span className="text-red-600">
              C: {(metric as any).threshold.critical}
            </span>
          )}
        </div>
      )}
    </div>
  );

  const renderAggregationRow = () => {
    if (isLoading) {
      return (
        <TableRow>
          <TableCell>
            <Skeleton className="h-4 w-24" />
          </TableCell>
          {metrics.map((metric) => (
            <TableCell key={metric.name}>
              <Skeleton className="h-4 w-16" />
            </TableCell>
          ))}
        </TableRow>
      );
    }

    return (
      <TableRow className="bg-muted/50 font-medium">
        <TableCell>
          {aggregationMethod.charAt(0).toUpperCase() + aggregationMethod.slice(1)}
        </TableCell>
        {metrics.map((metric) => {
          const values = data.map((row: any) =>
            type === 'timeseries'
              ? row.value
              : row.values[metric.name]
          );
          const aggregatedValue = aggregateData(
            values,
            (metric as any).aggregation || aggregationMethod
          );
          return (
            <TableCell key={metric.name}>
              {metric.format
                ? metric.format(aggregatedValue)
                : aggregatedValue.toFixed(2)}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  return (
    <ScrollArea className="h-[400px] rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>
              {type === 'timeseries' ? 'Date' : 'Category'}
            </TableHead>
            {metrics.map((metric) => (
              <TableHead key={metric.name}>{renderHeaderCell(metric)}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row: any, index: number) => (
            <TableRow
              key={index}
              className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : ''}
              onClick={() => onRowClick?.(row, index)}
            >
              <TableCell>
                {isLoading ? (
                  <Skeleton className="h-4 w-24" />
                ) : type === 'timeseries' ? (
                  row.formattedDate
                ) : (
                  row.category
                )}
              </TableCell>
              {metrics.map((metric) => (
                <TableCell key={metric.name}>
                  {renderCell(row, metric)}
                </TableCell>
              ))}
            </TableRow>
          ))}
          {renderAggregationRow()}
        </TableBody>
      </Table>
    </ScrollArea>
  );
}