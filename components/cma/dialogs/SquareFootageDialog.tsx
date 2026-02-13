"use client";

import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Ruler, Home } from 'lucide-react';

interface SquareFootageDialogProps {
  isOpen: boolean;
  onSubmit: (sqft: number) => void;
  onCancel: () => void;
  propertyType: string;
  suggestedRange?: { min: number; max: number };
}

/**
 * Square Footage Dialog
 *
 * Prompts user to enter square footage when clicking on map without selecting
 * a specific property. Used for condos/apartments where unit size varies.
 *
 * Features:
 * - Default value: 1000 sqft
 * - Validation: 100-10000 sqft range
 * - Suggested range based on property type
 * - Cancel and submit actions
 *
 * @param isOpen - Controls dialog visibility
 * @param onSubmit - Callback when user submits square footage
 * @param onCancel - Callback when user cancels
 * @param propertyType - Type of property (e.g., "condo", "apartment")
 * @param suggestedRange - Optional suggested sqft range for property type
 */
export function SquareFootageDialog({
  isOpen,
  onSubmit,
  onCancel,
  propertyType,
  suggestedRange
}: SquareFootageDialogProps) {
  const [squareFootage, setSquareFootage] = useState<number>(1000);
  const [error, setError] = useState<string>('');

  const handleSubmit = () => {
    // Validate square footage
    if (squareFootage < 100) {
      setError('Square footage must be at least 100 sqft');
      return;
    }
    if (squareFootage > 10000) {
      setError('Square footage must be less than 10,000 sqft');
      return;
    }

    setError('');
    onSubmit(squareFootage);
  };

  const handleCancel = () => {
    setError('');
    setSquareFootage(1000); // Reset to default
    onCancel();
  };

  const getSuggestedRangeText = () => {
    if (suggestedRange) {
      return `Typical range: ${suggestedRange.min.toLocaleString()}-${suggestedRange.max.toLocaleString()} sqft`;
    }

    // Default ranges by property type
    const ranges: Record<string, string> = {
      condo: '600-1,500 sqft',
      apartment: '500-1,200 sqft',
      townhouse: '1,200-2,000 sqft',
      loft: '800-2,500 sqft'
    };

    return `Typical range: ${ranges[propertyType.toLowerCase()] || '600-1,500 sqft'}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleCancel()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Ruler className="h-5 w-5 text-blue-600" />
            Enter Square Footage
          </DialogTitle>
          <DialogDescription className="text-sm">
            You clicked a location without selecting a specific property.
            Please enter the approximate square footage for this {propertyType}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="sqft" className="text-sm font-medium">
              Square Footage
            </Label>
            <div className="relative">
              <Input
                id="sqft"
                type="number"
                min="100"
                max="10000"
                step="50"
                value={squareFootage}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  setSquareFootage(Number(e.target.value));
                  setError(''); // Clear error on change
                }}
                className={`text-right text-lg font-semibold ${error ? 'border-red-500' : ''}`}
                placeholder="1000"
                autoFocus
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">
                sqft
              </div>
            </div>
            {error && (
              <p className="text-xs text-red-600">{error}</p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Home className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-blue-800">
                <div className="font-medium mb-1">Suggested Range</div>
                <div>{getSuggestedRangeText()}</div>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600 space-y-1">
            <div>• This will be used to estimate property price</div>
            <div>• You can adjust this later if needed</div>
            <div>• Price = Square Footage × Average $/sqft</div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={handleCancel}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            Continue with {squareFootage.toLocaleString()} sqft
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
