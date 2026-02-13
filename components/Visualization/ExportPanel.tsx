import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  TextField,
  FormControlLabel,
  Switch,
  Divider,
  Alert,
  Grid,
  SelectChangeEvent
} from '@mui/material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';
import { ExportManager, ExportConfig } from '@/utils/export-manager';

interface ExportPanelProps {
  layer: LayerConfig;
  onExport?: (blob: Blob) => void;
}

interface ExportTemplate extends ExportConfig {
  id: string;
  createdAt: string;
}

export const ExportPanel: React.FC<ExportPanelProps> = ({ layer, onExport }) => {
  const [config, setConfig] = useState<ExportConfig>({
    format: 'csv',
    includeMetadata: true,
    includeGeometry: true,
    includeAttributes: true,
    includeRenderer: true,
    includeTimeData: true,
    compression: false,
    filename: `${layer.name}_export`,
    description: layer.description
  });

  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const errorHandler = LayerErrorHandler.getInstance();
  const exportManager = ExportManager.getInstance();

  const loadTemplates = useCallback(async () => {
    try {
      const savedTemplates = await exportManager.loadExportTemplates();
      setTemplates(savedTemplates as ExportTemplate[]);
    } catch (err) {
      setError('Failed to load export templates');
    }
  }, [exportManager]);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  const handleConfigChange = (field: keyof ExportConfig) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent
  ) => {
    const value = 'checked' in event.target 
      ? (event.target as HTMLInputElement).checked 
      : event.target.value;
    
    setConfig((prev: any) => ({
      ...prev,
      [field]: value
    }));
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setError(null);

      const blob = await exportManager.exportLayer(layer, config);
      
      if (onExport) {
        onExport(blob);
      } else {
        // Create download link if no callback provided
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${config.filename}.${config.format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('export', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('An error occurred while exporting the layer');
      }
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveTemplate = async () => {
    try {
      await exportManager.saveExportTemplate(config);
      await loadTemplates();
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('export-template', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('An error occurred while saving the template');
      }
    }
  };

  const handleLoadTemplate = (template: ExportTemplate) => {
    const { id, createdAt, ...templateConfig } = template;
    setConfig(templateConfig);
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await exportManager.deleteExportTemplate(templateId);
      await loadTemplates();
    } catch (err) {
      const errorMessage = await errorHandler.handleValidationError('export-template', err);
      if (typeof errorMessage === 'string') {
        setError(errorMessage);
      } else {
        setError('An error occurred while deleting the template');
      }
    }
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Export Layer to CSV
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <TextField
          fullWidth
          label="Filename"
          value={config.filename}
          onChange={handleConfigChange('filename')}
          helperText="The exported file will be saved as a CSV"
        />

        <TextField
          fullWidth
          label="Description"
          value={config.description}
          onChange={handleConfigChange('description')}
          multiline
          rows={2}
        />

        <Divider />

        <Typography variant="subtitle1" gutterBottom>
          Export Options
        </Typography>

        <FormControlLabel
          control={
            <Switch
              checked={config.includeMetadata}
              onChange={handleConfigChange('includeMetadata')}
            />
          }
          label="Include Metadata"
        />

        <FormControlLabel
          control={
            <Switch
              checked={config.includeGeometry}
              onChange={handleConfigChange('includeGeometry')}
            />
          }
          label="Include Geometry"
        />

        <FormControlLabel
          control={
            <Switch
              checked={config.includeAttributes}
              onChange={handleConfigChange('includeAttributes')}
            />
          }
          label="Include Attributes"
        />

        <FormControlLabel
          control={
            <Switch
              checked={config.includeRenderer}
              onChange={handleConfigChange('includeRenderer')}
            />
          }
          label="Include Renderer"
        />

        <FormControlLabel
          control={
            <Switch
              checked={config.includeTimeData}
              onChange={handleConfigChange('includeTimeData')}
            />
          }
          label="Include Time Data"
        />

        <FormControlLabel
          control={
            <Switch
              checked={config.compression}
              onChange={handleConfigChange('compression')}
            />
          }
          label="Compress Export"
        />

        <Divider />

        <Typography variant="subtitle1" gutterBottom>
          Export Templates
        </Typography>

        {templates.length > 0 ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {templates.map((template) => (
              <Box key={template.id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Typography variant="body2" sx={{ flex: 1 }}>
                  {template.filename}
                </Typography>
                <Button
                  size="small"
                  onClick={() => handleLoadTemplate(template)}
                >
                  Load
                </Button>
                <Button
                  size="small"
                  color="error"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  Delete
                </Button>
              </Box>
            ))}
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            No saved templates
          </Typography>
        )}

        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          <Button
            variant="outlined"
            onClick={handleSaveTemplate}
            disabled={isExporting}
          >
            Save as Template
          </Button>
          <Button
            variant="contained"
            onClick={handleExport}
            disabled={isExporting}
          >
            {isExporting ? 'Exporting...' : 'Export to CSV'}
          </Button>
        </Box>
      </Box>
    </Paper>
  );
}; 