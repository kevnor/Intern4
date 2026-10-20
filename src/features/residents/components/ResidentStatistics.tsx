import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useChartColors } from '../../../app/providers/ThemeProvider';
import { buildStatistics } from '../residentDirectory';
import type { ChartDatum } from '../residentDirectory';

type ChartTooltipPayload = {
  payload?: ChartDatum;
};

type ChartTooltipProps = {
  active?: boolean;
  label?: string;
  payload?: ChartTooltipPayload[];
};

const formatDecimal = (value: number | null, suffix = ''): string => {
  if (value === null) return '-';
  return `${value.toFixed(1)}${suffix}`;
};

const formatDatum = (item: ChartDatum): string =>
  `${item.label}: ${item.value} (${item.percentage} %)`;

const ChartTooltip = ({ active, payload, label }: ChartTooltipProps) => {
  const item = payload?.[0]?.payload;

  if (!active || !item) return null;

  return (
    <div className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-fg">{label ?? item.label}</p>
      <p className="text-muted">
        {item.value} beboere, {item.percentage} %
      </p>
    </div>
  );
};

type SummaryCardProps = {
  title: string;
  value: string;
  detail: string;
  className?: string;
};

const SummaryCard = ({ title, value, detail, className = '' }: SummaryCardProps) => (
  <section className={`rounded-2xl border border-border bg-surface p-4 shadow-sm ${className}`}>
    <h2 className="text-xs font-medium text-muted">{title}</h2>
    <p className="mt-1 text-lg font-semibold leading-tight text-fg">{value}</p>
    <p className="mt-1 text-xs leading-snug text-subtle">{detail}</p>
  </section>
);

type ChartCardProps = {
  title: string;
  description: string;
  children: React.ReactNode;
  data: ChartDatum[];
};

const ChartCard = ({ title, description, children, data }: ChartCardProps) => (
  <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
    <div className="mb-2">
      <h2 className="text-base font-semibold text-fg">{title}</h2>
      <p className="mt-0.5 text-xs leading-snug text-muted">{description}</p>
    </div>
    {children}
    <ul className="mt-2 grid grid-cols-1 gap-x-3 gap-y-1 text-xs sm:grid-cols-2">
      {data
        .filter((item) => item.value > 0)
        .map((item) => (
          <li
            key={item.label}
            className="flex min-w-0 items-center justify-between gap-2 text-muted"
            aria-label={formatDatum(item)}
          >
            <span className="truncate" title={item.label}>
              {item.label}
            </span>
            <span className="shrink-0 font-medium text-fg">
              {item.value} ({item.percentage} %)
            </span>
          </li>
        ))}
    </ul>
  </section>
);

type VerticalDistributionChartProps = {
  title: string;
  description: string;
  data: ChartDatum[];
};

const VerticalDistributionChart = ({
  title,
  description,
  data,
}: VerticalDistributionChartProps) => {
  const colors = useChartColors();

  return (
    <ChartCard title={title} description={description} data={data}>
      <div className="h-40 sm:h-44" aria-label={`${title} diagram`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 14, right: 4, left: -28, bottom: -4 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.axis, fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: colors.axis, fontSize: 11 }}
            />
            <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
            <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={colors.series[0]} aria-label={title}>
              {data.map((item, index) => (
                <Cell key={item.label} fill={colors.series[index % colors.series.length]} />
              ))}
              <LabelList dataKey="value" position="top" className="fill-muted text-xs" />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

const StudyYearChart = ({ data }: { data: ChartDatum[] }) => {
  const visibleData = data.filter((item) => item.value > 0);
  const colors = useChartColors();

  return (
    <ChartCard title="Studieår" description="Hvor i studieløpet dagens beboere er." data={data}>
      <div className="h-40 sm:h-44" aria-label="Studieår diagram">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<ChartTooltip />} />
            <Pie
              data={visibleData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              innerRadius={34}
              outerRadius={58}
              paddingAngle={2}
            >
              {visibleData.map((item, index) => (
                <Cell key={item.label} fill={colors.series[index % colors.series.length]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};

const CourseChart = ({ data }: { data: ChartDatum[] }) => {
  const chartHeight = Math.min(Math.max(data.length * 28, 150), 240);
  const colors = useChartColors();

  return (
    <ChartCard
      title="Studieprogram"
      description="De vanligste studiene i huset, med små grupper samlet som Annet."
      data={data}
    >
      <div>
        <div style={{ height: chartHeight }} aria-label="Studieprogram diagram">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 4, right: 24, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={colors.grid} />
              <XAxis
                type="number"
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={96}
                tickFormatter={(value: string) =>
                  value.length > 14 ? `${value.slice(0, 13)}…` : value
                }
                tickLine={false}
                axisLine={false}
                tick={{ fill: colors.axis, fontSize: 11 }}
              />
              <Tooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
              <Bar dataKey="value" radius={[0, 6, 6, 0]} fill={colors.series[1]}>
                {data.map((item, index) => (
                  <Cell key={item.label} fill={colors.series[index % colors.series.length]} />
                ))}
                <LabelList dataKey="value" position="right" className="fill-muted text-xs" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </ChartCard>
  );
};

type StatisticsDashboardProps = {
  statistics: ReturnType<typeof buildStatistics>;
};

export const StatisticsDashboard = ({ statistics }: StatisticsDashboardProps) => {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard
          title="Nåværende beboere"
          value={String(statistics.summary.totalResidents)}
          detail="Med i dagens beboerliste"
        />
        <SummaryCard
          title="Snittalder"
          value={formatDecimal(statistics.summary.averageAge, ' år')}
          detail="Basert på registrert fødselsdato"
        />
        <SummaryCard
          title="Snitt studieår"
          value={formatDecimal(statistics.summary.averageStudyYear)}
          detail="Beboere med 1.-5. studieår"
        />
        <SummaryCard
          title="Snitt botid"
          value={formatDecimal(statistics.summary.averageSemesters, ' semestre')}
          detail="Fra registrert innflytting"
        />
        <SummaryCard
          title="Vanligste studie"
          value={statistics.summary.mostCommonStudy ?? '-'}
          detail="Største registrerte studiegruppe"
          className="col-span-2 lg:col-span-1"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <VerticalDistributionChart
          title="Aldersfordeling"
          description="Gir et raskt bilde av aldersspennet blant nåværende beboere."
          data={statistics.ageGroups}
        />
        <StudyYearChart data={statistics.studyYears} />
        <VerticalDistributionChart
          title="Botid"
          description="Antall semestre beboerne har vært registrert på huset."
          data={statistics.semesters}
        />
        <CourseChart data={statistics.courses} />
      </div>
    </div>
  );
};
