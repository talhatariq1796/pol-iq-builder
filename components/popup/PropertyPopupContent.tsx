import React, { useState, useEffect, useCallback } from 'react';
import Graphic from '@arcgis/core/Graphic';
import { getPropertyImageUrl } from '../../lib/utils/image-resolver';
import { formatPropertyAddress } from '@/lib/utils/addressFormatter';
import { ZoomIn, BarChart3, MapPin, Bed, Bath, Home } from 'lucide-react';
import { extractPropertyParams } from '@/components/cma/utils/autoFilterUtils';
import type { PropertyParams } from '@/components/cma/types';
import './popup-styles.css';

interface PropertyPopupContentProps {
  feature: Graphic;
  onClose?: () => void;
  onZoom?: (feature: Graphic) => void;
  onCMA?: (propertyParams: PropertyParams) => void; // Changed: Now receives extracted params
}

interface PropertyInfo {
  centris_no?: string | number;
  address?: string;
  municipality?: string;
  postal_code?: string;
  // Updated field names based on debug data
  asked_price?: number;
  is_sold?: number; // 0 = not sold, 1 = sold
  price?: number | string;
  price_display?: string;
  askedsold_price?: number;
  original_sale_price?: number;
  status?: string;
  st?: string;
  // Room counts using correct field names
  bedrooms?: number;
  bathrooms?: number;
  bedrooms_number?: number;
  bathrooms_number?: number;
  powder_rooms_number?: number;
  municipalityborough?: string;
  property_type?: string;
  pt?: string;
  year_built?: number;
  lot_size?: string;
  living_area?: number;
  BUILDING_AREA?: number; // Alternative field name from debug data
  building_size?: string;
  basement?: string;
  civic_number?: number;
  apartment?: string;
  date_bc?: string;
  mls_number?: string | number;
  image_count?: number;
  listing_agent?: string;
  garage_spaces?: number;
  garage_type?: string;
  heating_type?: string;
  cooling_type?: string;
  days_on_market?: number;
  [key: string]: any;
}

const PropertyPopupContent: React.FC<PropertyPopupContentProps> = ({
  feature,
  onClose,
  onZoom,
  onCMA
}) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const attrs = (feature.attributes || {}) as PropertyInfo;
  const centrisNo = attrs.centris_no?.toString() || '';

  // Get property image URL - use centris_no which matches our image naming convention
  const getImageUrl = (): string => {
    // Use centris_no as it matches our blob storage naming: CentrisNo_[centris_no]_01.jpg
    if (centrisNo && centrisNo !== '0') {
      return getPropertyImageUrl(centrisNo, '/images/property-placeholder.jpg');
    }
    
    // Try mls_number as fallback (in case centris_no is missing)
    const mlsNumber = attrs.mls_number?.toString();
    if (mlsNumber && mlsNumber !== '0') {
      return getPropertyImageUrl(mlsNumber, '/images/property-placeholder.jpg');
    }
    
    return '/images/property-placeholder.jpg';
  };
  
  const imageUrl = getImageUrl();

  // Format price for display - use asked_price and is_sold from debug data
  const formatPrice = (): string => {
    // Use is_sold field from debug data (0 = not sold, 1 = sold)
    const isSold = attrs.is_sold === 1;
    
    // Use asked_price field from debug data
    let priceValue: string | undefined;
    
    if (attrs.asked_price && attrs.asked_price > 0) {
      priceValue = `$${attrs.asked_price.toLocaleString()}`;
    } else if (attrs.price_display) {
      priceValue = attrs.price_display;
    } else if (attrs.askedsold_price) {
      priceValue = `$${attrs.askedsold_price.toLocaleString()}`;
    } else if (typeof attrs.price === 'number' && attrs.price > 0) {
      priceValue = `$${attrs.price.toLocaleString()}`;
    } else if (typeof attrs.price === 'string' && attrs.price !== 'Price Available on Request') {
      priceValue = attrs.price;
    }
    
    if (priceValue) {
      if (isSold) {
        return `Sold: ${priceValue}`;
      } else {
        return `Asking: ${priceValue}`;
      }
    }
    
    return 'Price Available on Request';
  };

  // Get property status - use is_sold field from debug data
  const getStatus = (): { text: string; className: string; show: boolean } => {
    const isSold = attrs.is_sold === 1;
    
    if (isSold) {
      return { text: 'Sold', className: 'status-sold', show: true };
    } else {
      return { text: 'Active', className: 'status-active', show: true };
    }
  };

  const status = getStatus();

  // Handle image load events
  const handleImageLoad = () => {
    setImageLoaded(true);
    setImageError(false);
  };

  const handleImageError = () => {
    setImageLoaded(false);
    setImageError(true);
  };

  // Handle button clicks
  const handleZoomClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onZoom) {
      onZoom(feature);
    }
  };

  // Single extraction point for CMA - extract params once and pass downstream
  const handleCMAClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onCMA) {
      // Extract property params ONCE here - this is the single source of truth
      const params = extractPropertyParams(feature);
      console.log('[PropertyPopupContent] ✅ CMA triggered - single extraction:', {
        centrisNo: params.centrisNo,
        address: params.address,
        price: params.price,
        bedrooms: params.bedrooms
      });
      onCMA(params);
    }
  }, [feature, onCMA]);

  const handleCloseClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onClose) {
      onClose();
    }
  };

  // Simple property details for list format - using correct field names from debug data
  const propertyDetails = [
    {
      label: 'Bedrooms',
      value: attrs.bedrooms || attrs.bedrooms_number
    },
    {
      label: 'Bathrooms', 
      value: attrs.bathrooms || attrs.bathrooms_number
    },
    {
      label: 'Powder Rooms',
      value: attrs.powder_rooms_number
    },
    {
      label: 'Building Size',
      value: attrs.building_size
    },
    {
      label: 'Square Footage',
      value: attrs.living_area ? `${attrs.living_area.toLocaleString()} sq ft` : 
             attrs.BUILDING_AREA ? `${attrs.BUILDING_AREA.toLocaleString()} sq ft` : null
    },
    {
      label: 'Property Type',
      value: attrs.property_type || attrs.pt
    },
    {
      label: 'Basement',
      value: attrs.basement
    },
    {
      label: 'Civic Number',
      value: attrs.civic_number
    },
    {
      label: 'Apartment',
      value: attrs.apartment && String(attrs.apartment).trim() ? String(attrs.apartment).trim() : null
    }
  ].filter(detail => detail.value !== undefined && detail.value !== null && detail.value !== '' && detail.value !== 0);

  // Additional detailed information
  const additionalDetails = [
    {
      label: 'Lot Size',
      value: attrs.lot_size
    },
    {
      label: 'Year Built',
      value: attrs.year_built
    },
    {
      label: 'Days on Market',
      value: attrs.days_on_market
    },
    {
      label: 'MLS Number',
      value: attrs.mls_number
    },
    {
      label: 'Original Sale Price',
      value: attrs.original_sale_price ? `$${attrs.original_sale_price.toLocaleString()}` : null
    },
    {
      label: 'Date BC',
      value: attrs.date_bc
    },
    {
      label: 'Listing Agent',
      value: attrs.listing_agent
    },
    {
      label: 'Garage',
      value: attrs.garage_spaces ? `${attrs.garage_spaces} spaces` : attrs.garage_type
    },
    {
      label: 'Heating',
      value: attrs.heating_type
    },
    {
      label: 'Cooling',
      value: attrs.cooling_type
    }
  ].filter(detail => detail.value !== undefined && detail.value !== null && detail.value !== '' && detail.value !== 0);

  return (
    <div className="property-popup-container">
      {/* Property Image Section */}
      <div className="property-image-section">
        {imageUrl && !imageError ? (
          <img
            src={imageUrl}
            alt={`Property at ${attrs.address || 'Unknown Address'}`}
            className="property-image"
            onLoad={handleImageLoad}
            onError={handleImageError}
            style={{
              opacity: imageLoaded ? 1 : 0.7,
              transition: 'opacity 0.3s ease'
            }}
          />
        ) : (
          <div className="property-image-placeholder">
            <Home size={32} className="placeholder-icon" />
            <span>No Image Available</span>
          </div>
        )}
        
        {/* Close button overlay */}
        <button 
          className="property-close-button"
          onClick={handleCloseClick}
          aria-label="Close popup"
        >
          ×
        </button>
      </div>

      {/* Property Details Section */}
      <div className="property-details-section">
        {/* Full Address as title - using correct field names with unit number support */}
        <h3 className="property-address">
          {formatPropertyAddress({
            address: [attrs.address, attrs.municipality || attrs.municipalityborough, attrs.postal_code]
              .filter(Boolean)
              .join(', ') || 'Property Address',
            propertyType: attrs.property_type || attrs.pt,
            unit_number: attrs.apartment,
            suite_number: attrs.apartment,
            apt_number: attrs.apartment
          })}
        </h3>

        {/* Price */}
        <div className="property-price">
          {formatPrice()}
        </div>

        {/* Status Badge - only show if meaningful */}
        {status.show && (
          <div className={`property-status-badge ${status.className}`}>
            {status.text}
          </div>
        )}

        {/* Simple Property Details List */}
        <div className="property-details-list">
          {propertyDetails.map((detail, index) => (
            <div key={index} className="detail-item">
              <span className="detail-label">{detail.label}:</span>
              <span className="detail-value">{detail.value}</span>
            </div>
          ))}
          
          {/* Additional details from the original additionalDetails array */}
          {additionalDetails.map((detail, index) => (
            <div key={`additional-${index}`} className="detail-item">
              <span className="detail-label">{detail.label}:</span>
              <span className="detail-value">{detail.value}</span>
            </div>
          ))}
        </div>

        {/* Centris Number and MLS Number */}
        <div className="property-identifiers">
          {centrisNo && (
            <div className="property-centris-number">
              Centris #: {centrisNo}
            </div>
          )}
          {attrs.mls_number && (
            <div className="property-mls-number">
              MLS #: {attrs.mls_number}
            </div>
          )}
        </div>
        
      </div>

      {/* Action Buttons */}
      <div className="property-actions">
        <button 
          className="property-action-button property-zoom-button"
          onClick={handleZoomClick}
          type="button"
        >
          <ZoomIn size={16} />
          <span>Zoom to Property</span>
        </button>
        
        <button 
          className="property-action-button property-cma-button"
          onClick={handleCMAClick}
          type="button"
        >
          <BarChart3 size={16} />
          <span>CMA</span>
        </button>
      </div>
    </div>
  );
};

export default PropertyPopupContent;
export type { PropertyPopupContentProps, PropertyInfo };