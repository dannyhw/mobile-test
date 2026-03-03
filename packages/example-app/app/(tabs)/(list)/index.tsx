import { ListRowsCard } from "@/components/ui/ListRowsCard";
import { SectionCard } from "@/components/ui/SectionCard";
import { Stack } from "expo-router";
import { useState } from "react";
import { ScrollView, StyleSheet } from "react-native";

import { useNativePalette } from "../../../lib/native-ui";

const ITEMS = Array.from({ length: 30 }, (_, index) => ({
  id: index,
  label: `Item ${index}`,
}));

export default function List() {
  const [search, setSearch] = useState("");
  const palette = useNativePalette();

  const filtered = search
    ? ITEMS.filter((item) => item.label.toLowerCase().includes(search.toLowerCase()))
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
        <SectionCard
          testID="list-summary"
          title="Items"
          titleTestID="list-header"
          titleStyle={styles.summaryTitle}
          description="Search from the native header and scroll through a grouped list."
          descriptionTestID="list-description"
          descriptionStyle={styles.summaryCopy}
        />

        <ListRowsCard
          testID="list-card"
          rows={filtered.map((item) => ({
            id: item.id,
            label: item.label,
            meta: `#${item.id + 1}`,
            testID: `list-item-${item.id}`,
            accessibilityLabel: item.label,
          }))}
        />
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
  summaryTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  summaryCopy: {
    fontSize: 15,
    lineHeight: 21,
  },
});
