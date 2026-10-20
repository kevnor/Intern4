import { Modal } from '../../../shared/components';
import WorkLogForm from '../my-regi/components/WorkLogForm';
import { useWorkLogFormWorkflow } from '../my-regi/hooks/useWorkLogFormWorkflow';
import GrantRegiForm from '../granting/components/GrantRegiForm';

type RegisterHoursSheetProps = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

export const RegisterHoursSheet = ({ open, onClose, onCreated }: RegisterHoursSheetProps) => {
  const workflow = useWorkLogFormWorkflow();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Registrer timer"
      description="Timene sendes til regisjefen for godkjenning."
      size="lg"
      fullScreenOnMobile
    >
      <WorkLogForm {...workflow} hideHeading onCreated={onCreated} />
    </Modal>
  );
};

type GrantRegiSheetProps = {
  open: boolean;
  userId?: string;
  onClose: () => void;
  onCreated: () => void;
};

export const GrantRegiSheet = ({ open, userId, onClose, onCreated }: GrantRegiSheetProps) => (
  <Modal
    open={open}
    onClose={onClose}
    title="Gi regi"
    description="Timene registreres og godkjennes med en gang, med deg som godkjenner."
    size="lg"
    fullScreenOnMobile
  >
    {/* Keyed so reopening for another resident starts from a fresh form. */}
    <GrantRegiForm key={userId ?? 'any'} initialUserId={userId} hideHeading onCreated={onCreated} />
  </Modal>
);
