import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatDay } from '../../../server/dao/unavailabilityDAO';
import type { useUnavailability } from '../hooks/useUnavailability';
import { Button, Card, Field, Input, StatusMessage } from '../../../shared/components';
import { formatDate } from '../../../shared/utils/date';

type UnavailabilityCardProps = {
  unavailability: ReturnType<typeof useUnavailability>;
  today?: Date;
};

const parseDay = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
};

// Days the resident can't take vakt. Vaktsjefen's schedule generator avoids them.
const UnavailabilityCard = ({ unavailability, today = new Date() }: UnavailabilityCardProps) => {
  const { periods, loading, error, add, remove } = unavailability;
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const invalid = !from || (to !== '' && to < from);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (invalid) return;
    setSaving(true);
    const saved = await add(parseDay(from), parseDay(to || from), note);
    setSaving(false);
    if (saved) {
      setFrom('');
      setTo('');
      setNote('');
    }
  };

  return (
    <Card
      title="Utilgjengelig"
      description="Dager du ikke kan ta vakt. Legg dem inn før vaktplanen lages."
    >
      <div className="space-y-4">
        {error && <StatusMessage tone="error">{error}</StatusMessage>}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Fra dato">
            {(controlProps) => (
              <Input
                {...controlProps}
                type="date"
                min={formatDay(today)}
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              />
            )}
          </Field>
          <Field
            label="Til dato"
            hint="La stå tom for én dag."
            error={to !== '' && to < from ? 'Må være samme dag eller senere.' : undefined}
          >
            {(controlProps) => (
              <Input
                {...controlProps}
                type="date"
                min={from || formatDay(today)}
                value={to}
                invalid={to !== '' && to < from}
                onChange={(event) => setTo(event.target.value)}
              />
            )}
          </Field>
          <Field label="Merknad (valgfritt)" className="sm:col-span-2">
            {(controlProps) => (
              <Input
                {...controlProps}
                value={note}
                maxLength={120}
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" loading={saving} disabled={invalid}>
              Legg til
            </Button>
          </div>
        </form>

        {!loading && periods.length === 0 && (
          <p className="text-sm text-subtle">Du har ikke lagt inn noen dager.</p>
        )}
        {periods.length > 0 && (
          <ul className="divide-y divide-border">
            {periods.map((period) => (
              <li key={period.id} className="flex items-center gap-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="font-medium tabular-nums">
                    {formatDate(period.from)}
                    {period.to.getTime() !== period.from.getTime() && ` – ${formatDate(period.to)}`}
                  </p>
                  {period.note && <p className="truncate text-sm text-muted">{period.note}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Fjern ${formatDate(period.from)}`}
                  icon={<Trash2 aria-hidden="true" className="h-4 w-4" />}
                  onClick={() => void remove(period.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
};

export default UnavailabilityCard;
