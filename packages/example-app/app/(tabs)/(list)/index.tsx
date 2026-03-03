import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";

import { useNativePalette } from "../../../lib/native-ui";

const ITEMS = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}));

export default function List() {
  const [search, setSearch] = useState("");
  const palette = useNativePalette();

  const filtered = search
    ? ITEMS.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase()),
      )
    : ITEMS;

  return (
    <>
      <Stack.Screen
        options={{
          headerSearchBarOptions: {
            placeholder: "Search items...",
            onChangeText: (event) => setSearch(event.nativeEvent.text),
            onCancelButtonPress: () => setSearch(""),
          },
        }}
      />
      <ScrollView
        testID="list-scroll"
        automaticallyAdjustKeyboardInsets
        automaticallyAdjustsScrollIndicatorInsets
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={[
          styles.content,
          {
            backgroundColor: palette.background,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          testID="list-summary"
          style={[
            styles.searchSection,
            { backgroundColor: palette.surfaceMuted },
          ]}
        >
          <Text
            testID="list-header"
            style={[styles.sectionTitle, { color: palette.text }]}
          >
            Items
          </Text>
          <Text
            testID="list-description"
            style={[styles.sectionCopy, { color: palette.secondaryText }]}
          >
            Search from the native header and scroll through a grouped list.
          </Text>
        </View>

        <View
          testID="list-card"
          style={[styles.listCard, { backgroundColor: palette.surface }]}
        >
          {filtered.map((item, index) => (
            <View
              key={item.id}
              testID={`list-item-${item.id}`}
              accessibilityLabel={item.label}
              style={[
                styles.row,
                index < filtered.length - 1
                  ? {
                      borderBottomColor: palette.separator,
                      borderBottomWidth: StyleSheet.hairlineWidth,
                    }
                  : null,
              ]}
            >
              <Text style={[styles.rowLabel, { color: palette.text }]}>
                {item.label}
              </Text>
              <Text style={[styles.rowMeta, { color: palette.secondaryText }]}>
                #{item.id + 1}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  searchSection: {
    borderCurve: "continuous",
    borderRadius: 24,
    gap: 8,
    padding: 12,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  sectionCopy: {
    fontSize: 15,
    lineHeight: 21,
  },
  listCard: {
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
  rowLabel: {
    fontSize: 17,
  },
  rowMeta: {
    fontSize: 15,
    fontVariant: ["tabular-nums"],
  },
});
