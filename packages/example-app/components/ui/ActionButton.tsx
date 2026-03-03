import { Pressable, StyleSheet, Text } from "react-native";

import { useNativePalette } from "@/lib/native-ui";

type ActionButtonVariant = "primary" | "secondary";

type ActionButtonProps = {
  accessibilityLabel?: string;
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
  variant?: ActionButtonVariant;
};

export function ActionButton({
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  testID,
  variant = "primary",
}: ActionButtonProps) {
  const palette = useNativePalette();
  const isPrimary = variant === "primary";
  const resolvedBackgroundColor = isPrimary
    ? disabled
      ? palette.separator
      : palette.tint
    : disabled
      ? palette.surfaceMuted
      : palette.surface;
  const resolvedTextColor = isPrimary ? "#fff" : disabled ? palette.secondaryText : palette.text;
  const resolvedBorderColor = isPrimary ? undefined : palette.separator;

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
          backgroundColor: resolvedBackgroundColor,
          borderColor: resolvedBorderColor,
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
