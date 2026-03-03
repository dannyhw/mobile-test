import { NativeTabs } from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Counter</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="number.circle" md="pin" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="form">
        <NativeTabs.Trigger.Label>Form</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="doc.text" md="description" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="list">
        <NativeTabs.Trigger.Label>List</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="animations">
        <NativeTabs.Trigger.Label>Animations</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="sparkles" md="animation" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
