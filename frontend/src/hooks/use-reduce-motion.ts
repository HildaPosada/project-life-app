import { useEffect, useState } from "react";
import { AccessibilityInfo } from "react-native";

// Keep content still until the system preference has been read.
export function useReduceMotion() {
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    let preferenceChanged = false;
    const listener = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      preferenceChanged = true;
      if (active) setReduceMotion(enabled);
    });
    AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (active && !preferenceChanged) setReduceMotion(enabled);
    }).catch(() => {});
    return () => {
      active = false;
      listener.remove();
    };
  }, []);
  return reduceMotion;
}
