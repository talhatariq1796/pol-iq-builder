/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { fetchReports } from '@/services/ReportsService';
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin, Car, UserIcon, RotateCcw, ChevronRight, AlertCircle, AlertTriangle } from 'lucide-react';
import { useDrawing } from '@/hooks/useDrawing';
import Circle from "@arcgis/core/geometry/Circle";
import Graphic from "@arcgis/core/Graphic";
import SimpleFillSymbol from "@arcgis/core/symbols/SimpleFillSymbol";
import * as serviceArea from "@arcgis/core/rest/serviceArea";
import ServiceAreaParameters from "@arcgis/core/rest/support/ServiceAreaParameters";
import FeatureSet from "@arcgis/core/rest/support/FeatureSet";
import esriConfig from "@arcgis/core/config";
import Infographics from '../Infographics';
import EndpointScoringReport from '../EndpointScoringReport';
import DrawingTools from './DrawingTools';
import { Alert, AlertDescription } from '../ui/alert';
import * as projection from "@arcgis/core/geometry/projection";
import ReportSelectionDialog from '../ReportSelectionDialog';
import Polygon from "@arcgis/core/geometry/Polygon";
import Point from "@arcgis/core/geometry/Point";
import * as geometryEngine from "@arcgis/core/geometry/geometryEngine";

// Debug utility for consistent logging
const debugLog = (category: string, message: string, data?: any) => {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  const prefix = `[${timestamp}][${category}]`;
  
  if (data) {
    console.log(`${prefix} ${message}`, data);
  } else {
    console.log(`${prefix} ${message}`);
  }
};

// Initialize the API key
esriConfig.apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY || '';

type DrawMode = 'point' | 'polygon' | 'click';
type Step = 'draw' | 'buffer' | 'report';

interface InfographicsTabProps {
  view: __esri.MapView;
  layerStates: { [key: string]: { layer: __esri.FeatureLayer | null } };
  exportToPDF?: () => void;
  showLoading?: boolean;
  onLayerStatesChange?: (states: { [key: string]: { layer: __esri.FeatureLayer | null } }) => void;
}



// Constants



// Define the type for reports
interface Report {
  id: string;
  title: string;
  description: string; // Ensure description is always a string
  thumbnail: string;
  categories: string[]; // New: array of categories
  type?: string; // Optional type property
}

export default function InfographicsTab({ 
  view, 
  layerStates, 
  exportToPDF}: InfographicsTabProps): JSX.Element {
  // Move all hooks to the top
  const STORAGE_KEY = 'infographics-tab-state';
  // REVERT Use the initializer function for activeStep
  const [activeStep, setActiveStep] = useState<Step>('draw');
  const [drawMode, setDrawMode] = useState<DrawMode | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [bufferType, setBufferType] = useState<'radius' | 'drivetime' | 'walktime'>('radius');
  const [bufferValue, setBufferValue] = useState('1');
  const [bufferUnit, setBufferUnit] = useState<'kilometers' | 'minutes'>('kilometers'); // Only kilometers and minutes allowed
  // Update default report template to null initially, fetch will set it
  const [reportTemplate, setReportTemplate] = useState<string | null>(null);
  const [geometry, setGeometry] = useState<__esri.Geometry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [hasSelection, setHasSelection] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reports, setReports] = useState<Report[]>([]);
  const isFetchingReports = useRef(false); // Add this ref
  // Track whether component has initialized
  const hasInitialized = useRef(false);
  // Add a ref to store the start time
  const mountTime = useRef(Date.now());
  // Add a counter for render cycles
  const renderCount = useRef(0);
  // Add a ref to store the last event
  const lastEvent = useRef<any>(null);
  // Add a ref to track forced navigation attempts
  const forceNavigationCount = useRef(0);
  // Add a ref to store geometry outside of React state
  const geometryRef = useRef<__esri.Geometry | null>(null);
  // Add a ref flag to signal navigation just happened from popup
  // const navigatedFromPopupRef = useRef(false);
  
  // Make refs globally accessible
  useEffect(() => {
    // Share the geometry ref
    (window as any).geometryRef = geometryRef;
    
    // Add a debounce flag to prevent multiple rapid calls
    const debounceFlag = { processing: false, lastCall: 0 };
    (window as any).geometrySetterDebounce = debounceFlag;
    
    // Share state setters for external access
    (window as any).__INFOGRAPHICS_STATE = {
      setGeometry,
      geometryRef,
      setHasSelection,
      setActiveStep,
      setIsSelectionMode
    };
    
    // Create a new ULTRA SIMPLE direct function to force to step 3
    // This should be the simplest possible implementation that always works
    (window as any).forceToStep3 = (geometry: __esri.Geometry) => {
      console.log(">>> forceToStep3 TRIGGERED", { geometryType: geometry?.type });
      console.log("🎯 DIRECT FORCE TO STEP 3", { geometryType: geometry?.type });
      
      // Force all related state in one go
      setGeometry(geometry);
      geometryRef.current = geometry;
      setHasSelection(true);
      setIsSelectionMode(false);
      setActiveStep('report');
      
      // Set storage flag to indicate we came from popup
      try {
        window.sessionStorage.setItem('popupTriggeredNavigation', 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          step: 'report',
          hasGeometry: true,
          timestamp: new Date().getTime()
        }));
      } catch (e) {
        console.error("Storage error:", e);
      }
      
      // Try to click the report button using DOM
      setTimeout(() => {
        try {
          const reportButton = document.querySelector('[data-step="report"]') as HTMLButtonElement;
          if (reportButton) {
            reportButton.click();
          }
        } catch (e) {
          console.warn("Button click error:", e);
        }
      }, 50);
      
      return true;
    };
    
    // Create a direct setter for geometry that forces step 3
    (window as any).setGeometryAndGoToReport = (featureGeometry: __esri.Geometry) => {
      console.log(">>> setGeometryAndGoToReport TRIGGERED", { geometryType: featureGeometry?.type });
      // Prevent multiple rapid calls (debounce)
      const now = Date.now();
      if (debounceFlag.processing || (now - debounceFlag.lastCall < 500)) {
        console.log('🛑 Geometry setter call debounced');
        return false;
      }
      
      // Set processing flag
      debounceFlag.processing = true;
      debounceFlag.lastCall = now;
      
      console.log('🚀 Direct geometry setter called with:', {
        type: featureGeometry.type,
        hasRings: !!(featureGeometry as any).rings,
        hasCoordinates: !!(featureGeometry as any).x && !!(featureGeometry as any).y
      });
      
      try {
        // Verify geometry before setting
        if (!featureGeometry) {
          console.error('🔴 setGeometryAndGoToReport: Feature geometry is null or undefined');
          return false;
        }
        
        console.log('🔵 BEFORE setting geometry state:', {
          currentGeometry: !!geometry,
          currentGeometryRef: !!geometryRef.current
        });
        
        // Store in both state and ref
        setGeometry(featureGeometry);
        geometryRef.current = featureGeometry;
        
        // Debug verification after setting
        console.log('🔵 AFTER setting geometry:', {
          geometryRef: !!geometryRef.current,
          geometryRefType: geometryRef.current?.type
        });
        
        // Set selection states
        setHasSelection(true);
        setIsSelectionMode(false);
        
        // Force to report step - JUST ONCE, no cascading calls
        setActiveStep('report');
        
        // Restore default buffer values
        setBufferType('radius');
        setBufferValue('1');
        setBufferUnit('kilometers'); // Changed default to kilometers for Canadian context
        
        // Update localStorage
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            step: 'report',
            hasGeometry: true,
            timestamp: Date.now()
          }));
        } catch (e) {
          // Ignore
        }
        
        console.log('⚠️ CHECK STATE AFTER SETTING:', {
          hasGeometryRef: !!geometryRef.current,
          geometryRefType: geometryRef.current?.type,
          hasSelection: true,
          isSelectionMode: false,
          step: 'report'
        });
        
        // Clear processing flag after a delay
        setTimeout(() => {
          debounceFlag.processing = false;
          
          // Double-check state after a delay
          console.log('⏱️ DELAYED STATE CHECK:', {
            hasGeometryRef: !!geometryRef.current,
            geometryRefType: geometryRef.current?.type,
            // Can't access state here due to closure
          });
        }, 500);
        
        return true;
      } catch (error) {
        console.error('Error in geometry setter:', error);
        debounceFlag.processing = false;
        return false;
      }
    };
    
    return () => {
      delete (window as any).geometryRef;
      delete (window as any).setGeometryAndGoToReport;
      delete (window as any).geometrySetterDebounce;
      delete (window as any).__INFOGRAPHICS_STATE;
      delete (window as any).forceToStep3;
    };
  }, []);
  
  // Forced navigation on mount
  useEffect(() => {
    console.log("🚀 InfographicsTab mounted");
    
    // Flag to prevent duplicate processing
    let buttonClickHandled = false;
    
    // Check localStorage for stored state
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const { step, hasGeometry, timestamp } = JSON.parse(stored);
        
        console.log("📝 Found stored state:", { step, hasGeometry, timestamp });
        
        // If we have a stored report step and it's recent, force to that step
        if (step === 'report' && hasGeometry) {
          // Check if it's recent (within last hour)
          const now = new Date().getTime();
          const oneHour = 60 * 60 * 1000;
          
          if (now - timestamp < oneHour) {
            console.log("⚡ Forcing to report step from localStorage");
            // Simple direct state setting - avoid complex chains
            setActiveStep('report');
          }
        }
      }
    } catch (error) {
      console.error("Error loading from localStorage:", error);
    }
    
    // Simplified global click handler with debounce
    const handleGlobalClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      
      // Only handle if not already processed and target has the right text
      if (!buttonClickHandled && target && 
          target.textContent?.includes('Generate Infographics')) {
        
        console.log("🔵 Detected click on Generate Infographics button");
        
        // Set flag to prevent duplicate processing
        buttonClickHandled = true;
        
        // Reset flag after 1 second
        setTimeout(() => {
          buttonClickHandled = false;
        }, 1000);
      }
    };
    
    // Add global click listener
    document.addEventListener('click', handleGlobalClick);
    
    return () => {
      document.removeEventListener('click', handleGlobalClick);
    };
  }, []);
  
  // SUPER AGGRESSIVE FIX: Add a global window function that can be called from anywhere
  useEffect(() => {
    // Create a global function to force navigation to report step
    (window as any).__forceToReportStep = () => {
      console.log("🚨 GLOBAL FORCE FUNCTION CALLED");
      
      // Update our ref
      forceNavigationCount.current += 1;
      
      // Direct state updates
      setActiveStep('report');
      
      // Update DOM directly if needed
      try {
        // Find the report step button and click it
        const reportButton = document.querySelector('[data-step="report"]') as HTMLButtonElement;
        if (reportButton) {
          console.log("🚨 Clicking report button directly");
          reportButton.click();
        }
        
        // Try to find the report content and make it visible
        const reportContent = document.querySelector('[data-stepcontent="report"]') as HTMLElement;
        if (reportContent) {
          console.log("🚨 Making report content visible directly");
          reportContent.style.display = 'block';
        }
        
        // Also directly update the step buttons styles
        const stepButtons = document.querySelectorAll('[data-step]');
        stepButtons.forEach((button: Element) => {
          if ((button as HTMLElement).dataset.step === 'report') {
            (button as HTMLElement).classList.add('bg-blue-50', 'text-blue-700', 'font-medium');
            (button as HTMLElement).classList.remove('bg-gray-50', 'text-gray-500');
          } else {
            (button as HTMLElement).classList.remove('bg-blue-50', 'text-blue-700', 'font-medium');
            (button as HTMLElement).classList.add('bg-gray-50', 'text-gray-500');
          }
        });
      } catch (error) {
        console.error("Error trying to manipulate DOM:", error);
      }
      
      // Force localStorage update
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          step: 'report',
          hasGeometry: true,
          timestamp: new Date().getTime()
        }));
      } catch (e) {
        // Ignore
      }
      
      return true; // Indicate success
    };
    
    // Add a global event listener that doesn't depend on React
    const globalListener = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.geometry) {
        console.log("🚨 GLOBAL EVENT LISTENER CAUGHT EVENT");
        geometryRef.current = customEvent.detail.geometry;
        
        // Call our global force function
        setTimeout(() => {
          (window as any).__forceToReportStep();
        }, 0);
      }
    };
    
    // Add the listener on window to catch all events
    window.addEventListener('openInfographics', globalListener);
    
    // Cleanup
    return () => {
      window.removeEventListener('openInfographics', globalListener);
      delete (window as any).__forceToReportStep;
    };
  }, []);

  // Add data attributes to help with DOM manipulation
  useEffect(() => {
    setTimeout(() => {
      try {
        // Add data attributes to step buttons for direct manipulation
        const stepButtons = document.querySelectorAll('.grid-cols-3 button');
        stepButtons.forEach((button: Element, index: number) => {
          const steps = ['draw', 'buffer', 'report'];
          (button as HTMLElement).dataset.step = steps[index];
        });

        // Add data attributes to step content sections
        const stepContents = document.querySelectorAll('.space-y-4');
        stepContents.forEach((content: Element) => {
          // Try to identify which step content this is
          const hasDrawButtons = content.querySelector('[class*="DrawingTools"]');
          const hasBufferInputs = content.querySelector('[class*="BufferTools"]');
          const hasReportButtons = content.querySelector('[class*="Choose a Report"]');
          
          if (hasDrawButtons) {
            (content as HTMLElement).dataset.stepcontent = 'draw';
          } else if (hasBufferInputs) {
            (content as HTMLElement).dataset.stepcontent = 'buffer';
          } else if (hasReportButtons) {
            (content as HTMLElement).dataset.stepcontent = 'report';
          }
        });
      } catch (error) {
        console.error("Error adding data attributes:", error);
      }
    }, 100);
  }, []);

  // Log at the start of every render
  renderCount.current += 1;
  console.log(`🔍 InfographicsTab Render #${renderCount.current}:`, {
    activeStep,
    hasGeometry: !!geometry, 
    hasGeometryInRef: !!geometryRef.current,
    geometryType: geometry ? (geometry as any).type : 'none',
    timeSinceMount: `${(Date.now() - mountTime.current) / 1000}s`,
    isSelectionMode,
    hasSelection,
    forceNavigationAttempts: forceNavigationCount.current,
    lastEvent: lastEvent.current ? `${lastEvent.current.time} - ${lastEvent.current.hasGeometry ? 'Has Geometry' : 'No Geometry'}` : 'None'
  });

  // Custom setActiveStep that persists to localStorage when we have geometry
  const setActiveStepWithPersistence = useCallback((step: Step) => {
    console.log(`Setting active step to ${step}`);
    setActiveStep(step);
    
    // If we have geometry, persist the step to localStorage
    if (geometry) {
      try {
        console.log(`Persisting step ${step} to localStorage`);
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          step,
          hasGeometry: true,
          timestamp: new Date().getTime()
        }));
      } catch (e) {
        console.warn('Failed to persist step to localStorage:', e);
      }
    }
  }, [geometry, STORAGE_KEY]);
  
  // Load persisted step from localStorage on mount
  useEffect(() => {
    // Only run this once after initial mount
    if (hasInitialized.current) return;
    hasInitialized.current = true;
    
    if (geometry) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const { step, timestamp } = JSON.parse(stored);
          
          // Only use if less than 5 minutes old
          const now = new Date().getTime();
          const fiveMinutes = 5 * 60 * 1000;
          
          if (now - timestamp < fiveMinutes) {
            console.log(`Restoring persisted step ${step} from localStorage`);
            setActiveStep(step as Step);
          } else {
            // Clear expired data
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch (e) {
        console.warn('Failed to load step from localStorage:', e);
      }
    }
  }, [geometry]);
  
  // EMERGENCY FIX: Force to report step on EVERY render if geometry exists
  useEffect(() => {
    // We only need this if we have geometry but aren't on report step
    if (geometry && activeStep !== 'report' && activeStep !== 'buffer') {
      console.log('🚨 EMERGENCY REDIRECT: Forcing to report step because geometry exists but activeStep = ', activeStep);
      
      // Simple direct state update - avoid cascading events
      setActiveStep('report');
      
      // No need for more complex logic that might cause loops
    }
  }, [geometry, activeStep]);

  // Clear localStorage if component unmounts
  useEffect(() => {
    return () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        // Ignore
      }
    };
  }, [STORAGE_KEY]);

  const memoizedLayerStates = useMemo(() => {
    return layerStates ? Object.fromEntries(
      Object.entries(layerStates).map(([key, state]) => [
        key,
        {
          layer: state.layer,
          visible: true,  // Add default values
          loading: false,
          error: undefined
        }
      ])
    ) : null;
  }, [layerStates]);

  // Implement generateStandardReport with proper functionality
  const generateStandardReport = useCallback(async (geometry: __esri.Geometry, reportType: string) => {
    try {
      debugLog('REPORT', `Generating standard report for ${reportType}`, {
        geometryType: geometry.type
      });

      const reportId = reportType; // Use the report ID directly

      // Get the API key from environment config
      const apiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
      
      if (!apiKey) {
        throw new Error('Missing ArcGIS API key');
      }

      // Make sure the geometry is in the correct spatial reference (4326/WGS84)
      let projectedGeometry = geometry;
      if (geometry.spatialReference.wkid !== 4326) {
        debugLog('REPORT', 'Projecting geometry to WGS84 (4326)');
        // Cast geometry to a valid GeometryUnion type
        const geometryUnion = geometry as __esri.GeometryUnion;
        projectedGeometry = await projection.project(geometryUnion, { wkid: 4326 }) as __esri.Geometry;
      }
      
      // Create the study area from the geometry
      const studyArea = {
        geometry: {
          rings: (projectedGeometry as __esri.Polygon).rings,
          spatialReference: { wkid: 4326 }
        }
      };

      // Use the exact same base URL as the older code
      const baseUrl = 'https://geoenrich.arcgis.com/arcgis/rest/services/World/geoenrichmentserver/Geoenrichment/createreport';
      debugLog('REPORT', 'Sending request directly to ArcGIS API');
      
      // Create params object like the older code
      const params = {
        f: 'json',
        token: apiKey,
        studyAreas: JSON.stringify([studyArea]),
        report: reportId, // Pass the report ID instead of the name
        format: 'PDF',
        langCode: 'en-ca' // Changed to Canadian English for Canadian demographic data
      };

      // Send the request using fetch
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/pdf'
        },
        body: new URLSearchParams(params).toString()
      });

      // Check if the response is successful
      if (!response.ok) {
        debugLog('ERROR', `ArcGIS API request failed with status: ${response.status}`);
        const errorText = await response.text();
        debugLog('ERROR', `Error response: ${errorText}`);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get the blob from the response
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      
      return url;
    } catch (error) {
      debugLog('ERROR', `Error generating standard report: ${error}`);
      throw error;
    }
  }, [reports]);

  // Stronger prevention of resetting to step 1 when coming from popup
  useEffect(() => {
    // Flag to track if we've been forced to report step
    let forcedToReportStep = false;
    
    // Function to check and fix if we're supposed to be on report step
    const checkAndFixStep = () => {
      const popupTrigger = window.sessionStorage.getItem('popupTriggeredNavigation');
      
      if (popupTrigger || forcedToReportStep) {
        // We should be on report step, check if we are
        if (activeStep !== 'report') {
          console.log(`⛔ PREVENTING RESET: We should be on report step but found ${activeStep}. Fixing...`);
          
          // Force back to report step
          setActiveStep('report');
          
          // Mark that we've forced to report step
          forcedToReportStep = true;
          
          // Try to get emergency geometry if needed
          if (!geometry) {
            console.log('Requesting emergency geometry due to step mismatch...');
            const emergencyEvent = new CustomEvent('requestGeometry', {
              bubbles: true, 
              composed: true
            });
            document.dispatchEvent(emergencyEvent);
          }
        }
      }
    };
    
    // Run the check immediately
    checkAndFixStep();
    
    // And also set up an interval to continually check
    const intervalId = setInterval(checkAndFixStep, 500);
    
    return () => {
      clearInterval(intervalId);
    };
  }, [activeStep, geometry]);
  
  // Fix the openInfographics event handler to definitely set to report step
  /*const handleOpenInfographics = useCallback((event: CustomEvent) => {
    // Force step change FIRST
    setActiveStep('report');
    // ADD CONFIRMATION LOG
    console.log('✅✅✅ STEP SET TO REPORT inside handleOpenInfographics ✅✅✅');

    // Log the entire event detail at the VERY start of the handler
    console.log("🔍 InfographicsTab received openInfographics event. Detail:", event.detail);

    // CRITICAL: Force to report step immediately regardless of geometry
    // setActiveStep('report'); // MOVED TO TOP

    if (event.detail?.geometry) {
      const newGeometry = event.detail.geometry;
      console.log("🔎 EVENT GEOMETRY DETAILS:", { // Keep this log too for details
        type: newGeometry.type,
        isValid: !!newGeometry,
        hasRings: !!(newGeometry as any).rings,
        hasCoordinates: !!(newGeometry as any).x && !!(newGeometry as any).y,
        spatialReference: newGeometry.spatialReference
      });

      // Force state updates synchronously within this callback
      console.log('⚡️ Force setting geometry, selection, and step...');
      setGeometry(newGeometry);
      // Log immediately after setting state
      console.log('✅ Called setGeometry. Checking geometryRef immediately:', { 
          refHasGeom: !!geometryRef.current, 
          refType: geometryRef.current?.type 
      });
      geometryRef.current = newGeometry; // Keep setting ref too
      setHasSelection(true);
      setIsSelectionMode(false);
      // setActiveStep('report'); // MOVED TO TOP
      console.log('⚡️ State forced. Checking activeStep:', activeStep);

      // Store flag in session storage to potentially help other components
      try {
        window.sessionStorage.setItem('popupTriggeredNavigation', 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ // Also update persisted state
          step: 'report',
          hasGeometry: true,
          timestamp: Date.now()
        }));
      } catch (e) {
        // Ignore error
      }
    } else {
      console.warn('openInfographics event received without geometry.');
      // Optionally handle this case, e.g., stay on draw step or show an error
      // setActiveStep('draw'); // Example: revert to draw if no geometry provided
    }
    // The state update for activeStep might still be async in React, but setting geometry
    // and other flags synchronously should help the rendering logic catch up.
  }, [setGeometry, geometryRef, setHasSelection, setIsSelectionMode, setActiveStep, STORAGE_KEY]);
*/
  // Add handler for infographicsTabUpdate event
 /* const handleInfographicsTabUpdate = useCallback((event: CustomEvent) => {
    console.log("🔍 InfographicsTab received infographicsTabUpdate event:", {
      hasDetail: !!event.detail,
      hasGeometry: !!event.detail?.geometry,
      eventTime: new Date().toISOString()
    });
    
    // Store the latest event in a ref for debugging
    const eventInfo = {
      time: new Date().toISOString(),
      eventType: 'infographicsTabUpdate',
      hasGeometry: !!event.detail?.geometry,
      geometryType: event.detail?.geometry?.type || 'unknown',
      detail: JSON.stringify(event.detail, (key, value) => {
        if (key && typeof value === 'object' && value !== null) {
          if (key === 'rings' || key === 'paths' || key === 'points') {
            return '[Array data]';
          }
          if (key === 'spatialReference') {
            return value.wkid ? { wkid: value.wkid } : '[spatialReference]';
          }
          if (typeof value === 'function' || key.startsWith('_')) {
            return '[Function or internal]';
          }
        }
        return value;
      }, 2).substring(0, 200) + '...'
    };
    
    console.log('📊 infographicsTabUpdate structure:', eventInfo);
    
    // Store in lastEvent ref
    lastEvent.current = eventInfo;
    
    // If event includes geometry, update the state
    if (event.detail?.geometry) {
      console.log("Setting geometry from infographicsTabUpdate event");
      
      // ==== REPLICATE "TEST GEOMETRY" BUTTON APPROACH ==== 
      // 1. Set both state and ref
      setGeometry(event.detail.geometry);
      geometryRef.current = event.detail.geometry;
      
      // 2. Set selection states
      setHasSelection(true);
      setIsSelectionMode(false);
      
      // 3. Force navigation to step 3
      if (typeof (window as any).__forceToReportStep === 'function') {
        (window as any).__forceToReportStep();
        } else {
        // setActiveStepWithPersistence('report'); // Ensure this uses the correct setter
        setActiveStep('report');
        }
      
      console.log("Navigated to report step using test geometry button approach");
    }
  }, [setGeometry, geometryRef, setHasSelection, setIsSelectionMode, setActiveStep]); // Update dependencies
*/
  // Set up event listeners for both event types
  /*useEffect(() => {
    // Log when event listeners are attached
    console.log("🟢 [InfographicsTab] Attaching openInfographics listener NOW");

    // Add event listeners
    document.addEventListener('openInfographics', handleOpenInfographics as EventListener);
    window.addEventListener('openInfographics', handleOpenInfographics as EventListener);
    
    document.addEventListener('infographicsTabUpdate', handleInfographicsTabUpdate as EventListener);
    window.addEventListener('infographicsTabUpdate', handleInfographicsTabUpdate as EventListener);
    
    // Remove event listeners on cleanup
    return () => {
      console.log("🔴 [InfographicsTab] Removing openInfographics listener");
      document.removeEventListener('openInfographics', handleOpenInfographics as EventListener);
      window.removeEventListener('openInfographics', handleOpenInfographics as EventListener);
      
      console.log("🔴 [InfographicsTab] Removing infographicsTabUpdate listener");
      document.removeEventListener('infographicsTabUpdate', handleInfographicsTabUpdate as EventListener);
      window.removeEventListener('infographicsTabUpdate', handleInfographicsTabUpdate as EventListener);
    };
  }, [handleOpenInfographics, handleInfographicsTabUpdate]);
*/
  // Initialize drawing hook
  const drawing = useDrawing({
    view,
    setDrawMode,
    setIsDrawing,
    setTargetGeometry: (value: __esri.Geometry | null | ((prev: __esri.Geometry | null) => __esri.Geometry | null)) => {
      if (typeof value !== 'function' && value) {
        setGeometry(value);
        setHasSelection(true);
      }
    },
    onGeometryCreated: useCallback((geom: __esri.Geometry) => {
      console.log('onGeometryCreated:', { 
        geometryType: geom.type, 
        drawMode, 
        hasSelection: !!geom 
      });
      
      setGeometry(geom);
      setHasSelection(true);
      
      if (drawMode !== 'click') {
        cancelDrawing();
        setDrawMode(null);
        if (geom.type === 'point') {
          setActiveStepWithPersistence('buffer');
        } else {
          setActiveStepWithPersistence('report');
        }
      }
    }, [drawMode]),
    onDrawingStarted: useCallback(() => {
      setIsDrawing(true);
      setError(null);
      setHasSelection(false);
      view?.graphics.removeAll();
    }, [view]),
    onDrawingCanceled: useCallback(() => {
      setIsDrawing(false);
      setDrawMode(null);
      setError(null);
      setHasSelection(false);
    }, []),
    onValidationError: useCallback((error: string) => {
      setError(error);
    }, [])
  });

  // Update cancelDrawing to preserve selection mode
  const cancelDrawing = useCallback(() => {
    if (drawMode !== 'click') {
      setDrawMode(null);
      setIsSelectionMode(false);
    }
    setIsDrawing(false);
    drawing.cancelDrawing();
  }, [drawMode, drawing]);

  // Initialize handlers
  const createAndAddBuffer = useCallback((bufferGeometry: __esri.Geometry, color: number[]) => {
    if (!view) return;

    const bufferGraphic = new Graphic({
      geometry: bufferGeometry,
      symbol: new SimpleFillSymbol({
        color: [...color, 0.2],
        outline: {
          color: color,
          width: 2
        }
      })
    });

    const pointGraphic = view.graphics.find(g => g.attributes?.isPoint);
    view.graphics.removeAll();
    if (pointGraphic) {
      view.graphics.add(pointGraphic);
    }
    view.graphics.add(bufferGraphic);

    // Add null check for bufferGeometry.extent
    if (bufferGeometry?.extent) {
      view.goTo(bufferGeometry.extent.expand(1.2));
    }

    setGeometry(bufferGeometry);
    setActiveStepWithPersistence('report');
  }, [view]);

  const handleBufferTypeChange = useCallback((type: string) => {
    setBufferType(type as 'radius' | 'drivetime' | 'walktime');
    setBufferUnit(type === 'radius' ? 'kilometers' : type === 'drivetime' ? 'minutes' : 'kilometers'); // Changed default distance unit to kilometers
    setBufferValue('1');
  }, []);

  const handleCreateBuffer = useCallback(async () => {
    if (!geometry || geometry.type !== 'point' || !view) return;

    const getBufferColor = () => {
      switch (bufferType) {
        case 'radius': return [37, 99, 235];
        case 'drivetime': return [249, 115, 22];
        case 'walktime': return [147, 51, 234];
        default: return [37, 99, 235];
      }
    };
    const color = getBufferColor();

    if (bufferType === 'radius') {
      let radiusInMeters = parseFloat(bufferValue);
      if (bufferUnit === 'kilometers') {
        radiusInMeters *= 1000;
      }

      const bufferGeometry = new Circle({
        center: geometry as __esri.Point,
        radius: radiusInMeters,
        radiusUnit: "meters",
        spatialReference: view.spatialReference
      });

      createAndAddBuffer(bufferGeometry, color);
      return;
    }

    try {
      let timeInMinutes = parseFloat(bufferValue);
      if (bufferUnit === 'kilometers') {
        const speedInKmh = bufferType === 'drivetime' ? 50 : 5;
        const distanceInKm = parseFloat(bufferValue);
        timeInMinutes = (distanceInKm / speedInKmh) * 60;
      }

      const params = new ServiceAreaParameters({
        facilities: new FeatureSet({
          features: [{
            geometry: geometry,
            attributes: {
              Name: "Location",
              [bufferType === "drivetime" ? "TravelTime" : "WalkTime"]: timeInMinutes
            }
          }]
        }),
        defaultBreaks: [timeInMinutes],
        travelDirection: "from-facility",
        outputGeometryPrecision: 1,
        trimOuterPolygon: true,
        outSpatialReference: view.spatialReference,
        travelMode: {
          attributeParameterValues: [],
          description: "Results are calculated using the street network",
          impedanceAttributeName: bufferType === "drivetime" ? "TravelTime" : "WalkTime",
          name: bufferType === "drivetime" ? "Driving Time" : "Walking Distance",
          type: bufferType === "drivetime" ? "automobile" : "walk",
          useHierarchy: bufferType === "drivetime",
          restrictionAttributeNames: [],
          simplificationTolerance: 2,
          timeAttributeName: bufferType === "drivetime" ? "TravelTime" : "WalkTime"
        }
      });

      console.log('Service Area Parameters:', params);
      
      // Add detailed debugging for the request
      const serviceUrl = "https://route-api.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
      const envApiKey = process.env.NEXT_PUBLIC_ARCGIS_API_KEY;
      
      console.log('=== API KEY DIAGNOSTIC ===');
      console.log('Environment API key present:', !!envApiKey);
      console.log('Environment API key length:', envApiKey?.length);
      console.log('EsriConfig API key present:', !!esriConfig.apiKey);
      console.log('EsriConfig API key length:', esriConfig.apiKey?.length);
      console.log('API keys match:', envApiKey === esriConfig.apiKey);
      if (envApiKey) {
        console.log('API key starts with:', envApiKey.substring(0, 15) + '...');
        console.log('API key ends with:', '...' + envApiKey.substring(envApiKey.length - 15));
      }
      console.log('=== END API KEY DIAGNOSTIC ===');
      
      console.log('Service Area Request Details:', {
        url: serviceUrl,
        envApiKeyPresent: !!envApiKey,
        envApiKeyLength: envApiKey?.length,
        envApiKeyPrefix: envApiKey?.substring(0, 10) + '...',
        esriConfigApiKey: !!esriConfig.apiKey,
        esriConfigApiKeyLength: esriConfig.apiKey?.length,
        params: JSON.stringify(params, null, 2)
      });

      // Comprehensive API key and service testing
      console.log('=== SERVICE AREA LICENSING & API DIAGNOSTICS ===');
      try {
        // Test 1: Service info without authentication to understand requirements
        const infoUrl = `${serviceUrl}?f=json`;
        console.log('Test 1: Service info (no auth):', infoUrl);
        const infoResponse = await fetch(infoUrl);
        const infoResult = await infoResponse.json();
        console.log('Service info result:', {
          status: infoResponse.status,
          statusText: infoResponse.statusText,
          result: infoResult
        });
        
        // Test 2: Direct access with API key as token
        const testUrl = `${serviceUrl}?f=json&token=${envApiKey}`;
        console.log('Test 2: Service access with API key token');
        const testResponse = await fetch(testUrl);
        const testResult = await testResponse.json();
        console.log('API key test result:', {
          status: testResponse.status,
          statusText: testResponse.statusText,
          error: testResult.error?.message,
          details: testResult.error?.details
        });
        
        // Test 3: Check account privileges
        const tokenInfoUrl = `https://www.arcgis.com/sharing/rest/portals/self?f=json&token=${envApiKey}`;
        console.log('Test 3: Account privileges check');
        const tokenResponse = await fetch(tokenInfoUrl);
        const tokenResult = await tokenResponse.json();
        console.log('Account info result:', {
          status: tokenResponse.status,
          user: tokenResult.user,
          privileges: tokenResult.user?.privileges,
          hasNetworkAnalysis: tokenResult.user?.privileges?.includes('premium:user:networkanalysis:routing'),
          hasOptimizedRouting: tokenResult.user?.privileges?.includes('premium:user:networkanalysis:optimizedrouting')
        });
        
        // Test 4: Alternative service URL (route.arcgis.com)
        const alternativeUrl = "https://route.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
        console.log('Test 4: Alternative service endpoint');
        const altResponse = await fetch(`${alternativeUrl}?f=json&token=${envApiKey}`);
        const altResult = await altResponse.json();
        console.log('Alternative endpoint result:', {
          status: altResponse.status,
          statusText: altResponse.statusText,
          error: altResult.error?.message
        });
        
        // Diagnostic summary
        console.log('=== DIAGNOSTIC SUMMARY ===');
        console.log('API Key Status:', {
          present: !!envApiKey,
          length: envApiKey?.length,
          validFormat: envApiKey?.startsWith('AAPT') && envApiKey?.length > 400
        });
        console.log('Required Privileges for Service Areas:');
        console.log('- premium:user:networkanalysis:routing OR');
        console.log('- premium:user:networkanalysis:optimizedrouting');
        console.log('Solution: Upgrade ArcGIS subscription or use approximation fallback');
        
      } catch (testError) {
        console.error('Diagnostic tests failed:', testError);
      }
      console.log('=== END DIAGNOSTICS ===');

      // Try different approaches to solve the service area issue
      console.log('=== ATTEMPTING SERVICE AREA SOLVE ===');
      
      // Method 1: Standard solve with current URL
      console.log('Method 1: Standard solve attempt');
      let result;
      try {
        result = await serviceArea.solve(serviceUrl, params);
        console.log('Method 1 SUCCESS: Standard solve worked');
      } catch (method1Error) {
        console.log('Method 1 FAILED:', method1Error);
        
        // Method 2: Try with different service URL
        console.log('Method 2: Alternative service URL');
        const altServiceUrl = "https://route.arcgis.com/arcgis/rest/services/World/ServiceAreas/NAServer/ServiceArea_World/solveServiceArea";
        try {
          result = await serviceArea.solve(altServiceUrl, params);
          console.log('Method 2 SUCCESS: Alternative URL worked');
        } catch (method2Error) {
          console.log('Method 2 FAILED:', method2Error);
          
          // Method 3: Try with explicit RequestOptions
          console.log('Method 3: Explicit authentication in request options');
          try {
            result = await serviceArea.solve(serviceUrl, params, {
              requestOptions: {
                query: { token: envApiKey }
              }
            });
            console.log('Method 3 SUCCESS: Explicit auth in request options worked');
          } catch (method3Error) {
            console.log('Method 3 FAILED:', method3Error);
            
            // Method 4: Try without useHierarchy and with minimal params
            console.log('Method 4: Simplified parameters');
            const simplifiedParams = new ServiceAreaParameters({
              facilities: params.facilities,
              defaultBreaks: params.defaultBreaks,
              outSpatialReference: params.outSpatialReference
            });
            try {
              result = await serviceArea.solve(serviceUrl, simplifiedParams);
              console.log('Method 4 SUCCESS: Simplified params worked');
            } catch (method4Error) {
              console.log('Method 4 FAILED:', method4Error);
              throw method4Error; // Re-throw to trigger fallback
            }
          }
        }
      }
      
      console.log('=== SERVICE AREA SOLVE COMPLETED ===');
      
      // Add proper null checks for service area polygons
      if (result?.serviceAreaPolygons?.features && result.serviceAreaPolygons.features.length > 0) {
        const featureGeometry = result.serviceAreaPolygons.features[0].geometry;
        if (featureGeometry) {
          createAndAddBuffer(featureGeometry as __esri.Geometry, color);
        } else {
          throw new Error("Invalid geometry in service area result");
        }
      } else {
        throw new Error("No service area returned");
      }
    } catch (error) {
      // Enhanced error logging to understand the issue
      console.error('=== SERVICE AREA ERROR DETAILS ===');
      console.error('Error object:', error);
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      
      if (error && typeof error === 'object') {
        console.error('Error properties:', {
          name: (error as any).name,
          message: (error as any).message,
          details: (error as any).details,
          code: (error as any).code,
          httpStatus: (error as any).httpStatus,
          requestOptions: (error as any).requestOptions,
          url: (error as any).url
        });
        
        // Log the full error object structure
        console.error('Full error object:', JSON.stringify(error, null, 2));
      }
      console.error('=== END SERVICE AREA ERROR DETAILS ===');
      
      // Check if it's a permissions error and fallback to enhanced approximation
      if (error && typeof error === 'object' && 'message' in error && 
          (error.message as string).includes('permissions')) {
        console.log('Service area failed due to licensing requirements, using enhanced approximation');
        
        // Set user-friendly notification about licensing requirement
        setError(`Service area requires premium license: The ArcGIS World ServiceAreas API requires 'premium:user:networkanalysis:routing' privileges. Using approximation instead.`);
        
        // Enhanced fallback with more realistic parameters
        let radiusInMeters = parseFloat(bufferValue);
        
        if (bufferType === "drivetime") {
          // More realistic driving speeds based on context:
          // Urban areas: ~25 mph average (accounting for traffic, stops)
          // Suburban/rural: ~35 mph average
          // Conservative estimate: 25 mph = 0.417 miles per minute
          radiusInMeters = radiusInMeters * 0.417 * 1609.34;
          
          // Create a slightly irregular shape to better approximate road networks
          const mainBuffer = geometryEngine.geodesicBuffer(geometry as __esri.Point, radiusInMeters, 'meters', false) as __esri.Polygon;
          
          // Add secondary buffers in cardinal directions to simulate road patterns
          const cardinalDistances = [
            radiusInMeters * 1.2, // North (highways often extend further)
            radiusInMeters * 0.9,  // East 
            radiusInMeters * 1.1,  // South
            radiusInMeters * 0.85  // West
          ];
          
          // Create offset points for directional buffers
          const offsets = [
            [0, radiusInMeters * 0.3],    // North offset
            [radiusInMeters * 0.3, 0],    // East offset  
            [0, -radiusInMeters * 0.3],   // South offset
            [-radiusInMeters * 0.3, 0]    // West offset
          ];
          
          let combinedGeometry = mainBuffer;
          
          offsets.forEach((offset, index) => {
            const offsetPoint = new Point({
              x: (geometry as __esri.Point).x + offset[0],
              y: (geometry as __esri.Point).y + offset[1],
              spatialReference: geometry.spatialReference
            });
            
            const directionalBuffer = geometryEngine.geodesicBuffer(
              offsetPoint as __esri.Point, 
              cardinalDistances[index], 
              'meters', 
              false
            ) as __esri.Polygon;
            
            if (directionalBuffer && combinedGeometry) {
              try {
                combinedGeometry = geometryEngine.union([combinedGeometry as __esri.Polygon, directionalBuffer]) as __esri.Polygon;
              } catch (unionError) {
                console.warn('Union operation failed, using main buffer:', unionError);
              }
            }
          });
          
          if (combinedGeometry) {
            createAndAddBuffer(combinedGeometry as __esri.Geometry, color);
            console.log(`Created enhanced drive-time approximation: ${parseFloat(bufferValue)} ${bufferUnit} at ~25 mph average`);
            // Clear error after 5 seconds to show success
            setTimeout(() => setError(null), 5000);
            return;
          }
          
        } else if (bufferType === "walktime") {
          // Walking speed varies by terrain and population:
          // Urban areas: ~2.5 mph (slower due to crossings, crowds)
          // Suburban: ~3.0 mph 
          // Conservative estimate: 2.5 mph = 0.042 miles per minute
          radiusInMeters = radiusInMeters * 0.042 * 1609.34;
          
          // Walking areas are more constrained by sidewalks and paths
          // Create a more compact, realistic walking buffer
          const walkingBuffer = geometryEngine.geodesicBuffer(geometry as __esri.Point, radiusInMeters, 'meters', false) as __esri.Polygon;
          
          // Reduce the buffer slightly to account for pedestrian-only areas
          const realisticWalkBuffer = geometryEngine.geodesicBuffer(
            geometry as __esri.Point, 
            radiusInMeters * 0.85, // 15% reduction for realistic walking constraints
            'meters', 
            false
          ) as __esri.Polygon;
          
          if (realisticWalkBuffer) {
            createAndAddBuffer(realisticWalkBuffer as __esri.Geometry, color);
            console.log(`Created enhanced walk-time approximation: ${parseFloat(bufferValue)} ${bufferUnit} at ~2.5 mph average`);
            // Clear error after 5 seconds to show success
            setTimeout(() => setError(null), 5000);
            return;
          }
        }
        
        // Fallback to simple circular buffer if enhanced methods fail
        const buffer = geometryEngine.geodesicBuffer(geometry as __esri.Point, radiusInMeters, 'meters', false) as __esri.Polygon;
        if (buffer) {
          createAndAddBuffer(buffer as __esri.Geometry, color);
          console.log(`Created simple fallback radius buffer: ${radiusInMeters}m for ${bufferType}`);
          return;
        }
      }
      
      throw error; // Re-throw the error if it's not a permissions issue or fallback failed
    }
  }, [geometry, bufferType, bufferValue, bufferUnit, view, createAndAddBuffer]);

  const handleDrawButtonClick = useCallback((mode: DrawMode) => {
    console.log('handleDrawButtonClick:', { mode });
    
    // Set states in correct order
    setDrawMode(mode);
    setIsSelectionMode(mode === 'click');
    setGeometry(null);
    setError(null);
    setHasSelection(false);
    view?.graphics.removeAll();
    
    // Cancel any existing drawing before starting new one
    cancelDrawing();
    
    // Start drawing after state updates
    drawing.startDrawing(mode);
  }, [drawing, view, cancelDrawing]);

  const handleSelectionComplete = useCallback(() => {
    if (!drawing.targetGeometry) return;
  
    // Store the combined geometry result
    const combinedGeometry = drawing.targetGeometry;
    
    // Set states for next step
    setGeometry(combinedGeometry);
    setActiveStep('report');
    setHasSelection(true);
  }, [drawing]);

  // Update cleanup logic in useEffect
  useEffect(() => {
    return () => {
      // Cleanup graphics when component unmounts
      if (view?.graphics) {
        try {
          view.graphics.removeAll();
        } catch (error) {
          console.warn('Error cleaning up graphics:', error);
        }
      }
      // Reset modal state
      setIsModalOpen(false);
    };
  }, [view]);

  // Add reset functionality
  const handleReset = useCallback(() => {
    // Skip reset if we came from popup
    if (window.sessionStorage.getItem('popupTriggeredNavigation')) {
      console.log('Skipping reset because we came from popup');
      return;
    }
    
    console.log("Resetting infographics state");
    
    // First, cancel any active drawing
    if (drawing) {
      drawing.cancelDrawing();
    }
    
    // Clear all graphics from the view
    if (view) {
      try {
        // Clear main graphics layer
        view.graphics.removeAll();
        
        // Get all graphics layers from the map
        view.map.allLayers.forEach(layer => {
          // Only process graphics layers
          if (layer.type === 'graphics') {
            (layer as __esri.GraphicsLayer).removeAll();
          }
        });
      } catch (error) {
        console.warn('Error cleaning up graphics:', error);
      }
    }
    
    // Reset all state variables
    setGeometry(null);
    geometryRef.current = null; // Also clear the ref
    setHasSelection(false);
    setIsSelectionMode(false);
    setActiveStepWithPersistence('draw');
    setBufferType('radius');
    setBufferValue('1');
    setBufferUnit('kilometers'); // Changed from miles to kilometers for Canadian users
    setReportTemplate('whats-in-my-neighbourhood-km'); // Reset to Canadian template (kilometers version)
    setError(null);
    setIsModalOpen(false);
    setDrawMode(null);
    setIsDrawing(false);

    // Clear potential stale geometry sources
    try {
      localStorage.removeItem('emergencyGeometry');
      delete (window as any).emergencyGeometry;
      window.sessionStorage.removeItem('popupTriggeredNavigation'); // Clear popup flag too
      localStorage.removeItem(STORAGE_KEY); // Clear persisted step
      console.log('Cleared stale geometry and session flags during reset.');
    } catch (error) {
      console.warn('Error clearing stale data during reset:', error);
    }
    
  }, [view, drawing, setActiveStepWithPersistence]);

  // Make sure the reset button is properly connected
  const handleResetClick = useCallback(() => {
    handleReset();
  }, [handleReset]);

  const handleGenerateReport = useCallback(() => {
    console.log('handleGenerateReport called:', {
      hasGeometry: !!geometry,
      reportTemplate,
      currentIsModalOpen: isModalOpen
    });
  
    if (!geometry) {
      console.warn('No geometry available for report generation');
      return;
    }

    // Check if this is an AI-powered report (market intelligence or endpoint scoring)
    if (reportTemplate === 'market-intelligence-report' || reportTemplate === 'endpoint-scoring-combined') {
      console.log('Opening AI-powered report modal...', { reportType: reportTemplate });
      // Both market intelligence and endpoint scoring use the same underlying scoring service
      // The difference is in the presentation and focus of the report
      setIsModalOpen(true);
    } else {
      // Standard ArcGIS report
      console.log('Opening standard ArcGIS report modal...');
      setIsModalOpen(true);
    }

  }, [geometry, reportTemplate, setIsModalOpen]);

  const handleDialogOpen = () => setIsDialogOpen(true);
  const handleDialogClose = () => {
    setIsDialogOpen(false);
  };
  const handleReportSelect = (selectedId: string | React.MouseEvent<HTMLDivElement>) => {
    if (typeof selectedId === 'string') {
      setReportTemplate(selectedId);
      setIsDialogOpen(false);
    }
  };

  // Components
  const getInstructionText = useCallback(() => {
    if (error) return error;
    if (!drawMode) return "Select a method to define your area of interest";
    
    const instructions = {
      point: "Click on the map to drop a point",
      polygon: "Click on the map to begin drawing a polygon",
      click: "Click on a feature or features on the map"
    };
    
    return instructions[drawMode];
  }, [error, drawMode]);

  const BufferTools = useCallback(() => {
    const tools = [
      {
        type: 'radius',
        icon: MapPin,
        label: 'Radius',
        activeColor: 'text-blue-600',
        hoverColor: 'hover:text-blue-600',
        activeBg: 'bg-blue-50',
        borderColor: 'border-blue-200'
      },
      {
        type: 'drivetime',
        icon: Car,
        label: 'Drive Time',
        activeColor: 'text-green-600',
        hoverColor: 'hover:text-green-600',
        activeBg: 'bg-green-50',
        borderColor: 'border-green-200'
      },
      {
        type: 'walktime',
        icon: UserIcon,
        label: 'Walk Time',
        activeColor: 'text-purple-600',
        hoverColor: 'hover:text-purple-600',
        activeBg: 'bg-purple-50',
        borderColor: 'border-purple-200'
      }
    ];

    return (
      <div className="grid grid-cols-3 gap-4">
        {tools.map(tool => (
          <Button
            key={tool.type}
            variant="outline"
            onClick={() => handleBufferTypeChange(tool.type)}
            className={`
              flex flex-col items-center justify-center gap-2 h-24
              transition-colors duration-200
              ${bufferType === tool.type 
                ? `${tool.activeBg} ${tool.activeColor} border ${tool.borderColor} shadow-sm` 
                : `hover:bg-gray-50 ${tool.hoverColor}`}
            `}
          >
            <tool.icon className={`h-6 w-6 ${bufferType === tool.type ? tool.activeColor : ''}`} />
            <span className="text-sm font-medium">{tool.label}</span>
          </Button>
        ))}
      </div>
    );
  }, [bufferType, handleBufferTypeChange]);

  // Update the ReportModal component
  const ReportModal = useCallback(() => {
    console.log('ReportModal render:', {
      isModalOpen,
      hasGeometry: !!geometry,
      reportTemplate,
      hasLayerStates: !!memoizedLayerStates,
      layerStateKeys: memoizedLayerStates ? Object.keys(memoizedLayerStates) : []
    });
  
    // Check for dependencies without early return
    const hasDependencies = !!geometry && !!memoizedLayerStates;
    
    if (!hasDependencies) {
      console.log('ReportModal missing dependencies:', {
        hasGeometry: !!geometry,
        hasLayerStates: !!memoizedLayerStates,
        modalIsOpen: isModalOpen
      });
    }
  
    return (
      <Dialog 
        open={isModalOpen} 
        onOpenChange={(open) => {
          console.log('Dialog onOpenChange:', { open });
          setIsModalOpen(open);
        }}
      >
        <DialogContent className="max-w-4xl p-0 bg-white overflow-hidden">
          <div className="flex justify-between items-center p-4 border-b bg-white">
            <DialogTitle className="text-base font-medium">Area Analysis Report</DialogTitle>
          </div>
          <DialogDescription className="sr-only">
            Analysis report for the selected area
          </DialogDescription>
          
          <div className="h-[calc(100vh-8rem)] overflow-y-auto">
            {!hasDependencies && (
              <div className="p-6 text-center">
                <div className="mb-4 text-amber-500">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-2" />
                  <h3 className="text-lg font-semibold">Loading Data</h3>
                </div>
                <p className="text-gray-600 mb-4">
                  Waiting for required data to generate the report.
                </p>
                <div className="text-sm text-left bg-gray-50 p-3 rounded border border-gray-200 mb-4 overflow-auto">
                  <div><strong>Geometry:</strong> {geometry ? `✅ (${(geometry as any).type})` : '❌ Missing'}</div>
                  <div><strong>Layer States:</strong> {memoizedLayerStates ? '✅' : '❌ Missing'}</div>
                  <div><strong>Report Template:</strong> {reportTemplate || 'Not selected'}</div>
                </div>
              </div>
            )}
            
            {isModalOpen && hasDependencies && (
              (reportTemplate === 'market-intelligence-report' || reportTemplate === 'endpoint-scoring-combined') ? (
                <EndpointScoringReport
                  geometry={geometry}
                  view={view}
                  onExportPDF={exportToPDF}
                  reportType={reportTemplate === 'market-intelligence-report' ? 'market-intelligence' : 'endpoint-scoring'}
                  key={`${reportTemplate}-${geometry.type}-${Date.now()}`}
                />
              ) : (
                <Infographics
                  view={view}
                  geometry={geometry}
                  reportTemplate={reportTemplate}
                  onReportTemplateChange={(newTemplate) => {
                    console.log('Report template changed:', {
                      oldTemplate: reportTemplate,
                      newTemplate
                    });
                    setReportTemplate(newTemplate || 'whats-in-my-neighbourhood-km');                }}
                  layerStates={memoizedLayerStates}
                  generateStandardReport={generateStandardReport}
                  onExportPDF={exportToPDF}
                  key={`${reportTemplate}-${geometry.type}-${Date.now()}`} /* Add key to force remount */
                />
              )
            )}
          </div>
        </DialogContent>
      </Dialog>
    );
  }, [isModalOpen, geometry, reportTemplate, memoizedLayerStates, view, setIsModalOpen, exportToPDF, generateStandardReport]);

  useEffect(() => {
    const loadReports = async () => {
      // Prevent multiple fetches
      if (isFetchingReports.current) {
        console.log('[InfographicsTab] Already fetching, skipping.');
        return;
      }
      isFetchingReports.current = true;
      console.log('[InfographicsTab] Loading reports from ReportsService...');
      
      try {
        const reports = await fetchReports();
        console.log('[InfographicsTab] Loaded', reports.length, 'reports from ReportsService');
        setReports(reports);
        
        // Set default template if needed - prioritize useful Canadian templates
        if (!reportTemplate && reports.length > 0) {
          // Look for preferred templates in order of preference
          const preferredTemplates = [
            'what\'s in my neighbourhood',
            'neighbourhood', 
            'housing',
            'market',
            'demographic',
            'community',
            'population',
            'business'
          ];
          
          let defaultReport = reports[0]; // fallback to first report
          
          // Try to find a preferred template
          for (const preferred of preferredTemplates) {
            const found = reports.find(r => 
              r.title.toLowerCase().includes(preferred) && 
              !r.title.toLowerCase().includes('quebec')
            );
            if (found) {
              defaultReport = found;
              break;
            }
          }
          
          console.log(`[InfographicsTab] Setting default report template to: '${defaultReport.title}' (ID: ${defaultReport.id})`);
          setReportTemplate(defaultReport.id);
        }
      } catch (error) {
        console.error('[InfographicsTab] Error loading reports:', error);
        setReports([]);
      } finally {
        isFetchingReports.current = false;
        console.log('[InfographicsTab] Load attempt finished.');
      }
    };
    
    loadReports();
  }, []); // Keep empty dependency array

  // Log reports state for debugging
  useEffect(() => {
    console.log('🗂️ Reports state:', reports);
  }, [reports]);

  // Add debugging for reportTemplate state changes
  useEffect(() => {
    console.log('📊 ReportTemplate state changed:', {
      reportTemplate,
      timestamp: new Date().toISOString()
    });
  }, [reportTemplate]);

  // Add debugging effect to monitor state changes
  useEffect(() => {
    console.log('🔄 STATE CHANGED:', {
      activeStep,
      hasGeometry: !!geometry,
      geometryType: geometry?.type,
      hasGeometryRef: !!geometryRef.current,
      geometryRefType: geometryRef.current?.type,
      isSelectionMode,
      hasSelection,
      time: new Date().toISOString()
    });
  }, [activeStep, geometry, isSelectionMode, hasSelection]);

  // Increment render count on each render
  useEffect(() => {
    renderCount.current += 1;
    console.log(`📊 Component rendered (count: ${renderCount.current})`);
    
    // Force geometry update if we have geometry in ref but not in state
    if (!geometry && geometryRef.current) {
      console.log('🔥 INCONSISTENCY DETECTED: geometryRef exists but geometry state is null. Fixing...');
      setGeometry(geometryRef.current);
      setHasSelection(true);
    }
  });

  // Add a more direct and reliable fix for geometry issues
  // This will run on every render to ensure geometry state is correct
  useEffect(() => {
    const fixGeometryState = () => {
      // If we're on report step but have no geometry state, something is wrong
      if (activeStep === 'report' && !geometry) {
        console.log('🚨 CRITICAL FIX: On report step without geometry state');
        
        // Check if we have geometry in the ref
        if (geometryRef.current) {
          console.log('🔧 Using geometry from ref to fix state');
          
          // Force a synchronous state update
          setGeometry(geometryRef.current);
          setHasSelection(true);
          
          // Force DOM refresh by calling forceUpdate if available
          if (typeof (window as any).__forceUpdate === 'function') {
            console.log('Calling forceUpdate');
            (window as any).__forceUpdate();
          }
          
          return;
        }
        
        // If we don't have geometry in the ref, use emergency event to get geometry
        console.log('🚨 EMERGENCY: Dispatching event to request geometry');
        
        const emergencyEvent = new CustomEvent('requestGeometry', {
          bubbles: true,
          composed: true
        });
        document.dispatchEvent(emergencyEvent);
      }
    };
    
    // Run the fix
    fixGeometryState();
    
    // Also set up a timer to check again in case of race conditions
    const timerId = setTimeout(fixGeometryState, 500);
    
    return () => {
      clearTimeout(timerId);
    };
  }, [activeStep, geometry]);

  // Add a global function to force a re-render
  useEffect(() => {
    // Simple method to force component update
    (window as any).__forceUpdate = () => {
      console.log('Force update called');
      // Triggers a re-render by updating a ref and forcing a state change
      renderCount.current += 1;
      setActiveStep((prev: any) => prev); // Same value but forces re-render
    };
    
    return () => {
      delete (window as any).__forceUpdate;
    };
  }, []);

  // Add a global helper function to directly set the geometry from outside components
  useEffect(() => {
    // Create a global helper to directly set geometry outside of React
    (window as any).__directlySetGeometry = (geom: __esri.Geometry) => {
      console.log('🔥 DIRECT geometry setting bypassing React!', {
        type: geom.type,
        hasRings: !!(geom as any).rings,
        hasCoordinates: !!(geom as any).x && !!(geom as any).y
      });
      
      // Set ref first
      geometryRef.current = geom;
      
      // Force immediate synchronous DOM update using direct state setter
      setGeometry(geom);
      setHasSelection(true);
      setIsSelectionMode(false);
      setActiveStep('report');
      
      console.log('🔥 DIRECT setting complete, checking state:', {
        hasGeometryRef: !!geometryRef.current
      });
      
      return true;
    };
    
    return () => {
      delete (window as any).__directlySetGeometry;
    };
  }, []);

  // Add another useEffect to check for emergency geometry in localStorage
  useEffect(() => {
    console.log('🔵 [LocalStorage Check Effect] Running...');
    
    // Define the function inside useEffect so it has access to props/state
    const checkForEmergencyGeometry = () => {
      try {
        console.log('🔵 [LocalStorage Check Effect] Inside function checkForEmergencyGeometry.');
        const storedEmergencyGeometry = window.localStorage.getItem('emergencyGeometry');
        console.log(`🔵 [LocalStorage Check Effect] Found item in localStorage: ${!!storedEmergencyGeometry}`);

        if (!geometry && storedEmergencyGeometry) { // Access geometry state here
          console.log("🟢 [LocalStorage Check] Found emergency geometry in localStorage! Content:", storedEmergencyGeometry);
          const savedGeometry = JSON.parse(storedEmergencyGeometry);
          console.log("🟢 [LocalStorage Check] Parsed geometry:", savedGeometry);

          if (savedGeometry) {
            console.log("🟢 [LocalStorage Check] Parsed geometry is valid object.");

            // Create a proper geometry object
            let recoveredGeometry: any; // Declare recoveredGeometry here
            console.log(`🟢 [LocalStorage Check] Attempting to recover geometry of type: ${savedGeometry.type}`);

            if (savedGeometry.type === 'polygon' && savedGeometry.rings) {
              console.log("🟢 [LocalStorage Check] Recovering Polygon...");
              recoveredGeometry = new Polygon({ // Assuming Polygon is imported
                rings: savedGeometry.rings,
                spatialReference: savedGeometry.spatialReference
              });
            } else if (savedGeometry.type === 'point' && savedGeometry.x != null && savedGeometry.y != null) {
              console.log("🟢 [LocalStorage Check] Recovering Point...");
              recoveredGeometry = new Point({ // Assuming Point is imported
                x: savedGeometry.x,
                y: savedGeometry.y,
                spatialReference: savedGeometry.spatialReference
              });
            } else {
              console.warn("🟠 [LocalStorage Check] Unrecognized geometry type or missing data.");
            }

            if (recoveredGeometry) {
              console.log("🟢 [LocalStorage Check] Geometry recovered successfully. Preparing to set state...");
              // Set the geometry directly using state setters passed in dependency array
              setGeometry(recoveredGeometry);
              geometryRef.current = recoveredGeometry; // Ensure ref is also set
              setActiveStep('report'); // Ensure step is report
              setHasSelection(true); // Ensure selection state is true
              console.log("🟢 [LocalStorage Check] State updates requested (setGeometry, setActiveStep, setHasSelection). Ref updated.");

              // Clear emergency storage after successful recovery
              window.localStorage.removeItem('emergencyGeometry');
              console.log("🟢 [LocalStorage Check] ✅ Emergency geometry recovery complete & storage cleared.");
            } else {
               console.warn("🟠 [LocalStorage Check] Failed to create geometry object from parsed data.");
            }
          }
        } else {
          // Log why we didn't proceed
          if (geometry) console.log('🔵 [LocalStorage Check Effect] Skipping check: Geometry state already exists.');
          if (!storedEmergencyGeometry) console.log('🔵 [LocalStorage Check Effect] Skipping check: No emergency geometry found in localStorage.');
        }
      } catch (error) {
        console.warn("🟠 [LocalStorage Check Effect] Error during check/parse:", error);
        // Clear potentially corrupted storage
        try {
           window.localStorage.removeItem('emergencyGeometry');
           console.log("🟠 [LocalStorage Check Effect] Cleared potentially corrupted storage.");
        } catch (removeError) {
           console.error("🔴 [LocalStorage Check Effect] Failed to clear corrupted storage:", removeError);
        }
      }
    };

    // Check immediately on component mount/update
    checkForEmergencyGeometry();

  }, [geometry, setGeometry, setActiveStep, setHasSelection, geometryRef]); // Use correct state setters and refs in dependency array

  // Add a delayed check for emergency geometry to handle timing issues
  useEffect(() => {
    const delayedCheck = setTimeout(() => {
      console.log('🔵 [Delayed LocalStorage Check] Running delayed check...');
      try {
        const storedEmergencyGeometry = window.localStorage.getItem('emergencyGeometry');
        if (!geometry && storedEmergencyGeometry) {
          console.log('🟢 [Delayed LocalStorage Check] Found emergency geometry after delay!');
          const savedGeometry = JSON.parse(storedEmergencyGeometry);
          
          let recoveredGeometry: any;
          if (savedGeometry.type === 'polygon' && savedGeometry.rings) {
            recoveredGeometry = new Polygon({
              rings: savedGeometry.rings,
              spatialReference: savedGeometry.spatialReference
            });
          } else if (savedGeometry.type === 'point' && savedGeometry.x != null && savedGeometry.y != null) {
            recoveredGeometry = new Point({
              x: savedGeometry.x,
              y: savedGeometry.y,
              spatialReference: savedGeometry.spatialReference
            });
          }
          
          if (recoveredGeometry) {
            setGeometry(recoveredGeometry);
            geometryRef.current = recoveredGeometry;
            setActiveStep('report');
            setHasSelection(true);
            window.localStorage.removeItem('emergencyGeometry');
            console.log('🟢 [Delayed LocalStorage Check] ✅ Emergency geometry recovery complete');
          }
        }
      } catch (error) {
        console.warn('🟠 [Delayed LocalStorage Check] Error:', error);
      }
    }, 100); // 100ms delay
    
    return () => clearTimeout(delayedCheck);
  }, []); // Only run once on mount

  // Helper function to update the geometry ref

  // Add a global window function to force reporting with test data
  // This will be used for emergency situations when normal React state flow fails
  useEffect(() => {
    (window as any).forceReportWithTestGeometry = () => {
      console.log("🚨 EMERGENCY: Forcing report with test geometry");
      // Create a test polygon geometry
      const testGeometry = {
        type: "polygon",
        rings: [
          [
            [-122.68, 45.53],
            [-122.67, 45.53],
            [-122.67, 45.54],
            [-122.68, 45.54],
            [-122.68, 45.53]
          ]
        ],
        spatialReference: { wkid: 4326 }
      };
      
      // Set the geometry directly - bypassing all React state management
      setGeometry(testGeometry as any);
      if (geometryRef.current) {
        geometryRef.current = testGeometry as any;
      }
      setHasSelection(true);
      
      // Force to report step
      setActiveStep('report');
      
      // Force showing the modal immediately 
      setIsModalOpen(true);
      
      // Set report template if needed
      if (!reportTemplate) {
        setReportTemplate('whats-in-my-neighbourhood-km');
      }
      
      console.log("🚨 EMERGENCY ACTIONS COMPLETE", {
        activeStep: 'report',
        geometry: testGeometry,
        reportTemplate: reportTemplate || 'whats-in-my-neighbourhood-km'
      });
    };
    
    return () => {
      delete (window as any).forceReportWithTestGeometry;
    };
  }, [reportTemplate, setGeometry, geometryRef, setHasSelection, setActiveStep, setIsModalOpen, setReportTemplate]);

  // Add dedicated effect to track geometry state changes
  useEffect(() => {
    console.log('🔄 Geometry State Changed:', {
       hasGeometry: !!geometry,
       geometryType: geometry?.type,
       timestamp: new Date().toISOString()
    });
  }, [geometry]);

  // NEW simplified effect triggered by session storage flag (runs ONCE on mount)
  useEffect(() => {
    const popupTrigger = window.sessionStorage.getItem('popupTriggeredNavigation');

    if (popupTrigger) {
      console.log('🚀 [SessionStorage Effect] Detected popup navigation flag.');

      // Verify step is already report (due to initializer)
      // if (activeStep !== 'report') { ... } // REMOVE check - we now EXPECT it to be 'draw' initially

      // ADD: Force step to report now
      console.log('🚀 [SessionStorage Effect] Forcing activeStep to report...');
      setActiveStep('report');

      // 2. Immediately dispatch event to request geometry storage
      console.log('🚀 [SessionStorage Effect] Dispatching requestGeometry event...');
      const emergencyEvent = new CustomEvent('requestGeometry', {
        bubbles: true,
        composed: true
      });
      document.dispatchEvent(emergencyEvent);
    }
  }, []); // Run only once on mount

  // Handle the case where the popup navigation happens but we don't get geometry

  // Then do your conditional return
  if (!view || !layerStates) {
    return (
      <div className="p-4">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {!view ? "Loading map view..." : "Loading layer data..."}
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Return JSX
  return (
    <>
      {/* REMOVE THE DEBUG BANNER COMPLETELY */}
      
      <Card className="m-4 shadow-none border-0">
        <CardContent className="p-0">
          <div className="flex items-center justify-end mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetClick}
              title="Reset Tool"
              className="text-xs flex items-center gap-2 hover:bg-gray-100"
            >
              <RotateCcw className="h-3 w-3" />
              Reset
            </Button>
          </div>

          {/* Custom tab header that shows the current step */}
          <div className="grid grid-cols-3 gap-2 mb-4 w-full border rounded-lg overflow-hidden">
            <button 
              // Corrected className based ONLY on activeStep
              className={`px-4 py-2 text-xs ${activeStep === 'draw' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500'}`}
              onClick={() => {
                // Only go to draw step if we didn't come from popup and have no geometry
                if (!window.sessionStorage.getItem('popupTriggeredNavigation') && !geometry) {
                  setActiveStepWithPersistence('draw');
                }
              }}
              disabled={!!geometry || !!window.sessionStorage.getItem('popupTriggeredNavigation')}
              data-step="draw"
            >
              1. Draw
            </button>
            <button 
              // Corrected className based ONLY on activeStep
              className={`px-4 py-2 text-xs ${activeStep === 'buffer' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500'}`}
              onClick={() => {
                // Only allow clicking on buffer step if we have a point geometry
                if (geometry && geometry.type === 'point') {
                    setActiveStepWithPersistence('buffer');
                }
              }}
              disabled={!geometry || geometry.type !== 'point'}
              data-step="buffer"
            >
              2. Buffer
            </button>
            <button 
              // Corrected className based ONLY on activeStep
              className={`px-4 py-2 text-xs ${activeStep === 'report' ? 'bg-blue-50 text-blue-700 font-medium' : 'bg-gray-50 text-gray-500'}`}
              onClick={() => {
                // Always allow going to report step if geometry exists or from popup
                if (geometry || window.sessionStorage.getItem('popupTriggeredNavigation')) {
                    setActiveStepWithPersistence('report');
                }
              }}
              disabled={!geometry && !window.sessionStorage.getItem('popupTriggeredNavigation')}
              data-step="report"
            >
              3. Report
            </button>
          </div>

          {/* REVISED LOGIC: Prioritize activeStep for rendering */}
          {activeStep === 'draw' ? (
            <div className="space-y-4" data-stepcontent="draw">
              {/* Draw Step Content */} 
              <div className="bg-gray-50/50 px-4 py-3 rounded-lg border border-gray-100">
                <span className="text-xs text-gray-600">{getInstructionText()}</span>
              </div>
              <DrawingTools
                drawMode={drawMode}
                handleDrawButtonClick={handleDrawButtonClick}
                isDrawing={isDrawing}
                isSelectionMode={drawMode === 'click'}
                onSelectionComplete={handleSelectionComplete}
                hasSelectedFeature={drawing.hasHitFeature}
                shouldShowNext={true}
                selectedCount={drawing.selectedFeatureCount}
              />
            </div>
          ) : activeStep === 'buffer' ? (
            // Buffer Step Content (Check for point geometry inside)
            geometry && geometry.type === 'point' ? (
              <div className="space-y-4" data-stepcontent="buffer">
                <div className="bg-gray-50/50 px-4 py-3 rounded-lg border border-gray-100">
                  <span className="text-xs text-gray-600">Define the area around your point</span>
                </div>
                <BufferTools />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Distance</Label>
                    <Input
                      type="number"
                      value={bufferValue}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBufferValue(e.target.value)}
                      min="0"
                      step={bufferType === 'radius' ? "0.1" : "1"}
                      className="text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Unit</Label>
                    <Select
                      value={bufferUnit}
                      onValueChange={(value: 'miles' | 'kilometers' | 'minutes') => setBufferUnit(value)}
                    >
                      <SelectTrigger className="text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white">
                        {bufferType === 'radius' ? (
                          <>
                            <SelectItem value="kilometers" className="text-xs">Kilometers</SelectItem>
                          </>
                        ) : (
                          <>
                            <SelectItem value="minutes" className="text-xs">Minutes</SelectItem>
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setActiveStepWithPersistence('draw')}
                    className="flex-1 text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleCreateBuffer}
                    className="flex-1 text-xs"
                  >
                    Create Buffer
                    <ChevronRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            ) : (
              // Fallback if buffer step is active but geometry is not a point (should not normally happen)
              <div className="p-4 text-center text-gray-500">
                <p>Cannot buffer this geometry type. Please reset and draw a point.</p>
              </div>
            )
          ) : activeStep === 'report' ? (
            // Report Step Content
            <div className="space-y-4" data-stepcontent="report">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-xs">Report Template</Label>
                  <Button
                    onClick={handleDialogOpen}
                    className="w-full text-xs bg-[#33a852] hover:bg-[#2d8f47] text-white"
                  >
                    {reports.find((r: Report) => r.id === reportTemplate)?.title || 'Choose a Report Template'}
                  </Button>
                  <ReportSelectionDialog
                    open={isDialogOpen}
                    reports={reports}
                    onClose={handleDialogClose}
                    onSelect={handleReportSelect as any}
                  />
                </div>
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (geometry) {
                        const geo = geometry as any;
                        if (geo.type === 'point') {
                          setActiveStepWithPersistence('buffer');
                        } else {
                          // If not a point, go back to draw (allow redraw/new shape)
                          setActiveStepWithPersistence('draw');
                        }
                      } else {
                        // If no geometry, always go back to draw
                        setActiveStepWithPersistence('draw');
                      }
                    }}
                    className="flex-1 text-xs"
                  >
                    Back
                  </Button>
                  <Button
                    onClick={handleGenerateReport} // Should this open the modal?
                    className="flex-1 text-xs"
                    // disabled={!(geometryRef.current || (activeStep === 'report' && navigatedFromPopupRef.current))} // Enable if ref has geometry OR we just navigated
                    disabled={!geometry} // Use geometry state for stability
                  >
                    Generate Report
                    <ChevronRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Fallback if step is unknown (should not happen)
            <div className="p-4 text-center text-gray-500">
              <p>Invalid state. Please reset.</p>
            </div>
          )}
        </CardContent>
      </Card>
      <ReportModal />
    </>
  );
}