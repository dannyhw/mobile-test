import { StyleSheet, Text, View } from "react-native";

type MetricHeroCardProps = {
  backgroundColor: string;
  description: string;
  descriptionColor: string;
  eyebrow: string;
  eyebrowColor: string;
  shadowColor: string;
  testID?: string;
  value: number;
  valueColor: string;
};

export function MetricHeroCard({
  backgroundColor,
  description,
  descriptionColor,
  eyebrow,
  eyebrowColor,
  shadowColor,
  testID,
  value,
  valueColor,
}: MetricHeroCardProps) {
  return (
    <View style={[styles.card, { backgroundColor, boxShadow: `0 16px 40px ${shadowColor}` }]}>
      <Text style={[styles.eyebrow, { color: eyebrowColor }]}>{eyebrow}</Text>
      <Text testID={testID} style={[styles.value, { color: valueColor }]}>
        {value}
      </Text>
      <Text style={[styles.description, { color: descriptionColor }]}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 28,
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  eyebrow: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 64,
    fontWeight: "700",
    letterSpacing: -2,
    marginTop: 8,
  },
  description: {
    fontSize: 16,
    lineHeight: 22,
    marginTop: 10,
    textAlign: "center",
  },
});
