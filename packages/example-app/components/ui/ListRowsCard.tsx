import { StyleSheet, Text, View } from "react-native";

type ListRowItem = {
  accessibilityLabel?: string;
  id: number | string;
  label: string;
  meta: string;
  testID?: string;
};

type ListRowsCardProps = {
  backgroundColor: string;
  labelColor: string;
  metaColor: string;
  rowBorderColor: string;
  rows: ListRowItem[];
  testID?: string;
};

export function ListRowsCard({
  backgroundColor,
  labelColor,
  metaColor,
  rowBorderColor,
  rows,
  testID,
}: ListRowsCardProps) {
  return (
    <View testID={testID} style={[styles.card, { backgroundColor }]}>
      {rows.map((row, index) => (
        <View
          key={row.id}
          testID={row.testID}
          accessibilityLabel={row.accessibilityLabel}
          style={[
            styles.row,
            index < rows.length - 1
              ? {
                  borderBottomColor: rowBorderColor,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                }
              : null,
          ]}
        >
          <Text style={[styles.label, { color: labelColor }]}>{row.label}</Text>
          <Text style={[styles.meta, { color: metaColor }]}>{row.meta}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: 24,
    overflow: "hidden",
  },
  row: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 14,
  },
  label: {
    fontSize: 17,
  },
  meta: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
});
