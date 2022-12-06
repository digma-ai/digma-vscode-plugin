import entities from "entities";

// TODO: Reuse types from the main codebase (resolve imports correctly in tsconfig)
export interface Duration {
  value: number;
  unit: string;
  raw: number;
}

export interface SpanDurationBreakdownEntry {
  spanName: string,
  spanDisplayName: string,
  spanInstrumentationLibrary: string,
  spanCodeObjectId: string,
  percentiles: {
    percentile: number,
    duration: Duration
  }[]
}

export type DurationBreakdownEntryProps = {
  index: number
  entry: {
    breakdownEntry: SpanDurationBreakdownEntry
    location: any,
  }
}

const P50 = 0.5;

const getDisplayValueOfPercentile = (breakdownEntry: SpanDurationBreakdownEntry, requestedPercentile: number): string => {
  for (const pctl of breakdownEntry.percentiles) {
    if (pctl.percentile === requestedPercentile) {
      return `${pctl.duration.value} ${pctl.duration.unit}`;
    }
  }
  return "";
}

const getTooltip = (breakdownEntry: SpanDurationBreakdownEntry): string => {
  const sortedPercentiles = breakdownEntry.percentiles.sort((p1, p2) => p1.percentile - p2.percentile);
  let tooltip = 'Percentage of time spent in span:\n';
  for (const p of sortedPercentiles) {
    tooltip += `P${p.percentile * 100}: ${p.duration.value} ${p.duration.unit}\n`;
  }
  return tooltip;
}

export const DurationBreakdownEntry = (props: DurationBreakdownEntryProps): JSX.Element => {
  const p50 = getDisplayValueOfPercentile(props.entry.breakdownEntry, P50);
  const spanLocation = props.entry.location;

  const spanDisplayName = entities.encodeHTML(props.entry.breakdownEntry.spanDisplayName);
  const spanName = spanDisplayName;

  return (
    <div data-index={props.index} className="item flow-row flex-row">
      <span className="codicon codicon-telescope" title="OpenTelemetry"></span>
      <span className="flex-row flex-wrap ellipsis">
        <span className="ellipsis">
          <span title={spanDisplayName} className={`span-name ${spanLocation ? "link" : ""}`} data-code-uri={spanLocation?.documentUri} data-code-line={spanLocation?.range.end.line! + 1}>
            {spanName}
          </span>
        </span>
        <span className="duration" title={getTooltip(props.entry.breakdownEntry)}>{p50}</span>
      </span>
    </div>
  )
}