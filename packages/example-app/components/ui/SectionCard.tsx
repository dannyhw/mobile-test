import { type ReactNode } from "react";
import {
  type StyleProp,
  StyleSheet,
  Text,
  type TextStyle,
  View,
} from "react-native";

import { useNativePalette } from "@/lib/native-ui";

type SectionCardProps = {
  backgroundColor?: string;
  children?: ReactNode;
  description?: string;
  descriptionColor?: string;
  descriptionStyle?: StyleProp<TextStyle>;
  descriptionTestID?: string;
  testID?: string;
  title?: string;
  titleColor?: string;
  titleStyle?: StyleProp<TextStyle>;
  titleTestID?: string;
};

export function SectionCard({
  backgroundColor,
  children,
  description,
  descriptionColor,
  descriptionStyle,
  descriptionTestID,
  testID,
  title,
  titleColor,
  titleStyle,
  titleTestID,
}: SectionCardProps) {
  const palette = useNativePalette();

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        { backgroundColor: backgroundColor ?? palette.surfaceMuted },
      ]}
    >
      {title ? (
        <Text
          testID={titleTestID}
          style={[
            styles.title,
            titleStyle,
            { color: titleColor ?? palette.text },
          ]}
        >
          {title}
        </Text>
      ) : null}
      {description ? (
        <Text
          testID={descriptionTestID}
          style={[
            styles.description,
            descriptionStyle,
            { color: descriptionColor ?? palette.secondaryText },
          ]}
        >
          {description}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderCurve: "continuous",
    borderRadius: 24,
    gap: 12,
    padding: 12,
  },
  title: {
    fontSize: 17,
    fontWeight: "600",
  },
  description: {
    fontSize: 15,
    lineHeight: 21,
  },
});
