import { createPortal } from "react-dom";

export const Portal = (props) => {
  const container = document.querySelector(props.container);
  console.log(container)

  return container
    ? createPortal(
        <>🌀 REACT PORTAL IS HERE</>,
        container
      )
    : null;
};
