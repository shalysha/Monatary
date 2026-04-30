import { Stack } from "expo-router";
import {
  PlayfairDisplay_700Bold,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold_Italic,
} from "@expo-google-fonts/playfair-display";
import {
  SourceSans3_400Regular,
  SourceSans3_500Medium,
  SourceSans3_700Bold,
} from "@expo-google-fonts/source-sans-3";
import { useFonts } from "expo-font";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { COLORS } from "../../theme";

export default function RootLayout() {
  const [loaded] = useFonts({
    PlayfairDisplay_700Bold,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold_Italic,
    SourceSans3_400Regular,
    SourceSans3_500Medium,
    SourceSans3_700Bold,
  });

  if (!loaded) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="add-income"  options={{ presentation: "modal" }} />
        <Stack.Screen name="add-expense" options={{ presentation: "modal" }} />
        <Stack.Screen name="recurring"   options={{ presentation: "modal" }} />
        <Stack.Screen name="upcoming"    options={{ presentation: "modal" }} />
      </Stack>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.background,
  },
});