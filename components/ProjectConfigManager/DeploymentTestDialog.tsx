import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertTriangle, CheckCircle, Info, FileText, Settings, Zap, Shield, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { DeploymentValidationReport } from '@/services/deployment-validator';
import { DeploymentResult } from '@/types/project-config';

interface DeploymentTestDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProceedWithDeployment: () => void;
  validationReport: DeploymentValidationReport | null;
  simulationResult: DeploymentResult | null;
  isLoading: boolean;
}

export const DeploymentTestDialog: React.FC<DeploymentTestDialogProps> = ({
  isOpen,
  onClose,
  onProceedWithDeployment,
  validationReport,
  simulationResult,
  isLoading
}) => {
  const [activeTab, setActiveTab] = useState<string>('validation');
  const getConfidenceLevel = () => {
    // Handle case where validationReport is null or undefined
    if (!validationReport) {
      return 0;
    }

    // Base confidence starts from validation results
    const baseConfidence = 0.7;
    
    // Factor in simulation results if available
    let simulationBonus = 0;
    if (simulationResult) {
      if (simulationResult.success) {
        simulationBonus = 15;
      } else {
        simulationBonus = -25; // Penalty for simulation failure
      }
    }

    // Factor in query testing results if enabled
    let queryTestingBonus = 0;
    if (simulationResult?.queryTestingEnabled) {
      // Check if query testing passed based on simulation result
      if (simulationResult.success && simulationResult.filesUpdated.length > 0) {
        queryTestingBonus = 10; // Bonus for successful query testing
      } else {
        queryTestingBonus = -30; // Major penalty for query testing failure
      }
    }

    // Calculate penalties only if validationReport.results exists and is an array
    let warningPenalty = 0;
    let errorPenalty = 0;
    let preDeploymentBonus = 0;

    if (validationReport.results && Array.isArray(validationReport.results)) {
      // Pre-deployment warnings are expected and shouldn't heavily penalize confidence
      const preDeploymentWarnings = validationReport.results.filter(r => 
        !r.passed && 
        r.test.severity === 'warning' && 
        (r.message.includes('will be generated during deployment') ||
         r.message.includes('will be populated during deployment') ||
         r.message.includes('will be completed during deployment'))
      ).length;
      
      const criticalWarnings = (validationReport.warnings || 0) - preDeploymentWarnings;
      warningPenalty = criticalWarnings * 3; // Reduced penalty for critical warnings
      errorPenalty = (validationReport.failed || 0) * 15;
      
      // Bonus for having a good simulation result and mostly pre-deployment warnings
      preDeploymentBonus = preDeploymentWarnings > 0 && criticalWarnings === 0 ? 5 : 0;
    } else {
      // If no detailed results, use basic penalties
      warningPenalty = (validationReport.warnings || 0) * 3;
      errorPenalty = (validationReport.failed || 0) * 15;
    }
    
    return Math.max(0, Math.min(100, baseConfidence + simulationBonus + queryTestingBonus + preDeploymentBonus - warningPenalty - errorPenalty));
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 85) return 'text-green-600';
    if (confidence >= 70) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 90) return 'Very High';
    if (confidence >= 80) return 'High';
    if (confidence >= 70) return 'Medium';
    if (confidence >= 60) return 'Low';
    return 'Very Low';
  };

  const getRecommendationIcon = () => {
    if (!validationReport) return <Clock className="h-5 w-5" />;
    if (validationReport.recommendDeployment) return <CheckCircle className="h-5 w-5 text-green-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  const getRecommendationColor = () => {
    if (!validationReport) return 'bg-gray-100';
    if (validationReport.recommendDeployment) return 'bg-green-50 border-green-200';
    return 'bg-red-50 border-red-200';
  };

  const confidence = getConfidenceLevel();

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl bg-white" style={{ backgroundColor: 'white' }}>
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-blue-600" />
              <span>Running Deployment Tests...</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Progress value={33} className="flex-1" />
              <span className="text-xs text-gray-600">Validating configuration...</span>
            </div>
            <div className="text-center text-gray-600">
              <p>Running comprehensive validation tests</p>
              <p className="text-xs">This may take a few seconds...</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white" style={{ backgroundColor: 'white' }}>
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span>Deployment Test Results</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Overall Status Card */}
          <Card className={`border-2 ${getRecommendationColor()}`}>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {getRecommendationIcon()}
                  <span>Deployment Recommendation</span>
                </div>
                <Badge 
                  variant={validationReport?.recommendDeployment ? "default" : "destructive"}
                  className="text-xs"
                >
                  {validationReport?.recommendDeployment ? "READY TO DEPLOY" : "DO NOT DEPLOY"}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Confidence Level</span>
                    <span className={`text-xs font-bold ${getConfidenceColor(confidence)}`}>
                      {confidence.toFixed(0)}%
                    </span>
                  </div>
                  <Progress value={confidence} className="mt-1" />
                  <p className={`text-xs mt-1 ${getConfidenceColor(confidence)}`}>
                    {getConfidenceLabel(confidence)} Confidence
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span>Tests Passed:</span>
                    <span className="font-medium text-green-600">{validationReport?.passed || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Warnings:</span>
                    <span className="font-medium text-yellow-600">{validationReport?.warnings || 0}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span>Failures:</span>
                    <span className="font-medium text-red-600">{validationReport?.failed || 0}</span>
                  </div>
                </div>
              </div>
              
              {validationReport?.summary && (
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>{validationReport.summary}</AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Detailed Results Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="validation" className="flex items-center space-x-1">
                <Settings className="h-4 w-4" />
                <span>Validation Tests</span>
              </TabsTrigger>
              <TabsTrigger value="queries" className="flex items-center space-x-1">
                <Zap className="h-4 w-4" />
                <span>Query Testing</span>
              </TabsTrigger>
              <TabsTrigger value="simulation" className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Simulation Results</span>
              </TabsTrigger>
              <TabsTrigger value="files" className="flex items-center space-x-1">
                <FileText className="h-4 w-4" />
                <span>Files to Update</span>
              </TabsTrigger>
            </TabsList>

            {/* Validation Tests Tab */}
            <TabsContent value="validation" className="space-y-3">
              <div className="grid gap-3 max-h-96 overflow-y-auto">
                {validationReport?.results && validationReport.results.length > 0 ? (
                  validationReport.results.map((result, index) => (
                    <Card key={index} className={`border-l-4 ${
                      result.passed 
                        ? 'border-l-green-500 bg-green-50' 
                        : result.test.severity === 'error' 
                          ? 'border-l-red-500 bg-red-50' 
                          : 'border-l-yellow-500 bg-yellow-50'
                    }`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start space-x-3">
                            {result.passed ? (
                              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                            ) : result.test.severity === 'error' ? (
                              <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
                            ) : (
                              <Info className="h-5 w-5 text-yellow-600 mt-0.5" />
                            )}
                            <div>
                              <h4 className="font-medium">{result.test.name}</h4>
                              <p className="text-xs text-gray-600 mt-1">{result.message}</p>
                              {result.details && (
                                <p className="text-xs text-gray-500 mt-2 bg-gray-100 p-2 rounded">
                                  {result.details}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex flex-col items-end space-y-1">
                            <Badge 
                              variant={result.test.severity === 'error' ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {result.test.category}
                            </Badge>
                            {result.autoFixAvailable && (
                              <Badge variant="outline" className="text-xs">
                                Auto-fixable
                              </Badge>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <div className="text-center text-gray-500 py-8">
                    <CheckCircle className="h-12 w-12 mx-auto mb-4 text-green-300" />
                    <p>No validation issues found</p>
                    <p className="text-xs">Configuration validation passed successfully</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Query Testing Tab */}
            <TabsContent value="queries" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <span>Query Testing Pipeline Results</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {simulationResult?.queryTestingEnabled ? (
                    <>
                      {/* Pipeline Health Report */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs">Total Tests:</span>
                            <span className="font-medium">{simulationResult.queryTestResults?.totalTests || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Tests Passed:</span>
                            <span className="font-medium text-green-600">{simulationResult.queryTestResults?.passed || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Tests Failed:</span>
                            <span className="font-medium text-red-600">{simulationResult.queryTestResults?.failed || 0}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Critical Tests:</span>
                            <Badge variant={simulationResult.queryTestResults?.criticalTestsPassed ? "default" : "destructive"}>
                              {simulationResult.queryTestResults?.criticalTestsPassed ? "PASSED" : "FAILED"}
                            </Badge>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-xs">Success Rate:</span>
                            <span className={`font-medium ${
                              (simulationResult.queryTestResults?.overallSuccessRate || 0) >= 70 ? 'text-green-600' : 
                              (simulationResult.queryTestResults?.overallSuccessRate || 0) >= 50 ? 'text-yellow-600' : 'text-red-600'
                            }`}>
                              {(simulationResult.queryTestResults?.overallSuccessRate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Field Parsing:</span>
                            <span className="font-medium">
                              {(simulationResult.queryTestResults?.pipelineHealthReport?.parsingSuccessRate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Classification:</span>
                            <span className="font-medium">
                              {(simulationResult.queryTestResults?.pipelineHealthReport?.classificationSuccessRate || 0).toFixed(1)}%
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs">Visualization:</span>
                            <span className="font-medium">
                              {(simulationResult.queryTestResults?.pipelineHealthReport?.visualizationSuccessRate || 0).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Progress bars for pipeline stages */}
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Field Parsing Stage</span>
                            <span>{(simulationResult.queryTestResults?.pipelineHealthReport?.parsingSuccessRate || 0).toFixed(1)}%</span>
                          </div>
                          <Progress value={simulationResult.queryTestResults?.pipelineHealthReport?.parsingSuccessRate || 0} />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Query Classification Stage</span>
                            <span>{(simulationResult.queryTestResults?.pipelineHealthReport?.classificationSuccessRate || 0).toFixed(1)}%</span>
                          </div>
                          <Progress value={simulationResult.queryTestResults?.pipelineHealthReport?.classificationSuccessRate || 0} />
                        </div>
                        <div>
                          <div className="flex justify-between text-xs mb-1">
                            <span>Visualization Pipeline Stage</span>
                            <span>{(simulationResult.queryTestResults?.pipelineHealthReport?.visualizationSuccessRate || 0).toFixed(1)}%</span>
                          </div>
                          <Progress value={simulationResult.queryTestResults?.pipelineHealthReport?.visualizationSuccessRate || 0} />
                        </div>
                      </div>

                      {/* Failed Tests Summary */}
                      {simulationResult.queryTestResults?.failedTests && simulationResult.queryTestResults.failedTests.length > 0 && (
                        <Alert>
                          <AlertTriangle className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Query Test Issues:</strong>
                            <div className="mt-2 space-y-1 text-xs max-h-32 overflow-y-auto">
                              {simulationResult.queryTestResults.failedTests.slice(0, 5).map((test, index) => (
                                <div key={index} className="flex justify-between">
                                  <span>&quot;{test.testQuery.query}&quot; failed at {test.pipelineStage} stage</span>
                                  <Badge variant="outline" className="text-xs">
                                    {test.testQuery.priority}
                                  </Badge>
                                </div>
                              ))}
                              {simulationResult.queryTestResults.failedTests.length > 5 && (
                                <p className="text-xs text-gray-500">
                                  ... and {simulationResult.queryTestResults.failedTests.length - 5} more
                                </p>
                              )}
                            </div>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Recommendations */}
                      {simulationResult.queryTestResults?.recommendations && simulationResult.queryTestResults.recommendations.length > 0 && (
                        <Alert>
                          <Info className="h-4 w-4" />
                          <AlertDescription>
                            <strong>Recommendations:</strong>
                            <ul className="mt-2 list-disc list-inside text-xs">
                              {simulationResult.queryTestResults.recommendations.slice(0, 3).map((rec, index) => (
                                <li key={index}>{rec}</li>
                              ))}
                            </ul>
                          </AlertDescription>
                        </Alert>
                      )}
                    </>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <Zap className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                      <p>Query testing not enabled for this deployment</p>
                      <p className="text-xs">Enable query testing in the unified deployment system</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Simulation Results Tab */}
            <TabsContent value="simulation" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Zap className="h-5 w-5 text-blue-600" />
                    <span>Deployment Simulation</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Simulation Status:</span>
                        <Badge variant={simulationResult?.success ? "default" : "destructive"}>
                          {simulationResult?.success ? "Success" : "Failed"}
                        </Badge>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Files to Update:</span>
                        <span className="font-medium">{simulationResult?.filesUpdated.length || 0}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Simulation Mode:</span>
                        <Badge variant="outline">
                          {simulationResult?.simulationMode ? "Safe Mode" : "Live Mode"}
                        </Badge>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-xs">Duration:</span>
                        <span className="font-medium">N/A</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Errors:</span>
                        <span className="font-medium text-red-600">
                          {simulationResult?.errors?.length || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-xs">Rollback Available:</span>
                        <Badge variant={simulationResult?.rollbackAvailable ? "default" : "secondary"}>
                          {simulationResult?.rollbackAvailable ? "Yes" : "No"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {simulationResult?.errors && simulationResult.errors.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <strong>Simulation Errors:</strong>
                        <ul className="mt-2 list-disc list-inside">
                          {simulationResult.errors.map((error, index) => (
                            <li key={index} className="text-xs">{error.toString()}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Files to Update Tab */}
            <TabsContent value="files" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span>Files That Will Be Updated</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 max-h-64 overflow-y-auto">
                      {simulationResult?.filesUpdated.map((file, index) => (
                        <div key={index} className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
                          <FileText className="h-4 w-4 text-gray-600" />
                          <div className="flex-1">
                            <p className="font-medium text-xs">{file}</p>
                            <p className="text-xs text-gray-500">
                              {file.includes('shap-microservice') ? 'Microservice File' : 
                               file.includes('config') ? 'Configuration File' :
                               file.includes('components') ? 'Component File' :
                               file.includes('services') ? 'Service File' :
                               file.includes('utils') ? 'Utility File' :
                               file.includes('adapters') ? 'Adapter File' : 'Project File'}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {file.includes('.ts') ? 'TypeScript' :
                             file.includes('.py') ? 'Python' :
                             file.includes('.json') ? 'JSON' :
                             file.includes('.md') ? 'Markdown' : 'File'}
                          </Badge>
                        </div>
                      ))}
                    </div>
                    
                    {simulationResult?.filesUpdated.length === 0 && (
                      <div className="text-center text-gray-500 py-8">
                        <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                        <p>No files would be updated</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="flex justify-between">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <div className="space-x-2">
            <Button 
              variant="outline" 
              onClick={() => {
                onClose();
                window.location.reload();
              }}
            >
              Re-run Tests
            </Button>
            <Button 
              onClick={onProceedWithDeployment}
              disabled={!validationReport?.recommendDeployment}
              className={validationReport?.recommendDeployment ? 
                "bg-green-600 hover:bg-green-700" : 
                "bg-gray-400 cursor-not-allowed"
              }
            >
              {validationReport?.recommendDeployment ? "Deploy Now" : "Fix Issues First"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 