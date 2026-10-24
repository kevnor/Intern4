import { Button } from '../../../shared/components';

// Microsoft's four-square mark, in its own colours so it reads in light and dark themes.
const MicrosoftMark = () => (
  <svg aria-hidden="true" viewBox="0 0 21 21" className="h-5 w-5">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" />
    <rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" />
    <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

type MicrosoftSignInButtonProps = {
  onClick: () => void;
  loading?: boolean;
  disabled?: boolean;
};

const MicrosoftSignInButton = ({ onClick, loading, disabled }: MicrosoftSignInButtonProps) => (
  <Button
    type="button"
    size="lg"
    fullWidth
    variant="secondary"
    icon={<MicrosoftMark />}
    onClick={onClick}
    loading={loading}
    disabled={disabled}
  >
    Logg inn med Microsoft
  </Button>
);

export default MicrosoftSignInButton;
