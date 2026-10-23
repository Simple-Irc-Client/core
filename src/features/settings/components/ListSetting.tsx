import { useState } from 'react';
import { X } from 'lucide-react';
import { Badge } from '@shared/components/ui/badge';
import { Button } from '@shared/components/ui/button';
import { Input } from '@shared/components/ui/input';
import { Label } from '@shared/components/ui/label';

interface ListSettingProps {
  id: string;
  label: string;
  placeholder: string;
  addLabel: string;
  removeLabel: (item: string) => string;
  items: string[];
  /** False keeps the typed text, for the user to correct */
  onAdd: (value: string) => boolean;
  onRemove: (item: string) => void;
}

const ListSetting = ({ id, label, placeholder, addLabel, removeLabel, items, onAdd, onRemove }: ListSettingProps) => {
  const [newItem, setNewItem] = useState('');

  const handleAdd = (): void => {
    const value = newItem.trim();
    if (value.length > 0 && onAdd(value)) {
      setNewItem('');
    }
  };

  return (
    <>
      <div className="col-span-full grid grid-cols-subgrid items-center">
        <Label htmlFor={id} className="text-right">
          {label}
        </Label>
        <Input
          id={id}
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          className="col-span-2"
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAdd();
            }
          }}
        />
        <Button type="button" variant="outline" size="sm" onClick={handleAdd}>
          {addLabel}
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="col-span-3 col-start-2 flex flex-wrap gap-2" data-testid={`${id}-list`}>
          {items.map((item) => (
            <li key={item}>
              <Badge variant="secondary" className="gap-1 pr-1 font-normal">
                {item}
                <button
                  type="button"
                  onClick={() => onRemove(item)}
                  aria-label={removeLabel(item)}
                  className="rounded-sm opacity-70 hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </>
  );
};

export default ListSetting;
