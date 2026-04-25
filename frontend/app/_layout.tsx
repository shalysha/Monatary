import { Stack } from "expo-router";
import { useFonts, Outfit_700Bold, Outfit_600SemiBold } from "@expo-google-fonts/outfit";
import {
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_700Bold,
} from "@expo-google-fonts/manrope";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  const [loaded] = useFonts({
    Outfit_700Bold,
    Outfit_600SemiBold,
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_700Bold,
  });
  if (!loaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color="#5C8065" />
      </View>
    );
  }
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#F7F5F0" } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-income" options={{ presentation: "modal" }} />
        <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#F7F5F0" },
});
