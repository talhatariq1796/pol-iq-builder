import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, X } from 'lucide-react';

interface QueryCondition {
  field: string;
  operator: string;
  value: string;
}

interface QueryBuilderProps {
  onQueryChange: (query: string) => void;
}

export default function QueryBuilder({ onQueryChange }: QueryBuilderProps) {
  const [conditions, setConditions] = useState<QueryCondition[]>([]);

  const fields = [
    { value: 'thematic_value', label: 'Pet Ownership Rate' },
    { value: 'admin4_name', label: 'Neighborhood' },
    { value: 'admin3_name', label: 'District' }
  ];

  const operators = [
    { value: '>', label: 'Greater than' },
    { value: '<', label: 'Less than' },
    { value: '=', label: 'Equals' },
    { value: 'LIKE', label: 'Contains' },
    { value: 'BETWEEN', label: 'Between' }
  ];

  const addCondition = () => {
    setConditions([...conditions, { field: 'thematic_value', operator: '>', value: '' }]);
  };

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index));
  };

  const updateCondition = (index: number, updates: Partial<QueryCondition>) => {
    const newConditions = conditions.map((condition, i) => 
      i === index ? { ...condition, ...updates } : condition
    );
    setConditions(newConditions);
    
    // Build and emit the SQL query
    const query = newConditions
      .map(({ field, operator, value }) => {
        if (operator === 'LIKE') {
          return `${field} LIKE '%${value}%'`;
        } else if (operator === 'BETWEEN') {
          const [min, max] = value.split(',');
          return `${field} BETWEEN ${min} AND ${max}`;
        } else {
          return `${field} ${operator} ${value}`;
        }
      })
      .join(' AND ');
    
    onQueryChange(query);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-medium">Query Builder</h3>
        <Button 
          size="sm" 
          variant="outline" 
          onClick={addCondition}
          className="flex items-center gap-1"
        >
          <Plus className="h-4 w-4" />
          Add Condition
        </Button>
      </div>
      
      <div className="space-y-2">
        {conditions.map((condition, index) => (
          <div key={index} className="flex items-center gap-2">
            <Select
              value={condition.field}
              onValueChange={(value) => updateCondition(index, { field: value })}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fields.map((field) => (
                  <SelectItem key={field.value} value={field.value}>
                    {field.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={condition.operator}
              onValueChange={(value) => updateCondition(index, { operator: value })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op.value} value={op.value}>
                    {op.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              value={condition.value}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => updateCondition(index, { value: e.target.value })}
              className="flex-1"
              placeholder={condition.operator === 'BETWEEN' ? "min,max" : "value"}
            />

            <Button
              size="icon"
              variant="ghost"
              onClick={() => removeCondition(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}