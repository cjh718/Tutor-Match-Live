import { StyleSheet, Text, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";

interface BadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "destructive" | "outline" | "blue";
  style?: ViewStyle;
}

export function Badge({ label, variant = "default", style }: BadgeProps) {
  const colors = useColors();

  const getVariantStyles = () => {
    switch (variant) {
      case "success":
        return { backgroundColor: colors.success, color: colors.successForeground };
      case "warning":
        return { backgroundColor: colors.accent, color: colors.accentForeground };
      case "destructive":
        return { backgroundColor: colors.destructive, color: colors.destructiveForeground };
      case "outline":
        return { backgroundColor: "transparent", color: colors.foreground, borderWidth: 1, borderColor: colors.border };
      case "blue":
        return { backgroundColor: colors.primary, color: colors.primaryForeground };
      default:
        return { backgroundColor: colors.secondary, color: colors.secondaryForeground };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: variantStyles.backgroundColor,
          borderColor: variantStyles.borderColor,
          borderWidth: variantStyles.borderWidth || 0,
        },
        style,
      ]}
    >
      <Text style={[styles.text, { color: variantStyles.color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
});
