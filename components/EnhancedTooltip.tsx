import React from 'react';
import {
  Tooltip as MuiTooltip,
  TooltipProps as MuiTooltipProps,
  styled,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { TransitionProps } from '@mui/material/transitions';
import Zoom from '@mui/material/Zoom';

interface EnhancedTooltipProps {
  children: React.ReactElement;
  content: React.ReactNode;
  maxWidth?: number;
  showArrow?: boolean;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  interactive?: boolean;
  followCursor?: boolean;
  enterDelay?: number;
  leaveDelay?: number;
  disableTouchListener?: boolean;
  disableFocusListener?: boolean;
  disableHoverListener?: boolean;
  PopperProps?: MuiTooltipProps['PopperProps'];
}

const StyledTooltip = styled(MuiTooltip)(({ theme }) => ({
  '& .MuiTooltip-tooltip': {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
    boxShadow: theme.shadows[3],
    fontSize: theme.typography.body2.fontSize,
    border: `1px solid ${theme.palette.divider}`,
    padding: theme.spacing(1.5),
    maxWidth: 'none',
    '& .MuiTooltip-arrow': {
      color: theme.palette.background.paper,
      '&::before': {
        border: `1px solid ${theme.palette.divider}`
      }
    }
  }
}));

export const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  children,
  content,
  maxWidth = 300,
  showArrow = true,
  placement = 'top',
  delay = 0,
  interactive = false,
  followCursor = false,
  enterDelay = 200,
  leaveDelay = 0,
  disableTouchListener = false,
  disableFocusListener = false,
  disableHoverListener = false,
  PopperProps,
  ...props
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Adjust tooltip behavior for mobile
  const mobileProps = isMobile ? {
    disableTouchListener: true,
    enterDelay: 0,
    leaveDelay: 0,
    interactive: true
  } : {};

  return (
    <StyledTooltip
      title={content}
      arrow={showArrow}
      placement={placement}
      TransitionComponent={Zoom}
      followCursor={followCursor}
      enterDelay={enterDelay + delay}
      leaveDelay={leaveDelay}
      disableTouchListener={disableTouchListener || isMobile}
      disableFocusListener={disableFocusListener}
      disableHoverListener={disableHoverListener}
      interactive={interactive}
      PopperProps={{
        ...PopperProps,
        style: {
          ...PopperProps?.style,
          maxWidth
        }
      }}
      {...mobileProps}
      {...props}
    >
      {children}
    </StyledTooltip>
  );
}; 