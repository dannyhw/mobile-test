import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

import { useNativePalette } from "../../../lib/native-ui";

export default function Form() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());
  const palette = useNativePalette();

  const canSubmit = name.length > 0 && email.length > 0 && termsAccepted;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date().toLocaleTimeString());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) {
      return;
    }

    setSubmitted(true);
    setSubmittedName(name);
  };

  const inputStyle = {
    backgroundColor: palette.surface,
    borderColor: palette.separator,
    color: palette.text,
  } as const;

  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={[
        styles.content,
        {
          backgroundColor: palette.background,
        },
      ]}
    >
      <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Profile
        </Text>

        <TextInput
          testID="form-name"
          placeholder="Name"
          placeholderTextColor={palette.secondaryText}
          selectionColor={palette.tint}
          value={name}
          onChangeText={setName}
          style={[styles.input, inputStyle]}
        />

        <TextInput
          testID="form-email"
          placeholder="Email"
          placeholderTextColor={palette.secondaryText}
          selectionColor={palette.tint}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          style={[styles.input, inputStyle]}
        />
      </View>

      <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
        <Text style={[styles.sectionTitle, { color: palette.text }]}>
          Preferences
        </Text>

        <View
          style={[
            styles.toggleRow,
            {
              backgroundColor: palette.surface,
              borderColor: palette.separator,
            },
          ]}
        >
          <View style={styles.toggleCopy}>
            <Text style={[styles.toggleTitle, { color: palette.text }]}>
              Accept terms
            </Text>
            <Text style={[styles.toggleSubtitle, { color: palette.secondaryText }]}>
              Required before submitting the form.
            </Text>
          </View>

          <Switch
            testID="form-terms"
            value={termsAccepted}
            onValueChange={setTermsAccepted}
            trackColor={{
              false: palette.separator,
              true: palette.tint,
            }}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: palette.surfaceMuted }]}>
        <Pressable
          testID="form-submit"
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit }}
          disabled={!canSubmit}
          onPress={handleSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            {
              backgroundColor: canSubmit ? palette.tint : palette.separator,
              opacity: pressed ? 0.82 : 1,
            },
          ]}
        >
          <Text style={styles.submitButtonText}>Submit</Text>
        </Pressable>

        <View
          style={[
            styles.statusCard,
            {
              backgroundColor: palette.surface,
              borderColor: palette.separator,
            },
          ]}
        >
          <Text style={[styles.statusLabel, { color: palette.secondaryText }]}>
            Status
          </Text>
          <Text testID="form-status" style={[styles.statusValue, { color: palette.text }]}>
            {submitted ? `Submitted: ${submittedName}` : "Ready"}
          </Text>
          <Text
            testID="form-timestamp"
            style={[styles.timestamp, { color: palette.secondaryText }]}
          >
            {timestamp}
          </Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: 16,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 24,
  },
  section: {
    borderCurve: "continuous",
    borderRadius: 24,
    padding: 12,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  input: {
    borderCurve: "continuous",
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    fontSize: 17,
    paddingHorizontal: 12,
    paddingVertical: 13,
  },
  toggleRow: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: 16,
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontSize: 17,
    fontWeight: "600",
  },
  toggleSubtitle: {
    fontSize: 14,
    lineHeight: 20,
  },
  submitButton: {
    alignItems: "center",
    borderCurve: "continuous",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  submitButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "600",
  },
  statusCard: {
    borderCurve: "continuous",
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 8,
    padding: 12,
  },
  statusLabel: {
    fontSize: 13,
    fontWeight: "600",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  statusValue: {
    fontSize: 20,
    fontWeight: "600",
  },
  timestamp: {
    fontSize: 14,
  },
});
