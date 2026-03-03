import { StyleSheet, Text, View } from "react-native";

type StatusCardProps = {
  backgroundColor: string;
  borderColor: string;
  label: string;
  labelColor: string;
  testID?: string;
  timestamp?: string;
  timestampColor?: string;
  timestampTestID?: string;
  value: string;
  valueColor: string;
  valueTestID?: string;
};

export function StatusCard({
  backgroundColor,
  borderColor,
  label,
  labelColor,
  testID,
  timestamp,
  timestampColor,
  timestampTestID,
  value,
  valueColor,
  valueTestID,
}: StatusCardProps) {
  return (
    <View testID={testID} style={[styles.card, { backgroundColor, borderColor }]}>
      <Text style={[styles.label, { color: labelColor }]}>{label}</Text>
      <Text testID={valueTestID} style={[styles.value, { color: valueColor }]}>
        {value}
      </Text>
      {timestamp ? (
        <Text testID={timestampTestID} style={[styles.timestamp, { color: timestampColor ?? labelColor }]}>
          {timestamp}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 20,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 14,
  },
});
