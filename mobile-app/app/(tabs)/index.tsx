import { View, Text } from "react-native";

export default function HomeScreen() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: "#050b16",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: "white",
          fontSize: 34,
          fontWeight: "bold",
        }}
      >
        LearnIQ Track
      </Text>

      <Text
        style={{
          color: "#7EA6FF",
          marginTop: 10,
          fontSize: 16,
        }}
      >
        Mobile Foundation Ready 🚀
      </Text>
    </View>
  );
}