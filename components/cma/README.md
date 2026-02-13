# CMA Components Architecture

## ⚠️ CRITICAL: Two Separate CMA Component Trees

This directory contains **TWO independent CMA implementations** that both use shared components but have separate lifecycles:

### 1. CMAInterface (Full-Featured)

**File**: `CMAInterface.tsx`  
**Used By**: `UnifiedAnalysisWorkflow.tsx` (main analysis workflow)  

**Features**:

- Complete CMA analysis with report generation
- Chart generation via `useChartGeneration` hook
- Property comparison and statistics
- PDF report export
- Integrates with unified analysis workflow

**Props**:

```typescript
interface CMAInterfaceProps {
  selectedArea?: AreaSelection;
  selectedProperty?: __esri.Graphic;
  onAreaSelectionRequired?: () => void;
  bufferConfig?: { type: 'radius' | 'drivetime' | 'walktime'; value: number; unit: 'km' | 'minutes' };
  mapView?: __esri.MapView;
}
```

### 2. CMACard (Simplified/Active)
**File**: `CMACard.tsx`  
**Used By**: Property popups, map interactions, standalone CMA widgets  
**Features**:
- Simplified card-based UI
- Buffer selection dialog
- Property filtering
- Quick report generation
- Independent from workflow system

**Props**:
```typescript
interface CMACardProps {
  selectedArea?: AreaSelection;
  onAreaSelectionRequired?: () => void;
  isSelected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  fromPopup?: boolean;
  forceBufferDialog?: boolean;
  onCMADataChange?: (data: { bufferConfig: CMABufferConfig; properties: any[]; stats: any; filters: CMAFilters }) => void;
  selectedProperty?: __esri.Graphic;
}
```

## Shared Components

Both implementations use these shared components:

### CMAFilterDialog
**File**: `CMAFilterDialog.tsx`  
**Purpose**: Property filtering UI (type, status, ranges)  
**Used By**: Both CMAInterface and CMACard

### CMAReport
**File**: `CMAReport.tsx`  
**Purpose**: PDF report generation with charts and analysis  
**Used By**: Both CMAInterface and CMACard

### useCMAAnalysis Hook
**File**: `hooks/useCMAAnalysis.ts`  
**Purpose**: Data fetching from CMA API, property transformation  
**Used By**: Both CMAInterface and CMACard

## Critical Implementation Details

### Client-Side Filtering (⚠️ MUST BE IN BOTH COMPONENTS)

Both `CMAInterface` and `CMACard` implement **inline client-side filtering** for the `listingStatus` field:

```typescript
// INLINE CLIENT-SIDE FILTERING for listingStatus
const filteredProperties = React.useMemo(() => {
  if (filters.listingStatus === 'both') {
    return properties;
  }

  const filtered = properties.filter(property => {
    const isSold = property.st === 'SO' || property.st === 'so' || 
                   property.st?.toUpperCase() === 'SO' || 
                   property.status === 'sold';
    return (
      (filters.listingStatus === 'sold' && isSold) ||
      (filters.listingStatus === 'active' && !isSold)
    );
  });

  return filtered;
}, [properties, filters.listingStatus]);
```

**Why Inline?**
- API always returns ALL properties (`listingStatus: 'both'`)
- Client-side filtering provides instant response (no re-fetch)
- Previous attempt to use separate `useCMAData` hook failed due to bundling issues

**Important**: When updating filter logic:
1. ✅ Update `CMACard.tsx` first (this is the active component)
2. ✅ Update `CMAInterface.tsx` to keep in sync
3. ✅ Test both components separately
4. ✅ Check that `propertiesCount={filteredProperties.length}` is passed to dialog

### API Integration

**Key Files**:
- `hooks/useCMAAnalysis.ts` - Main data fetching hook
- `app/api/comparative-market-analysis/route.ts` - API endpoint

**Data Flow**:
```
User Selection
    ↓
useCMAAnalysis Hook
    ↓
API Call (listingStatus: 'both' - always!)
    ↓
Property Transformation (preserve 'st' field)
    ↓
Client-Side Filtering (CMACard/CMAInterface useMemo)
    ↓
Filtered Properties → CMAFilterDialog
```

### Filter Reset Loop Prevention

The `CMAFilterDialog` has logic to prevent filter reset loops:

```typescript
React.useEffect(() => {
  // Skip if we have pending changes - prevents reset loop
  if (isPendingFilterChange) {
    return;
  }
  
  if (filters) {
    setLocalFilters({ ...filters });
  }
}, [filters, activeRanges, isPendingFilterChange]);
```

**Why?** When user changes a filter → dialog debounces → sends to parent → parent updates prop → would trigger reset without this guard.

## Common Issues & Solutions

### Issue: Filter not working after changes
**Solution**: Make sure you updated **both** `CMACard.tsx` AND `CMAInterface.tsx`

### Issue: Property count not changing
**Check**:
1. Is `filteredProperties` being used instead of `properties`?
2. Is `propertiesCount={filteredProperties.length}` passed to dialog?
3. Are console logs showing filter execution?

### Issue: Filter resets when changing property type
**Solution**: Verify `isPendingFilterChange` guard is in place in `CMAFilterDialog` useEffect

### Issue: No `st` field on properties
**Check**: `useCMAAnalysis.ts` line ~281 and ~337 - ensure `st` field is preserved during transformation

## Testing Checklist

When modifying CMA filtering:

- [ ] Test `CMACard` with property popup
- [ ] Test `CMAInterface` in unified workflow
- [ ] Test filter: Both → shows all properties
- [ ] Test filter: Sold → shows only sold (st === 'SO')
- [ ] Test filter: Active → shows only active (st !== 'SO')
- [ ] Test property type change → filter persists
- [ ] Test chart generation with filtered properties
- [ ] Test report generation with filtered properties
- [ ] Check console for filter execution logs
- [ ] Verify no API re-fetch when changing listing status

## File Structure

```
components/cma/
├── CMACard.tsx              # ⚡ Active component - used by popups
├── CMAInterface.tsx         # Full-featured - used by workflow
├── CMAFilterDialog.tsx      # Shared filter UI
├── CMAReport.tsx            # Shared report generation
├── CMABufferSelectionDialog.tsx  # Buffer config (CMACard only)
├── SimplifiedPropertyTypeFilter.tsx  # Property type selector
├── RevenuePropertyFilters.tsx  # Revenue-specific filters
├── propertyTypeConfig.ts    # Type mapping utilities
├── types.ts                 # Shared TypeScript types
├── hooks/
│   ├── useCMAAnalysis.ts   # Main data fetching hook
│   └── useCMAData.ts       # DEPRECATED (bundling issues)
├── services/
│   └── PropertyDataService.ts  # Property data loading
└── utils/
    └── autoFilterUtils.ts   # Auto-generate filters from property

```

## Recent Changes

**November 13, 2025**:
- ✅ Added inline client-side filtering to `CMACard.tsx`
- ✅ Added inline client-side filtering to `CMAInterface.tsx`
- ✅ Fixed filter reset loop with `isPendingFilterChange` guard
- ✅ API now always sends `listingStatus: 'both'`
- ✅ Removed `listingStatus` from useEffect dependencies in `useCMAAnalysis`
- ⚠️ Deprecated `useCMAData` hook due to webpack bundling issues

## Future Improvements

- [ ] Consider unifying `CMACard` and `CMAInterface` into single component with mode prop
- [ ] Extract filtering logic into reusable utility function
- [ ] Add unit tests for filter logic
- [ ] Add E2E tests for both component trees
- [ ] Document field name variations and mapping logic
- [ ] Add TypeScript strict mode compliance
