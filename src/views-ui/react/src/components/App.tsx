import { useEffect, useState } from "react";
import { DurationIcon } from "./icons/DurationIcon";
import { InsightCard } from "./InsightCard";
import { Portal } from "./Portal";

export const App = () => {
  const [isListLoaded, setIsListLoaded] = useState(false);
  const [counter, setCounter] = useState(0);

  const handleMessage = (event) => {
    if (event.data.type === "InsightsList") {
      setIsListLoaded(true)
      // Use simple counter for force update
      // More info: https://reactjs.org/docs/hooks-faq.html#is-there-something-like-forceupdate
      setCounter(counter + 1)
    }
  }

  useEffect(() => {
    window.addEventListener('message', handleMessage);
    
    return () => {
      window.removeEventListener("message", handleMessage);
    }
  })

  // Some example data
  const insightData = {
    title: "Breakdown duration",
    description: "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Aliquam vel tempus elit, sed faucibus elit. Integer risus augue, scelerisque tincidunt leo nec, auctor tempor massa. Quisque imperdiet enim nibh, a porta est efficitur id. Etiam fermentum eu lectus in tempor. Quisque rutrum magna vitae malesuada tincidunt.",
    icon: <DurationIcon height={15}/>
  }

  return (
    <div>
      🙌 REACT ROOT IS HERE 🙌 {/* for React portal demo purposes */}
      {isListLoaded && <InsightCard title={insightData.title} description={insightData.description} icon={insightData.icon}></InsightCard>}
      <Portal container={"#portal"} /> {/* for React portal demo purposes */}
    </div>
  )
}
