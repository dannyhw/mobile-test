import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useNativePalette } from "../../../lib/native-ui";

export default function Counter() {
  const [count, setCount] = useState(0);
  const palette = useNativePalette();

  return (
    <ScrollView
      testID="counter-scroll"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        {
          backgroundColor: palette.background,
        },
      ]}
    >
      <View
        style={[
          styles.heroCard,
          {
            backgroundColor: palette.surface,
            boxShadow: `0 16px 40px ${palette.separator}`,
          },
        ]}
      >
        <Text style={[styles.eyebrow, { color: palette.secondaryText }]}>
          Session taps
        </Text>
        <Text testID="counter" style={[styles.counterValue, { color: palette.text }]}>
          {count}
        </Text>
        <Text style={[styles.heroCopy, { color: palette.secondaryText }]}>
          Native controls, predictable state, clean screenshots.
        </Text>
      </View>

      <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Actions
        </Text>

        <Pressable
          testID="click-button"
          accessibilityRole="button"
          onPress={() => setCount((current) => current + 1)}
          style={({ pressed }) => [
            styles.primaryButton,
            {
              backgroundColor: palette.tint,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text style={styles.primaryButtonText}>Increment</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => setCount(0)}
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
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  heroCard: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 28,
    paddingVertical: 24,
    paddingHorizontal: 16,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  counterValue: {
    marginTop: 8,
    fontSize: 64,
    fontWeight: "700",
    letterSpacing: -2,
  },
  heroCopy: {
    marginTop: 10,
    fontSize: 16,
    lineHeight: 22,
    textAlign: "center",
  },
  section: {
    borderCurve: "continuous",
    borderRadius: 24,
    padding: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
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
