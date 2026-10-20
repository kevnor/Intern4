import { Mail, MessageSquare, Phone } from 'lucide-react';
import { toPhoneHref } from '../../../shared/utils/phone';
import { cn } from '../../../shared/utils/cn';

const contactButtonClasses =
  'relative z-10 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-surface text-primary transition-colors hover:bg-primary-subtle';

type ContactActionsProps = {
  name: string;
  phone?: string;
  email?: string;
  className?: string;
};

// Call, SMS and e-mail shortcuts. z-10 keeps them clickable above a stretched card link.
const ContactActions = ({ name, phone, email, className }: ContactActionsProps) => (
  <div className={cn('flex gap-2', className)}>
    {phone && (
      <>
        <a
          href={`tel:${toPhoneHref(phone)}`}
          aria-label={`Ring ${name}`}
          className={contactButtonClasses}
        >
          <Phone aria-hidden="true" className="h-5 w-5" />
        </a>
        <a
          href={`sms:${toPhoneHref(phone)}`}
          aria-label={`Send SMS til ${name}`}
          className={contactButtonClasses}
        >
          <MessageSquare aria-hidden="true" className="h-5 w-5" />
        </a>
      </>
    )}
    {email && (
      <a
        href={`mailto:${email}`}
        aria-label={`Send e-post til ${name}`}
        className={contactButtonClasses}
      >
        <Mail aria-hidden="true" className="h-5 w-5" />
      </a>
    )}
  </div>
);

export default ContactActions;
