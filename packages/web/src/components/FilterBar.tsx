interface FilterBarProps {
  period: string;
  onPeriodChange: (period: string) => void;
}

const periods = [
  { value: "today", label: "Сегодня" },
  { value: "week", label: "Неделя" },
  { value: "month", label: "Месяц" },
  { value: "year", label: "Год" },
  { value: "all", label: "Всё время" },
];

export default function FilterBar({ period, onPeriodChange }: FilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
      {periods.map((p) => (
        <button
          key={p.value}
          onClick={() => onPeriodChange(p.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
            period === p.value
              ? "bg-[var(--tg-theme-button-color)] text-[var(--tg-theme-button-text-color)]"
              : "bg-[var(--tg-theme-bg-color)] text-[var(--tg-theme-hint-color)]"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
