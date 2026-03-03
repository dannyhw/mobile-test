import { ActionButton } from "@/components/ui/ActionButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { useRef, useState } from "react";
import { Animated, ScrollView, StyleSheet, Text } from "react-native";

import { useNativePalette } from "../../../lib/native-ui";

export default function Animations() {
  const [status, setStatus] = useState<"idle" | "animating" | "done">("idle");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-50)).current;
  const palette = useNativePalette();

  const startAnimation = () => {
    setStatus("animating");

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStatus("done");
    });
  };

  const reset = () => {
    opacity.setValue(0);
    translateY.setValue(-50);
    setStatus("idle");
  };

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        {
          backgroundColor: palette.background,
        },
      ]}
    >
      <SectionCard
        backgroundColor={palette.surfaceMuted}
        title="Preview"
        titleColor={palette.text}
        description="Run a short native-driven animation and capture the settled frame."
        descriptionColor={palette.secondaryText}
      >
        <Animated.View
          testID="anim-box"
          style={[
            styles.animatedBox,
            {
              backgroundColor: palette.tint,
              opacity,
              transform: [{ translateY }],
            },
          ]}
        />

        <Text testID="anim-status" style={[styles.status, { color: palette.text }]}>
          {status}
        </Text>

        <ActionButton
          testID="anim-trigger"
          label="Start animation"
          onPress={startAnimation}
          backgroundColor={palette.tint}
        />

        <ActionButton
          testID="anim-reset"
          label="Reset"
          onPress={reset}
          variant="secondary"
          backgroundColor={palette.surface}
          borderColor={palette.separator}
          textColor={palette.text}
        />
      </SectionCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  animatedBox: {
    alignSelf: "center",
    borderCurve: "continuous",
    borderRadius: 24,
    height: 140,
    marginTop: 6,
    width: 140,
  },
  status: {
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
  },
});
