import React from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  CheckCircle, 
  XCircle, 
  AlertTriangle, 
  FileText,
  Settings,
  Database,
  Loader2
} from 'lucide-react';
import { DeploymentResult } from '@/types/project-config';

interface DeploymentResultsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  deploymentResult: DeploymentResult | null;
  isLoading: boolean;
}

export const DeploymentResultsDialog: React.FC<DeploymentResultsDialogProps> = ({
  isOpen,
  onClose,
  deploymentResult,
  isLoading
}) => {
  const renderLoadingState = () => (
    <div className="flex flex-col items-center justify-center py-8 space-y-4">
      <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      <div className="text-center">
        <h3 className="text-xs font-semibold">Deploying Configuration...</h3>
        <p className="text-xs text-gray-600">
          Updating layer configurations, field mappings, and microservice files
        </p>
      </div>
    </div>
  );

  const renderResultsOverview = () => {
    if (!deploymentResult) return null;

    const { success, filesUpdated, errors, warnings } = deploymentResult;

    return (
      <div className="space-y-4">
        {/* Overall Status */}
        <Alert className={success ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'}>
          {success ? (
            <CheckCircle className="h-4 w-4 text-green-600" />
          ) : (
            <XCircle className="h-4 w-4 text-red-600" />
          )}
          <AlertDescription className={success ? 'text-green-800' : 'text-red-800'}>
            {success 
              ? `✅ Deployment completed successfully! ${filesUpdated.length} files updated.`
              : `❌ Deployment failed with ${errors.length} error${errors.length > 1 ? 's' : ''}.`
            }
          </AlertDescription>
        </Alert>

        {/* Files Updated */}
        {filesUpdated.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs">
                <FileText className="h-4 w-4" />
                Files Updated ({filesUpdated.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {filesUpdated.map((file, index) => (
                    <div key={index} className="flex items-center gap-2 text-xs">
                      <div className="w-2 h-2 bg-green-500 rounded-full" />
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded">
                        {file}
                      </code>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Microservice Impact */}
        {filesUpdated.some(file => file.includes('microservice') || file.includes('shap-')) && (
          <Alert className="border-blue-200 bg-blue-50">
            <Database className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              <strong>Microservice files were updated.</strong> You&apos;ll need to redeploy your microservice 
              (e.g., SHAP service on Render) to apply the new field mappings and configurations.
            </AlertDescription>
          </Alert>
        )}

        {/* Warnings */}
        {warnings && warnings.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs text-yellow-700">
                <AlertTriangle className="h-4 w-4" />
                Warnings ({warnings.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-24">
                <div className="space-y-2">
                  {warnings.map((warning, index) => (
                    <div key={index} className="text-xs text-yellow-700">
                      • {warning}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Errors */}
        {errors.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs text-red-700">
                <XCircle className="h-4 w-4" />
                Errors ({errors.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-32">
                <div className="space-y-2">
                  {errors.map((error, index) => (
                    <div key={index} className="text-xs text-red-700">
                      <strong>{error.file}:</strong> {error.error}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Deployment Summary */}
        {success && (
          <Card className="border-green-200">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-xs text-green-700">
                <CheckCircle className="h-4 w-4" />
                Deployment Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2">
              <div className="flex justify-between">
                <span>Configuration files:</span>
                <Badge variant="secondary">
                  {filesUpdated.filter(f => f.includes('config/')).length} updated
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Utility files:</span>
                <Badge variant="secondary">
                  {filesUpdated.filter(f => f.includes('utils/')).length} updated
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Adapter files:</span>
                <Badge variant="secondary">
                  {filesUpdated.filter(f => f.includes('adapters/')).length} updated
                </Badge>
              </div>
              <div className="flex justify-between">
                <span>Microservice files:</span>
                <Badge variant="secondary">
                  {filesUpdated.filter(f => f.includes('microservice') || f.includes('shap-')).length} updated
                </Badge>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Deployment Results
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full pr-4">
            {isLoading ? renderLoadingState() : renderResultsOverview()}
          </ScrollArea>
        </div>
        
        <DialogFooter>
          <Button onClick={onClose} variant="outline">
            Close
          </Button>
          {deploymentResult?.success && (
            <Button 
              onClick={onClose}
              className="bg-green-600 hover:bg-green-700"
            >
              Continue
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}; 