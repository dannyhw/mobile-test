import { useRef, useState } from "react";
import { Animated, Pressable, Text, View } from "react-native";

export default function Animations() {
  const [status, setStatus] = useState<"idle" | "animating" | "done">("idle");
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-50)).current;

  const startAnimation = () => {
    setStatus("animating");
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setStatus("done");
    });
  };

  const reset = () => {
    opacity.setValue(0);
    translateY.setValue(-50);
    setStatus("idle");
  };

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        padding: 20,
      }}
    >
      <Pressable
        testID="anim-trigger"
        onPress={startAnimation}
        style={({ pressed }) => ({
          padding: 16,
          borderRadius: 8,
          backgroundColor: pressed ? "orange" : "tomato",
          marginBottom: 20,
        })}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
          Start Animation
        </Text>
      </Pressable>

      <Animated.View
        testID="anim-box"
        style={{
          width: 120,
          height: 120,
          backgroundColor: "dodgerblue",
          borderRadius: 12,
          opacity,
          transform: [{ translateY }],
          marginBottom: 20,
        }}
      />

      <Text testID="anim-status" style={{ fontSize: 18, marginBottom: 12 }}>
        {status}
      </Text>

      <Pressable
        testID="anim-reset"
        onPress={reset}
        style={({ pressed }) => ({
          padding: 12,
          borderRadius: 8,
          backgroundColor: pressed ? "#999" : "#666",
        })}
      >
        <Text style={{ color: "white", fontSize: 14 }}>Reset</Text>
      </Pressable>
    </View>
  );
}
