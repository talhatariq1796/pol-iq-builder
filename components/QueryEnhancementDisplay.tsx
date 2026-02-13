import React from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "./ui/badge";
import { Progress } from "@/components/ui/progress";

interface QueryOptimization {
  originalQuery: string;
  optimizedQuery: string;
  suggestedIndexes: string[];
  confidence: number;
  explanation: string;
  estimatedPerformanceGain: number;
}

interface SmartLayerSelection {
  primaryLayer: string;
  relatedLayers: string[];
  confidence: number;
  reasoning: string;
  suggestedJoins?: {
    sourceField: string;
    targetLayer: string;
    targetField: string;
  }[];
}

interface QueryResultsEnhancement {
  suggestedVisualizations: string[];
  relatedDataLayers: string[];
  filterSuggestions: {
    field: string;
    operator: string;
    value: any;
    confidence: number;
  }[];
  insightSummary: string;
}

interface QueryEnhancementDisplayProps {
  optimization?: QueryOptimization;
  layerSelection?: SmartLayerSelection;
  resultEnhancements?: QueryResultsEnhancement;
}

export const QueryEnhancementDisplay: React.FC<QueryEnhancementDisplayProps> = ({
  optimization,
  layerSelection,
  resultEnhancements
}) => {
  return (
    <div className="space-y-4">
      {/* Query Optimization Section */}
      {optimization && (
        <Card>
          <CardHeader>
            <CardTitle>Query Optimization</CardTitle>
            <CardDescription>
              Estimated performance gain: {(optimization.estimatedPerformanceGain * 100).toFixed(1)}%
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion>
              <AccordionItem value="original">
                <AccordionTrigger>Original Query</AccordionTrigger>
                <AccordionContent>
                  <pre className="bg-gray-100 p-2 rounded">
                    {optimization.originalQuery}
                  </pre>
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="optimized">
                <AccordionTrigger>Optimized Query</AccordionTrigger>
                <AccordionContent>
                  <pre className="bg-gray-100 p-2 rounded">
                    {optimization.optimizedQuery}
                  </pre>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Suggested Indexes</h4>
              <div className="flex flex-wrap gap-2">
                {optimization.suggestedIndexes.map((index, i) => (
                  <Badge key={i} variant="secondary">
                    {index}
                  </Badge>
                ))}
              </div>
            </div>
            <div className="mt-4">
              <h4 className="font-semibold mb-2">Confidence</h4>
              <Progress value={optimization.confidence * 100} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Layer Selection Section */}
      {layerSelection && (
        <Card>
          <CardHeader>
            <CardTitle>Smart Layer Selection</CardTitle>
            <CardDescription>
              Primary Layer: {layerSelection.primaryLayer}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Related Layers</h4>
                <div className="flex flex-wrap gap-2">
                  {layerSelection.relatedLayers.map((layer, i) => (
                    <Badge key={i} variant="outline">
                      {layer}
                    </Badge>
                  ))}
                </div>
              </div>
              {layerSelection.suggestedJoins && (
                <div>
                  <h4 className="font-semibold mb-2">Suggested Joins</h4>
                  <div className="space-y-2">
                    {layerSelection.suggestedJoins.map((join, i) => (
                      <div key={i} className="bg-gray-50 p-2 rounded">
                        {join.sourceField} → {join.targetLayer}.{join.targetField}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h4 className="font-semibold mb-2">Confidence</h4>
                <Progress value={layerSelection.confidence * 100} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results Enhancement Section */}
      {resultEnhancements && (
        <Card>
          <CardHeader>
            <CardTitle>Result Enhancements</CardTitle>
            <CardDescription>
              {resultEnhancements.insightSummary}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Suggested Visualizations</h4>
                <div className="flex flex-wrap gap-2">
                  {resultEnhancements.suggestedVisualizations.map((viz, i) => (
                    <Badge key={i} variant="default">
                      {viz}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Related Data Layers</h4>
                <div className="flex flex-wrap gap-2">
                  {resultEnhancements.relatedDataLayers.map((layer, i) => (
                    <Badge key={i} variant="outline">
                      {layer}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Suggested Filters</h4>
                <div className="space-y-2">
                  {resultEnhancements.filterSuggestions.map((filter, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Badge variant="secondary">{filter.field}</Badge>
                      <span>{filter.operator}</span>
                      <Badge>{filter.value}</Badge>
                      <Progress 
                        value={filter.confidence * 100}
                        className="w-24"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}; 