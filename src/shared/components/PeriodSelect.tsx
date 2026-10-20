import { controlClasses } from './Field';

type PeriodOption = {
  value: string;
  label: string;
};

type PeriodSelectProps = {
  value: string;
  options: PeriodOption[];
  onChange: (value: string) => void;
};

export const PeriodSelect = ({ value, options, onChange }: PeriodSelectProps) => (
  <select
    value={value}
    onChange={(event) => onChange(event.target.value)}
    className={controlClasses(false, 'min-h-10 w-auto py-2 pr-8')}
  >
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);
