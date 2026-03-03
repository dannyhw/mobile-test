import { Pressable, StyleSheet, Text } from "react-native";

type ActionButtonVariant = "primary" | "secondary";

type ActionButtonProps = {
  accessibilityLabel?: string;
  backgroundColor: string;
  borderColor?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  textColor?: string;
  variant?: ActionButtonVariant;
};

export function ActionButton({
  accessibilityLabel,
  backgroundColor,
  borderColor,
  disabled = false,
  label,
  onPress,
  testID,
  textColor,
  variant = "primary",
}: ActionButtonProps) {
  const resolvedTextColor = textColor ?? (variant === "primary" ? "#fff" : "#111");

  return (
    <Pressable
      testID={testID}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variant === "primary" ? null : styles.secondary,
        {
          backgroundColor,
          borderColor: variant === "secondary" ? borderColor : undefined,
          opacity: disabled ? 1 : pressed ? (variant === "primary" ? 0.82 : 0.72) : 1,
        },
      ]}
    >
      <Text style={[styles.text, { color: resolvedTextColor }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 17,
    fontWeight: "600",
  },
});
