import { ActionButton } from "@/components/ui/ActionButton";
import { MetricHeroCard } from "@/components/ui/MetricHeroCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

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
      <MetricHeroCard
        eyebrow="Session taps"
        value={count}
        description="Native controls, predictable state, clean screenshots."
        testID="counter"
      />

      <SectionCard title="Actions">
        <ActionButton
          testID="click-button"
          label="Increment"
          onPress={() => setCount((current) => current + 1)}
        />

        <ActionButton
          label="Reset"
          onPress={() => setCount(0)}
          variant="secondary"
        />
      </SectionCard>
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
});
