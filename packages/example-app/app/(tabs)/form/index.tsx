import { ActionButton } from "@/components/ui/ActionButton";
import { SectionCard } from "@/components/ui/SectionCard";
import { StatusCard } from "@/components/ui/StatusCard";
import { useEffect, useState } from "react";
import { ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";

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
      <SectionCard title="Profile">
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
      </SectionCard>

      <SectionCard title="Preferences">
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
            <Text style={[styles.toggleTitle, { color: palette.text }]}>Accept terms</Text>
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
      </SectionCard>

      <SectionCard>
        <ActionButton
          testID="form-submit"
          label="Submit"
          disabled={!canSubmit}
          onPress={handleSubmit}
        />

        <StatusCard
          testID="form-status-card"
          label="Status"
          value={submitted ? `Submitted: ${submittedName}` : "Ready"}
          valueTestID="form-status"
          timestamp={timestamp}
          timestampTestID="form-timestamp"
        />
      </SectionCard>
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
});
