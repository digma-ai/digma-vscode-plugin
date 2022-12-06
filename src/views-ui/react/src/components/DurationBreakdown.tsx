import { DurationBreakdownEntry } from "./DurationBreakdownEntry";

// TODO: Reuse types from the main codebase (resolve imports correctly in tsconfig)
export type DurationBreakdownProps = {
  entries: any[]
}

export const DurationBreakdown = (props: DurationBreakdownProps): JSX.Element => {
  return (
    <div className="span-duration-breakdown-insight pagination-list" data-current-page="1" data-records-per-page="3">
      {props.entries.map((entry, i) => (<DurationBreakdownEntry entry={entry} key={i} index={i} />))}
      <div className="pagination-nav">
        <a className="prev">Prev</a>
        <a className="next">Next</a>
        <span className="page"></span>
      </div>
    </div>
  )
}