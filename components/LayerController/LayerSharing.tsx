import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { Share, Close, ContentCopy } from '@mui/icons-material';
import { LayerConfig } from '@/types/layers';
import { LayerErrorHandler } from '@/utils/layer-error-handler';

interface LayerSharingProps {
  layer: LayerConfig;
  onClose: () => void;
}

interface ShareSettings {
  allowEdit: boolean;
  allowDownload: boolean;
  allowShare: boolean;
  expirationDate?: Date;
  password?: string;
}

export const LayerSharing: React.FC<LayerSharingProps> = ({ layer, onClose }) => {
  const [shareUrl, setShareUrl] = useState<string>('');
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [shareSettings, setShareSettings] = useState<ShareSettings>({
    allowEdit: false,
    allowDownload: true,
    allowShare: false
  });
  const errorHandler = LayerErrorHandler.getInstance();

  const generateShareUrl = async () => {
    try {
      // In a real implementation, this would call an API to generate a shareable URL
      const baseUrl = window.location.origin;
      const shareId = Math.random().toString(36).substring(2, 15);
      const url = `${baseUrl}/share/${shareId}`;
      setShareUrl(url);
      setShowShareDialog(true);
    } catch (error) {
      errorHandler.handleValidationError('sharing', error);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch (error) {
      errorHandler.handleValidationError('clipboard', error);
    }
  };

  const handleSettingsChange = (setting: keyof ShareSettings) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setShareSettings((prev: ShareSettings) => ({
      ...prev,
      [setting]: event.target.checked
    }));
  };

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Share /> Share Layer: {layer.name}
        </Typography>
        <IconButton onClick={onClose} size="small">
          <Close />
        </IconButton>
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Share Settings
        </Typography>
        <FormControlLabel
          control={
            <Switch
              checked={shareSettings.allowEdit}
              onChange={handleSettingsChange('allowEdit')}
            />
          }
          label="Allow Editing"
        />
        <FormControlLabel
          control={
            <Switch
              checked={shareSettings.allowDownload}
              onChange={handleSettingsChange('allowDownload')}
            />
          }
          label="Allow Download"
        />
        <FormControlLabel
          control={
            <Switch
              checked={shareSettings.allowShare}
              onChange={handleSettingsChange('allowShare')}
            />
          }
          label="Allow Further Sharing"
        />
      </Box>

      <Box sx={{ mb: 3 }}>
        <Typography variant="subtitle1" gutterBottom>
          Access Control
        </Typography>
        <TextField
          fullWidth
          label="Password Protection"
          type="password"
          value={shareSettings.password || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setShareSettings((prev: ShareSettings) => ({ ...prev, password: e.target.value }))}
          margin="normal"
        />
      </Box>

      <Button
        variant="contained"
        startIcon={<Share />}
        onClick={generateShareUrl}
        fullWidth
      >
        Generate Share Link
      </Button>

      <Dialog open={showShareDialog} onClose={() => setShowShareDialog(false)}>
        <DialogTitle>Share Layer</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
            <TextField
              fullWidth
              value={shareUrl}
              InputProps={{ readOnly: true }}
            />
            <IconButton onClick={copyToClipboard} color="primary">
              <ContentCopy />
            </IconButton>
          </Box>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Share settings:
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {shareSettings.allowEdit && <Chip label="Edit" size="small" />}
              {shareSettings.allowDownload && <Chip label="Download" size="small" />}
              {shareSettings.allowShare && <Chip label="Share" size="small" />}
              {shareSettings.password && <Chip label="Password Protected" size="small" />}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowShareDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}; 