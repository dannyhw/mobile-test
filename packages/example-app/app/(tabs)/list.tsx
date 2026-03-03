import { useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";

const ITEMS = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  label: `Item ${i}`,
}));

export default function List() {
  const [search, setSearch] = useState("");

  const filtered = search
    ? ITEMS.filter((item) =>
        item.label.toLowerCase().includes(search.toLowerCase())
      )
    : ITEMS;

  return (
    <View style={{ flex: 1, padding: 20, paddingTop: 40 }}>
      <Text testID="list-header" style={{ fontSize: 24, fontWeight: "bold", marginBottom: 12 }}>
        Items
      </Text>

      <TextInput
        testID="list-search"
        placeholder="Search items..."
        value={search}
        onChangeText={setSearch}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 16,
        }}
      />

      <ScrollView testID="list-scroll">
        {filtered.map((item) => (
          <View
            key={item.id}
            testID={`list-item-${item.id}`}
            accessibilityLabel={item.label}
            style={{
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "#eee",
            }}
          >
            <Text style={{ fontSize: 16 }}>{item.label}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}
