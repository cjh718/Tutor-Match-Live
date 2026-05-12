import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle, TextStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import * as Haptics from "expo-haptics";

interface ButtonProps {
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary" | "destructive" | "outline" | "ghost";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export function Button({
  onPress,
  title,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}: ButtonProps) {
  const colors = useColors();

  const handlePress = () => {
    if (disabled || loading) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  const getBackgroundColor = () => {
    if (variant === "primary") return colors.primary;
    if (variant === "secondary") return colors.secondary;
    if (variant === "destructive") return colors.destructive;
    if (variant === "outline" || variant === "ghost") return "transparent";
    return colors.primary;
  };

  const getTextColor = () => {
    if (variant === "primary") return colors.primaryForeground;
    if (variant === "secondary") return colors.secondaryForeground;
    if (variant === "destructive") return colors.destructiveForeground;
    if (variant === "outline") return colors.foreground;
    if (variant === "ghost") return colors.primary;
    return colors.primaryForeground;
  };

  const getBorderColor = () => {
    if (variant === "outline") return colors.border;
    return "transparent";
  };

  const getHeight = () => {
    if (size === "sm") return 36;
    if (size === "md") return 48;
    if (size === "lg") return 56;
    return 48;
  };

  const getFontSize = () => {
    if (size === "sm") return 14;
    if (size === "md") return 16;
    if (size === "lg") return 18;
    return 16;
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === "outline" ? 1 : 0,
          height: getHeight(),
          borderRadius: colors.radius,
          opacity: pressed || disabled ? 0.7 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.text,
              {
                color: getTextColor(),
                fontSize: getFontSize(),
              },
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
    gap: 8,
  },
  text: {
    fontWeight: "600",
  },
});
