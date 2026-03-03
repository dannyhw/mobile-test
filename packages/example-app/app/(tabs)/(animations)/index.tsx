import { useRef, useState } from "react";
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

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
      <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Preview
        </Text>
        <Text style={[styles.sectionCopy, { color: palette.secondaryText }]}>
          Run a short native-driven animation and capture the settled frame.
        </Text>

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

        <Pressable
          testID="anim-trigger"
          accessibilityRole="button"
          onPress={startAnimation}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.tint,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text style={styles.primaryButtonText}>Start animation</Text>
        </Pressable>

        <Pressable
          testID="anim-reset"
          accessibilityRole="button"
          onPress={reset}
          style={({ pressed }) => [
            styles.secondaryButton,
            {
              backgroundColor: palette.surface,
              borderColor: palette.separator,
              opacity: pressed ? 0.72 : 1,
            },
          ]}
        >
          <Text style={[styles.secondaryButtonText, { color: palette.text }]}>
            Reset
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: {
    borderCurve: "continuous",
    borderRadius: 24,
    gap: 12,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  sectionCopy: {
    fontSize: 15,
    lineHeight: 21,
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
  primaryButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  primaryButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  secondaryButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    fontSize: 17,
    fontWeight: "600",
  },
});
