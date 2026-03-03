import { useState } from "react";
import { Pressable, Text, View } from "react-native";

export default function Counter() {
  const [count, setCount] = useState(0);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Pressable
        testID="click-button"
        style={({ pressed }) => ({
          padding: 20,
          backgroundColor: pressed ? "orange" : "tomato",
          borderRadius: 10,
        })}
        onPress={() => setCount(count + 1)}
      >
        <Text>Click me!</Text>
      </Pressable>

      <Text testID="counter" style={{ marginTop: 20 }}>{count}</Text>
    </View>
  );
}
