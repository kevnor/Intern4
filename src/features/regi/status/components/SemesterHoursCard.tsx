import React, { useEffect, useState } from 'react';
import { useSemesterHours } from '../../hooks/useSemesterHours';
import { Button, Card, Field, Input, StatusMessage } from '../../../../shared/components';
import { getSemesterName } from '../../../../shared/utils/semester';

type SemesterHoursCardProps = {
  onSaved?: () => void;
};

// Lets an administrator set how many hours every resident owes this semester. Halv/Halv residents
// do half as regi and half as vakt.
const SemesterHoursCard: React.FC<SemesterHoursCardProps> = ({ onSaved }) => {
  const { totalHours, loading, save } = useSemesterHours();
  const [value, setValue] = useState(String(totalHours));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setValue(String(totalHours));
  }, [totalHours]);

  const hours = Number(value);
  const invalid = value.trim() === '' || !Number.isFinite(hours) || hours < 0;
  const unchanged = !invalid && hours === totalHours;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    try {
      setSaving(true);
      setMessage(null);
      await save(hours);
      setMessage({ tone: 'success', text: 'Timekravet er lagret.' });
      onSaved?.();
    } catch (error) {
      console.error(error);
      setMessage({ tone: 'error', text: 'Kunne ikke lagre timekravet.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card
      title="Timekrav"
      description={`${getSemesterName()} · Antall timer hver beboer skal gjøre dette semesteret.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <Field
          label="Timer per semester"
          hint="Halv/Halv gjør halvparten som regi og halvparten som vakt."
          error={invalid ? 'Skriv inn et tall på 0 eller mer.' : undefined}
          className="sm:w-72"
        >
          {(controlProps) => (
            <Input
              {...controlProps}
              type="number"
              min={0}
              step="0.5"
              inputMode="decimal"
              value={value}
              disabled={loading}
              invalid={invalid}
              onChange={(event) => setValue(event.target.value)}
            />
          )}
        </Field>
        <Button type="submit" disabled={loading || saving || invalid || unchanged}>
          {saving ? 'Lagrer...' : 'Lagre'}
        </Button>
      </form>
      {message && (
        <StatusMessage tone={message.tone} className="mt-3">
          {message.text}
        </StatusMessage>
      )}
    </Card>
  );
};

export default SemesterHoursCard;
