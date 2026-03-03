import { useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";

export default function Form() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedName, setSubmittedName] = useState("");
  const [timestamp, setTimestamp] = useState(new Date().toLocaleTimeString());

  const canSubmit = name.length > 0 && email.length > 0 && termsAccepted;

  useEffect(() => {
    const interval = setInterval(() => {
      setTimestamp(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = () => {
    if (!canSubmit) return;
    setSubmitted(true);
    setSubmittedName(name);
  };

  return (
    <ScrollView
      style={{ flex: 1, padding: 20, paddingTop: 40 }}
      keyboardShouldPersistTaps="handled"
    >
      <TextInput
        testID="form-name"
        placeholder="Name"
        value={name}
        onChangeText={setName}
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 16,
        }}
      />

      <TextInput
        testID="form-email"
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        style={{
          borderWidth: 1,
          borderColor: "#ccc",
          borderRadius: 8,
          padding: 12,
          marginBottom: 12,
          fontSize: 16,
        }}
      />

      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <Switch
          testID="form-terms"
          value={termsAccepted}
          onValueChange={setTermsAccepted}
        />
        <Text style={{ marginLeft: 8, fontSize: 16 }}>I accept the terms</Text>
      </View>

      <Pressable
        testID="form-submit"
        disabled={!canSubmit}
        onPress={handleSubmit}
        accessibilityState={{ disabled: !canSubmit }}
        style={({ pressed }) => ({
          padding: 16,
          borderRadius: 8,
          backgroundColor: !canSubmit ? "#ccc" : pressed ? "orange" : "tomato",
          alignItems: "center",
          marginBottom: 16,
        })}
      >
        <Text style={{ color: "white", fontSize: 16, fontWeight: "bold" }}>
          Submit
        </Text>
      </Pressable>

      <Text testID="form-status" style={{ fontSize: 16, marginBottom: 8 }}>
        {submitted ? `Submitted: ${submittedName}` : "Ready"}
      </Text>

      <Text testID="form-timestamp" style={{ fontSize: 14, color: "#888" }}>
        {timestamp}
      </Text>
    </ScrollView>
  );
}
