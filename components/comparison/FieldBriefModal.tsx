'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Download,
  Copy,
  Users,
  MessageSquare,
  MapPin,
  Loader2,
  CheckCircle2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { ComparisonEntity, BoundaryType } from '@/lib/comparison/types';
import type { FieldBrief, BriefFormat } from '@/lib/comparison/types-brief';

interface FieldBriefModalProps {
  isOpen: boolean;
  onClose: () => void;
  leftEntity: ComparisonEntity;
  rightEntity: ComparisonEntity;
  boundaryType: BoundaryType;
}

export function FieldBriefModal({
  isOpen,
  onClose,
  leftEntity,
  rightEntity,
  boundaryType,
}: FieldBriefModalProps) {
  const [activeTab, setActiveTab] = useState('summary');
  const [brief, setBrief] = useState<FieldBrief | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<BriefFormat>('markdown');
  const [copySuccess, setCopySuccess] = useState(false);
  const { toast } = useToast();

  // Generate brief when modal opens
  useEffect(() => {
    if (isOpen && !brief) {
      generateBrief();
    }
  }, [isOpen]);

  const generateBrief = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/comparison/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftEntity,
          rightEntity,
          boundaryType,
          options: {
            includeVoterProfiles: true,
            includeTalkingPoints: true,
            includeFieldOps: true,
            briefingLength: 'standard',
            audience: 'canvassers',
          },
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate field brief');
      }

      const data = await response.json();
      setBrief(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate brief');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (format: BriefFormat) => {
    if (!brief) return;

    try {
      const response = await fetch('/api/comparison/export-brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          brief,
          format,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to export brief');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const filename = `field-brief-${leftEntity.name}-vs-${rightEntity.name}.${format === 'markdown' ? 'md' : 'txt'}`;
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      // Show success toast
      toast({
        title: 'Export complete',
        description: `Downloaded field brief as ${format === 'markdown' ? 'Markdown' : 'plain text'}`,
      });
    } catch (err) {
      console.error('Export failed:', err);
      toast({
        title: 'Export failed',
        description: 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const handleCopyToClipboard = async () => {
    if (!brief) return;

    try {
      const text = formatBriefAsText(brief);
      await navigator.clipboard.writeText(text);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const formatBriefAsText = (b: FieldBrief): string => {
    return `
FIELD BRIEF: ${b.profiles.left.name} vs ${b.profiles.right.name}

EXECUTIVE SUMMARY
${b.summary}

LEFT AREA: ${b.profiles.left.name}
- Partisan Lean: ${b.profiles.left.partisanLean}
- Population: ${b.profiles.left.population.toLocaleString()}
- Median Income: $${b.profiles.left.medianIncome.toLocaleString()}
- College Educated: ${b.profiles.left.collegePct}%
- Strategy: ${b.profiles.left.strategy}
- Competitiveness: ${b.profiles.left.competitiveness}

RIGHT AREA: ${b.profiles.right.name}
- Partisan Lean: ${b.profiles.right.partisanLean}
- Population: ${b.profiles.right.population.toLocaleString()}
- Median Income: $${b.profiles.right.medianIncome.toLocaleString()}
- College Educated: ${b.profiles.right.collegePct}%
- Strategy: ${b.profiles.right.strategy}
- Competitiveness: ${b.profiles.right.competitiveness}

KEY DIFFERENCES
${b.profiles.keyDifferences.map((d) => `- ${d.metric}: ${d.leftValue} vs ${d.rightValue} → ${d.implication}`).join('\n')}

TALKING POINTS - ${b.talkingPoints.left.areaName}
Top Issues:
${b.talkingPoints.left.topIssues.map((i) => `  - ${i}`).join('\n')}
Key Messages:
${b.talkingPoints.left.keyMessages.map((m) => `  - ${m}`).join('\n')}

TALKING POINTS - ${b.talkingPoints.right.areaName}
Top Issues:
${b.talkingPoints.right.topIssues.map((i) => `  - ${i}`).join('\n')}
Key Messages:
${b.talkingPoints.right.keyMessages.map((m) => `  - ${m}`).join('\n')}

VOTER PROFILES
${b.voterProfiles.left.areaName}:
- Dominant Segment: ${b.voterProfiles.left.dominantSegment}
- Lifestyle: ${b.voterProfiles.left.lifestyleDescription}
- Occupations: ${b.voterProfiles.left.typicalOccupations.join(', ')}
- Media Habits: ${b.voterProfiles.left.mediaHabits.join(', ')}
- Values: ${b.voterProfiles.left.valuesAndPriorities.join(', ')}

${b.voterProfiles.right.areaName}:
- Dominant Segment: ${b.voterProfiles.right.dominantSegment}
- Lifestyle: ${b.voterProfiles.right.lifestyleDescription}
- Occupations: ${b.voterProfiles.right.typicalOccupations.join(', ')}
- Media Habits: ${b.voterProfiles.right.mediaHabits.join(', ')}
- Values: ${b.voterProfiles.right.valuesAndPriorities.join(', ')}

FIELD OPERATIONS
${b.fieldOps.left.areaName}:
- Doors Per Hour: ${b.fieldOps.left.doorsPerHour}
- Best Times: ${b.fieldOps.left.bestTimes.join(', ')}
- Density: ${b.fieldOps.left.density}
- Parking: ${b.fieldOps.left.parkingNotes}
- Safety: ${b.fieldOps.left.safetyNotes}

${b.fieldOps.right.areaName}:
- Doors Per Hour: ${b.fieldOps.right.doorsPerHour}
- Best Times: ${b.fieldOps.right.bestTimes.join(', ')}
- Density: ${b.fieldOps.right.density}
- Parking: ${b.fieldOps.right.parkingNotes}
- Safety: ${b.fieldOps.right.safetyNotes}

Generated: ${new Date(b.metadata.generated).toLocaleString()}
    `.trim();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-xl flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Field Brief: {leftEntity.name} vs {rightEntity.name}
          </DialogTitle>
          <DialogDescription>
            Canvasser briefing comparing two {boundaryType.replace('_', ' ')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between px-6 pb-4 border-b">
          <div className="flex items-center gap-2">
            <Select
              value={exportFormat}
              onValueChange={(value) => setExportFormat(value as BriefFormat)}
            >
              <SelectTrigger className="w-[140px] h-9">
                <SelectValue placeholder="Format" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="markdown">Markdown</SelectItem>
                <SelectItem value="text">Plain Text</SelectItem>
              </SelectContent>
            </Select>

            <Button
              onClick={() => handleExport(exportFormat)}
              disabled={!brief || isLoading}
              variant="outline"
              size="sm"
            >
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>

            <Button
              onClick={handleCopyToClipboard}
              disabled={!brief || isLoading}
              variant="outline"
              size="sm"
            >
              {copySuccess ? (
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              {copySuccess ? 'Copied!' : 'Copy'}
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating brief...
            </div>
          )}
        </div>

        <ScrollArea className="flex-1 px-6">
          {error && (
            <div className="p-4 mb-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {isLoading && !brief && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
              <p className="text-sm text-muted-foreground">
                Generating field brief with AI analysis...
              </p>
            </div>
          )}

          {brief && (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="w-full justify-start border-b mb-4">
                <TabsTrigger value="summary" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Summary
                </TabsTrigger>
                <TabsTrigger value="talking-points" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Talking Points
                </TabsTrigger>
                <TabsTrigger value="voter-profiles" className="gap-2">
                  <Users className="h-4 w-4" />
                  Voter Profiles
                </TabsTrigger>
                <TabsTrigger value="field-ops" className="gap-2">
                  <MapPin className="h-4 w-4" />
                  Field Operations
                </TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Executive Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {brief.summary}
                    </p>
                  </CardContent>
                </Card>

                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{brief.profiles.left.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partisan Lean:</span>
                        <span className="font-medium">{brief.profiles.left.partisanLean}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Population:</span>
                        <span className="font-medium">
                          {brief.profiles.left.population.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Median Income:</span>
                        <span className="font-medium">
                          ${brief.profiles.left.medianIncome.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">College Educated:</span>
                        <span className="font-medium">{brief.profiles.left.collegePct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span className="font-medium">{brief.profiles.left.strategy}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">{brief.profiles.right.name}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Partisan Lean:</span>
                        <span className="font-medium">{brief.profiles.right.partisanLean}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Population:</span>
                        <span className="font-medium">
                          {brief.profiles.right.population.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Median Income:</span>
                        <span className="font-medium">
                          ${brief.profiles.right.medianIncome.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">College Educated:</span>
                        <span className="font-medium">{brief.profiles.right.collegePct}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strategy:</span>
                        <span className="font-medium">{brief.profiles.right.strategy}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Key Differences</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {brief.profiles.keyDifferences.map((diff, idx) => (
                        <div key={idx} className="text-sm">
                          <div className="font-medium text-foreground mb-1">{diff.metric}</div>
                          <div className="text-muted-foreground text-xs">
                            {diff.leftValue} vs {diff.rightValue}
                          </div>
                          <div className="text-xs text-muted-foreground italic mt-1">
                            → {diff.implication}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="talking-points" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.talkingPoints.left.areaName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Top Issues</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.left.topIssues.map((issue, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Key Messages</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.left.keyMessages.map((msg, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{msg}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Connection Points</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.left.connectionPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {brief.talkingPoints.left.avoidTopics.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-red-600">
                            Topics to Avoid
                          </h4>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {brief.talkingPoints.left.avoidTopics.map((topic, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.talkingPoints.right.areaName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Top Issues</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.right.topIssues.map((issue, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{issue}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Key Messages</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.right.keyMessages.map((msg, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{msg}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Connection Points</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.talkingPoints.right.connectionPoints.map((point, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{point}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {brief.talkingPoints.right.avoidTopics.length > 0 && (
                        <div>
                          <h4 className="text-xs font-semibold mb-2 text-red-600">
                            Topics to Avoid
                          </h4>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {brief.talkingPoints.right.avoidTopics.map((topic, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-red-500 mt-0.5">•</span>
                                <span>{topic}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="voter-profiles" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.voterProfiles.left.areaName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Dominant Segment: {brief.voterProfiles.left.dominantSegment}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Lifestyle Description</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.voterProfiles.left.lifestyleDescription}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Typical Occupations</h4>
                        <div className="flex flex-wrap gap-1">
                          {brief.voterProfiles.left.typicalOccupations.map((occ, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                            >
                              {occ}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Media Habits</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.voterProfiles.left.mediaHabits.map((habit, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{habit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Values & Priorities</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.voterProfiles.left.valuesAndPriorities.map((value, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.voterProfiles.right.areaName}
                      </CardTitle>
                      <p className="text-xs text-muted-foreground">
                        Dominant Segment: {brief.voterProfiles.right.dominantSegment}
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="text-xs font-semibold mb-2">Lifestyle Description</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.voterProfiles.right.lifestyleDescription}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Typical Occupations</h4>
                        <div className="flex flex-wrap gap-1">
                          {brief.voterProfiles.right.typicalOccupations.map((occ, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 bg-secondary text-secondary-foreground rounded text-xs"
                            >
                              {occ}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Media Habits</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.voterProfiles.right.mediaHabits.map((habit, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{habit}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Values & Priorities</h4>
                        <ul className="space-y-1 text-xs text-muted-foreground">
                          {brief.voterProfiles.right.valuesAndPriorities.map((value, idx) => (
                            <li key={idx} className="flex items-start gap-2">
                              <span className="text-primary mt-0.5">•</span>
                              <span>{value}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="field-ops" className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.fieldOps.left.areaName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Doors Per Hour:</span>
                        <span className="font-semibold text-lg">
                          {brief.fieldOps.left.doorsPerHour}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Density</h4>
                        <span className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs capitalize">
                          {brief.fieldOps.left.density}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Best Times to Canvass</h4>
                        <div className="flex flex-wrap gap-1">
                          {brief.fieldOps.left.bestTimes.map((time, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                            >
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Parking Notes</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.fieldOps.left.parkingNotes}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Safety Considerations</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.fieldOps.left.safetyNotes}
                        </p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">
                        {brief.fieldOps.right.areaName}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Doors Per Hour:</span>
                        <span className="font-semibold text-lg">
                          {brief.fieldOps.right.doorsPerHour}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Density</h4>
                        <span className="inline-block px-3 py-1 bg-secondary text-secondary-foreground rounded-full text-xs capitalize">
                          {brief.fieldOps.right.density}
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Best Times to Canvass</h4>
                        <div className="flex flex-wrap gap-1">
                          {brief.fieldOps.right.bestTimes.map((time, idx) => (
                            <span
                              key={idx}
                              className="inline-block px-2 py-1 bg-primary/10 text-primary rounded text-xs"
                            >
                              {time}
                            </span>
                          ))}
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Parking Notes</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.fieldOps.right.parkingNotes}
                        </p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold mb-2">Safety Considerations</h4>
                        <p className="text-xs text-muted-foreground">
                          {brief.fieldOps.right.safetyNotes}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Generated</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {new Date(brief.metadata.generated).toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
