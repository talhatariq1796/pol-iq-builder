import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { iconTypeOptions, IconType } from '@/lib/utils/iconMapping';

interface IconStyleSelectorProps {
  currentIconType: IconType;
  onIconTypeChange: (iconType: IconType) => void;
  className?: string;
}

export const IconStyleSelector: React.FC<IconStyleSelectorProps> = ({
  currentIconType,
  onIconTypeChange,
  className = ''
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Analysis Icons</CardTitle>
        <CardDescription>
          Choose the icon style for analysis sections and messages
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={currentIconType}
          onValueChange={(value: any) => onIconTypeChange(value as IconType)}
          className="space-y-3"
        >
          {iconTypeOptions.map((option) => (
            <div key={option.value} className="flex items-start space-x-3">
              <RadioGroupItem 
                value={option.value} 
                id={option.value}
                className="mt-1"
              />
              <div className="flex-1">
                <Label 
                  htmlFor={option.value}
                  className="text-sm font-medium cursor-pointer"
                >
                  {option.label}
                </Label>
                <p className="text-xs text-gray-600 mt-1">
                  {option.description}
                </p>
                {/* Preview of icons */}
                <div className="mt-2 text-sm">
                  <span className="text-gray-500">Preview: </span>
                  {option.value === 'emoji' && '📊 📈 🎯'}
                  {option.value === 'modern-emoji' && '📈 📊 🔍'}
                  {option.value === 'lucide' && '📊→ 📈→ 🎯→ (Professional icons)'}
                </div>
              </div>
            </div>
          ))}
        </RadioGroup>
        
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-xs text-blue-800">
            💡 <strong>Tip:</strong> Modern Emojis provide a more professional look while maintaining visual appeal. 
            Lucide Icons offer the most consistent experience with the rest of the interface.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};