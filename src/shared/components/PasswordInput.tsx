import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Field';
import { cn } from '../utils/cn';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type'>;

export const PasswordInput = ({ className, ...props }: PasswordInputProps) => {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <Input {...props} type={visible ? 'text' : 'password'} className={cn('pr-12', className)} />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Skjul passord' : 'Vis passord'}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-subtle hover:text-fg"
      >
        {visible ? (
          <EyeOff aria-hidden="true" className="h-5 w-5" />
        ) : (
          <Eye aria-hidden="true" className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};
