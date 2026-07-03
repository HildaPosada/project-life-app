import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, View, Pressable, StyleSheet, Text } from "react-native";
import Svg, {
  Defs,
  LinearGradient as SvgLinearGradient,
  RadialGradient as SvgRadialGradient,
  Stop,
  Rect,
  Path,
  Circle,
} from "react-native-svg";
import * as Haptics from "expo-haptics";

import { colors, fonts, fontSize } from "@/src/theme";

// A painterly, evolving sanctuary scene rendered in SVG.
// - Sky palette + sun/moon position shift with the time of day.
// - Distant hills, mist and foreground grass provide depth.
// - The central tree grows on a log curve as the user tends the garden.
// - Memory stones (real chapters from the user's history) sit along a
//   winding path in the foreground and are individually tappable.
// - Only two elements animate (canopy sway + drifting cloud) — every-
//   thing else stays still so the scene feels timeless, not busy.

export type Stone = {
  stone_id: string;
  title: string;
  kind: "journal" | "checkin" | "phase";
  date: string;
};

type Palette = {
  skyTop: string;
  skyMid: string;
  skyBot: string;
  sun: string;
  sunGlow: string;
  hillFar: string;
  hillNear: string;
  ground: string;
  path: string;
  mist: number;   // 0..1
};

function paletteForHour(h: number): Palette {
  // Dawn
  if (h >= 5 && h < 8) return {
    skyTop: "#E8D9C7", skyMid: "#F0DDCB", skyBot: "#F7E3D0",
    sun: "#E9B37C", sunGlow: "rgba(233,179,124,0.35)",
    hillFar: "#B8B3A2", hillNear: "#8C9583", ground: "#D9D2C4", path: "#C6BDA9", mist: 0.55,
  };
  // Morning
  if (h >= 8 && h < 12) return {
    skyTop: "#EEE7D8", skyMid: "#EFE9DD", skyBot: "#F1E9D8",
    sun: "#DDB27A", sunGlow: "rgba(221,178,122,0.28)",
    hillFar: "#A6A995", hillNear: "#7F9078", ground: "#D2C8B4", path: "#BDB39E", mist: 0.35,
  };
  // Afternoon
  if (h >= 12 && h < 17) return {
    skyTop: "#EEE5CE", skyMid: "#EDE0C4", skyBot: "#EFDFC0",
    sun: "#B79A63", sunGlow: "rgba(183,154,99,0.22)",
    hillFar: "#8F998A", hillNear: "#6C7F68", ground: "#CFC5B0", path: "#B4A98F", mist: 0.15,
  };
  // Evening / Golden hour
  if (h >= 17 && h < 20) return {
    skyTop: "#D9B389", skyMid: "#E3B78D", skyBot: "#E8B98D",
    sun: "#C97F52", sunGlow: "rgba(201,127,82,0.35)",
    hillFar: "#6E6D62", hillNear: "#4B5A4F", ground: "#B49F82", path: "#957D5F", mist: 0.25,
  };
  // Night
  return {
    skyTop: "#20272B", skyMid: "#2C363B", skyBot: "#3A4249",
    sun: "#E9E4DD", sunGlow: "rgba(233,228,221,0.22)",
    hillFar: "#3A3E3D", hillNear: "#2A302E", ground: "#2A2823", path: "#3B342A", mist: 0.4,
  };
}

// Season colour bias — a soft tint applied on top of the time-of-day palette.
function seasonTint(month: number): { grass: string; canopy: string } {
  // Northern-hemisphere biased but subtle.
  if (month >= 2 && month <= 4) return { grass: "#8FA98A", canopy: "#4E7355" }; // Spring
  if (month >= 5 && month <= 7) return { grass: "#7F9E7A", canopy: "#355746" }; // Summer
  if (month >= 8 && month <= 10) return { grass: "#B58A57", canopy: "#89684A" }; // Autumn
  return { grass: "#8B8C7F", canopy: "#4A5A4C" }; // Winter
}

// Interpolate the stone positions along a smooth bezier path in the
// foreground. `t` is 0..1 along the visible path.
function pointOnPath(t: number, W: number, H: number) {
  // Two cubic bezier segments approximating the S-curve path.
  const p0 = { x: 0.12 * W, y: 0.86 * H };
  const p1 = { x: 0.30 * W, y: 0.78 * H };
  const p2 = { x: 0.55 * W, y: 0.90 * H };
  const p3 = { x: 0.88 * W, y: 0.78 * H };
  const it = 1 - t;
  const x = it * it * it * p0.x + 3 * it * it * t * p1.x + 3 * it * t * t * p2.x + t * t * t * p3.x;
  const y = it * it * it * p0.y + 3 * it * it * t * p1.y + 3 * it * t * t * p2.y + t * t * t * p3.y;
  return { x, y };
}

export function SanctuaryScene({
  activity,
  stones,
  onStonePress,
  height = 260,
  width = 340,
}: {
  activity: number;
  stones: Stone[];
  onStonePress: (s: Stone) => void;
  height?: number;
  width?: number;
}) {
  const now = new Date();
  const hour = now.getHours();
  const month = now.getMonth();
  const p = useMemo(() => paletteForHour(hour), [hour]);
  const season = useMemo(() => seasonTint(month), [month]);

  // Log-scale growth so early sessions have the most visible change.
  const growth = Math.min(1, Math.log(1 + activity) / Math.log(1 + 24));
  const treeH = 40 + growth * 70;
  const canopyR = 22 + growth * 30;

  // Animated values — only two, both very slow and non-alarming.
  const sway = useRef(new Animated.Value(0)).current;
  const drift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(sway, { toValue: 1, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sway, { toValue: 0, duration: 6000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    ).start();
    Animated.loop(
      Animated.timing(drift, { toValue: 1, duration: 45000, easing: Easing.linear, useNativeDriver: true }),
    ).start();
  }, [sway, drift]);

  const rotate = sway.interpolate({ inputRange: [0, 1], outputRange: ["-1.5deg", "1.5deg"] });
  const cloudX = drift.interpolate({ inputRange: [0, 1], outputRange: [-40, width + 40] });

  // How many visible stones — max 6 along the path even if user has more.
  const visible = stones.slice(-6);
  const positions = visible.map((_, i, arr) => {
    const t = arr.length === 1 ? 0.5 : i / (arr.length - 1);
    return pointOnPath(t, width, height);
  });

  const sunY = hour < 12 ? 0.24 * height : 0.32 * height;
  const sunX = hour < 12 ? 0.75 * width : 0.28 * width;

  return (
    <View style={[styles.wrap, { width, height }]}>
      <Svg width={width} height={height}>
        <Defs>
          <SvgLinearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={p.skyTop} />
            <Stop offset="0.5" stopColor={p.skyMid} />
            <Stop offset="1" stopColor={p.skyBot} />
          </SvgLinearGradient>
          <SvgRadialGradient id="sunGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={p.sunGlow} />
            <Stop offset="1" stopColor="rgba(0,0,0,0)" />
          </SvgRadialGradient>
          <SvgLinearGradient id="mist" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={`rgba(255,255,255,${p.mist})`} />
            <Stop offset="1" stopColor="rgba(255,255,255,0)" />
          </SvgLinearGradient>
        </Defs>

        {/* Sky */}
        <Rect x="0" y="0" width={width} height={height * 0.78} fill="url(#sky)" />

        {/* Sun / moon glow */}
        <Circle cx={sunX} cy={sunY} r={40} fill="url(#sunGlow)" />
        <Circle cx={sunX} cy={sunY} r={16} fill={p.sun} opacity={0.9} />

        {/* Distant hills */}
        <Path
          d={`M0 ${0.62 * height} Q ${0.15 * width} ${0.5 * height} ${0.35 * width} ${0.58 * height} T ${0.7 * width} ${0.56 * height} T ${width} ${0.6 * height} L ${width} ${0.78 * height} L 0 ${0.78 * height} Z`}
          fill={p.hillFar}
          opacity={0.6}
        />
        {/* Nearer hills */}
        <Path
          d={`M0 ${0.72 * height} Q ${0.2 * width} ${0.62 * height} ${0.45 * width} ${0.7 * height} T ${0.85 * width} ${0.68 * height} L ${width} ${0.68 * height} L ${width} ${0.82 * height} L 0 ${0.82 * height} Z`}
          fill={p.hillNear}
          opacity={0.8}
        />

        {/* Mist band */}
        <Rect x="0" y={0.62 * height} width={width} height={0.14 * height} fill="url(#mist)" />

        {/* Ground */}
        <Rect x="0" y={0.78 * height} width={width} height={0.22 * height} fill={p.ground} />
        {/* Grass tint (season aware) */}
        <Rect x="0" y={0.83 * height} width={width} height={0.17 * height} fill={season.grass} opacity={0.35} />

        {/* Meandering path */}
        <Path
          d={`M ${0.12 * width} ${0.86 * height} C ${0.30 * width} ${0.78 * height}, ${0.55 * width} ${0.90 * height}, ${0.88 * width} ${0.78 * height}`}
          stroke={p.path}
          strokeWidth={7}
          strokeLinecap="round"
          fill="none"
          opacity={0.85}
        />
      </Svg>

      {/* Drifting cloud (Animated view over SVG for smooth transform) */}
      <Animated.View
        pointerEvents="none"
        style={[
          styles.cloud,
          { top: 0.18 * height, transform: [{ translateX: cloudX }] },
        ]}
      >
        <View style={[styles.cloudBlob, { width: 60, height: 16 }]} />
        <View style={[styles.cloudBlob, { width: 44, height: 12, marginLeft: -20 }]} />
      </Animated.View>

      {/* Central tree — animated canopy sway */}
      <View style={[styles.treeRoot, { left: width / 2 - 2, bottom: height * 0.22, height: treeH }]}>
        <View style={styles.trunk} />
      </View>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.canopyWrap,
          {
            left: width / 2 - canopyR,
            bottom: height * 0.22 + treeH - 10,
            width: canopyR * 2,
            height: canopyR * 2,
            transform: [{ rotate }],
          },
        ]}
      >
        <View style={[styles.canopy, { width: canopyR * 2, height: canopyR * 2, backgroundColor: season.canopy, borderRadius: canopyR }]} />
      </Animated.View>

      {/* Memory stones — tappable */}
      {visible.map((s, i) => {
        const pos = positions[i];
        return (
          <Pressable
            key={s.stone_id}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onStonePress(s);
            }}
            testID={`memory-stone-${s.stone_id}`}
            style={[styles.stone, { left: pos.x - 12, top: pos.y - 6 }]}
            hitSlop={12}
          >
            <View style={[styles.stoneInner, s.kind === "phase" && styles.stonePhase]} />
          </Pressable>
        );
      })}

      {/* Silent chapter caption — the newest stone gets a whispered label */}
      {visible.length > 0 && (
        <View style={[styles.chapterCap, { left: positions[positions.length - 1].x - 60 }]} pointerEvents="none">
          <Text style={styles.chapterText} numberOfLines={1}>{visible[visible.length - 1].title}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 18, overflow: "hidden", position: "relative" },
  cloud: { position: "absolute", flexDirection: "row", alignItems: "center" },
  cloudBlob: { backgroundColor: "rgba(255,255,255,0.55)", borderRadius: 999 },
  treeRoot: { position: "absolute", width: 4 },
  trunk: { flex: 1, backgroundColor: "#5B4433", borderRadius: 2 },
  canopyWrap: { position: "absolute", alignItems: "center", justifyContent: "center" },
  canopy: { opacity: 0.95 },
  stone: {
    position: "absolute",
    width: 24,
    height: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stoneInner: {
    width: 20,
    height: 10,
    borderRadius: 6,
    backgroundColor: colors.borderStrong,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.15)",
  },
  stonePhase: { backgroundColor: colors.accent },
  chapterCap: { position: "absolute", bottom: 12, width: 120, alignItems: "center" },
  chapterText: { fontFamily: fonts.serif, fontSize: fontSize.xs, color: colors.onSurface, opacity: 0.7, fontStyle: "italic" },
});
