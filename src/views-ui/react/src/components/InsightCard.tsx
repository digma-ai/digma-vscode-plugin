import { ThreeDotsIcon } from "./icons/ThreeDotsIcon";

// TODO: Reuse types from the main codebase (resolve imports correctly in tsconfig)
export type Title = {
  text: string,
  tooltip: string
}

export type InsightCardProps = {
  title: string | Title;
  description: string
  icon: JSX.Element,
  body?: string,
  menuItems?: any[],
  records?: any[],
  buttons?: any[],
}

export const InsightCard = (props: InsightCardProps) => {
  const title = typeof props.title === "string" ? props.title : props.title.text;
  const tooltip = typeof props.title === "object" ? props.title.tooltip : "";
  return (
    <div className="list-item insight">
    <div className="list-item-top-area">
      <div className="list-item-header">
        <div className="list-item-title" {...(tooltip ? {tooltip} : {})}><strong>{title}</strong></div>
        {/* TODO: add timeInfoHtml */}
        {props.description && <div className="list-item-content-description">{props.description}</div>}
      </div>
      {props.icon && <div className="list-item-icon">{props.icon}</div>}
      {<ul className="list-item-menu sf-menu sf-js-enabled">
        <li className="list-item-menu">
        <div className="list-item-icon"><ThreeDotsIcon /></div>
          <ul>
             {/* TODO: add menuItemsHtml */}
          </ul>
        </li>
      </ul>
      }
    </div>
    {props.body && <div className="list-item-body">${props.body}</div>}
    {props.buttons && <div className="list-item-buttons">${props.buttons}</div>}
  </div>
  )
}