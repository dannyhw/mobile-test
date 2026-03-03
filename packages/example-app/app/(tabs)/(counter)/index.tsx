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
        backgroundColor={palette.surface}
        shadowColor={palette.separator}
        eyebrow="Session taps"
        eyebrowColor={palette.secondaryText}
        value={count}
        valueColor={palette.text}
        description="Native controls, predictable state, clean screenshots."
        descriptionColor={palette.secondaryText}
        testID="counter"
      />

      <SectionCard
        backgroundColor={palette.surfaceMuted}
        title="Actions"
        titleColor={palette.text}
      >
        <ActionButton
          testID="click-button"
          label="Increment"
          onPress={() => setCount((current) => current + 1)}
          backgroundColor={palette.tint}
        />

        <ActionButton
          label="Reset"
          onPress={() => setCount(0)}
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
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
});
