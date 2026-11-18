import { CaseStatus } from "@prisma/client";
import { STATUS_ORDER } from "@/lib/state-machine";
import { STATUS_LABEL } from "@/lib/ui";

export function StatusStepper({ current }: { current: CaseStatus }) {
  const currentIndex = STATUS_ORDER.indexOf(current);

  return (
    <ol className="flex flex-wrap items-center gap-1">
      {STATUS_ORDER.map((step, i) => {
        const done = i < currentIndex;
        const active = i === currentIndex;
        return (
          <li key={step} className="flex items-center gap-1">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap ${
                done
                  ? "bg-green-100 text-green-700"
                  : active
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-600"
              }`}
            >
              {i + 1}. {STATUS_LABEL[step]}
            </span>
            {i < STATUS_ORDER.length - 1 && (
              <span className={`text-xs ${done ? "text-green-600" : "text-gray-400"}`}>›</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
