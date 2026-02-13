import React, { useState, useMemo } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Grid, Card, CardMedia, CardContent, Typography, TextField, MenuItem, Select, InputLabel, FormControl, GridProps } from '@mui/material';
import mpiqPin2Logo from '../public/mpiq_pin2.png'; // Import the logo
import Image from 'next/image';
import { FileSpreadsheet, Target, TrendingUp, Users, BarChart3, Zap, Shield } from 'lucide-react'; // Import the icon

// Redefine DisplayReport interface here for simplicity
interface DisplayReport {
  id: string;
  title: string;
  description: string;
  thumbnail: string; 
  icon?: React.ElementType; 
  categories: string[]; // New: array of categories
  type?: string;
}

interface ReportSelectionDialogProps {
  open: boolean;
  reports: DisplayReport[];
  onClose: () => void;
  onSelect: (reportId: string) => void;
}

const ReportSelectionDialog: React.FC<ReportSelectionDialogProps & GridProps> = ({ open, reports, onClose, onSelect, ...gridProps }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  // Dynamically get categories from reports (handling array)
  const availableCategories = useMemo(() => {
    const categories = new Set<string>();
    reports.forEach(report => {
      (report.categories || ['Other']).forEach(category => {
        // Explicitly exclude 'Custom' category if it somehow gets generated
        if (category !== 'Custom') {
          categories.add(category);
        }
      });
    });
    // Ensure 'Other' is added if no categories were found besides 'Custom'
    if (categories.size === 0 && reports.length > 0) {
      categories.add('Other');
    }
    return ['All', ...Array.from(categories).sort()];
  }, [reports]);

  // Filter reports based on search and selected category (handling array)
  const filteredReports = useMemo(() => {
      return reports
        .filter(report =>
          // Check if selectedCategory is 'All' OR if the report's categories array includes the selectedCategory
          (selectedCategory === 'All' || (report.categories || ['Other']).includes(selectedCategory)) &&
          report.title.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .sort((a, b) => a.title.localeCompare(b.title));
  }, [reports, selectedCategory, searchQuery]);

  // Reset category if it becomes invalid after reports change
  React.useEffect(() => {
    if (!availableCategories.includes(selectedCategory)) {
      setSelectedCategory('All');
    }
  }, [availableCategories, selectedCategory]);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Image 
            src={mpiqPin2Logo.src} 
            alt="Logo" 
            width={24} 
            height={24} 
            style={{ height: '24px' }} 
          />
          Select a Report
        </div>
      </DialogTitle>
      <DialogContent style={{ overflowY: 'auto', outline: 'none' }} tabIndex={0}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem', flexDirection: 'column' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '4px', color: '#33a852' }}>Search:</div>
              <TextField
                fullWidth
                size="small"
                value={searchQuery}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSearchQuery(e.target.value)}
                InputProps={{
                  style: { borderColor: '#33a852' },
                }}
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused': {
                    '& fieldset': {
                      borderColor: '#33a852',
                    },
                  },
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ marginBottom: '4px', color: '#33a852' }}>Category:</div>
              <FormControl
                fullWidth
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root.Mui-focused': {
                    '& fieldset': {
                      borderColor: '#33a852',
                    },
                  },
                }}
              >
                <Select
                  value={selectedCategory}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedCategory(e.target.value)}
                >
                  {/* Use dynamically generated categories */}
                  {availableCategories.map(category => (
                    <MenuItem key={category} value={category}>{category}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </div>
          </div>
        </div>
        <div style={{ 
          display: 'flex', 
          flexWrap: 'wrap',
          gap: '24px',
          justifyContent: 'center'
        }}>
          {filteredReports.map((report) => {
            const IconComponent = report.icon as React.ComponentType<any>; // Get the icon component
            return (
            <div key={report.id} style={{ 
              flex: '1 1 300px',
              maxWidth: '300px',
              display: 'flex',
              justifyContent: 'center'
            }}>
              <Card onClick={() => onSelect(report.id)} style={{ cursor: 'pointer', width: '100%' }}>
                {/* Updated Conditional Rendering: Thumbnail > Icon > Fallback */}
                <div style={{ height: 140, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f0f0' }}>
                  {/* Check for non-empty thumbnail string first */}
                  {report.thumbnail && typeof report.thumbnail === 'string' && report.thumbnail.trim() !== '' ? (
                    <CardMedia
                      component="img"
                      height="140"
                      image={report.thumbnail} // Use the thumbnail URL
                      alt={report.title}
                      style={{ objectFit: 'contain' }} // Keep image contained
                      // Add error handling for broken images
                      onError={(e: React.SyntheticEvent<HTMLImageElement, Event>) => {
                        // Option 1: Hide the image area
                        // e.currentTarget.style.display = 'none'; 
                        // Option 2: Replace with fallback icon (like below)
                        e.currentTarget.onerror = null; // Prevent infinite loop
                        e.currentTarget.parentElement?.classList.add('render-fallback-icon'); // Add class to parent
                        e.currentTarget.remove(); // Remove broken img
                      }}
                    />
                  ) : IconComponent ? ( // Else, if IconComponent exists
                    <IconComponent style={{ width: 64, height: 64, color: '#666' }} />
                  ) : ( // Else, render default fallback icon
                     <FileSpreadsheet style={{ width: 64, height: 64, color: '#ccc' }} />
                  )}
                  {/* Render fallback icon via CSS if onError is triggered */}
                  {IconComponent && <IconComponent 
                    className="fallback-icon-rendered-via-css" 
                    style={{ display: 'none', width: 64, height: 64, color: '#ccc'}} 
                  /> }
                  {!IconComponent && <FileSpreadsheet 
                     className="fallback-icon-rendered-via-css" 
                     style={{ display: 'none', width: 64, height: 64, color: '#ccc'}}
                  />}
                </div>
                 {/* Add CSS to show fallback icon when parent has class */}
                 <style>{`
                    .render-fallback-icon .fallback-icon-rendered-via-css {
                       display: block !important;
                    }
                 `}</style>
                <CardContent style={{ overflow: 'hidden' }}>
                  <Typography
                    variant="body2"
                    component="div"
                    title={report.title}
                    sx={{
                      fontWeight: 'bold',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      paddingTop: '20px',
                      fontSize: '0.875rem'
                    }}
                  >
                    {report.title}
                  </Typography>
                </CardContent>
              </Card>
            </div>
            );
          })}
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} style={{ color: '#33a852' }}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default ReportSelectionDialog;
