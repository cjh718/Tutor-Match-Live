import { StyleSheet, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { useColors } from "@/hooks/useColors";
import { forwardRef } from "react";

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  containerStyle?: ViewStyle;
}

export const Input = forwardRef<TextInput, InputProps>(
  ({ label, error, containerStyle, style, ...props }, ref) => {
    const colors = useColors();

    return (
      <View style={[styles.container, containerStyle]}>
        {label && <Text style={[styles.label, { color: colors.foreground }]}>{label}</Text>}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.mutedForeground}
          style={[
            styles.input,
            {
              backgroundColor: colors.background,
              borderColor: error ? colors.destructive : colors.border,
              color: colors.foreground,
              borderRadius: colors.radius,
            },
            style,
          ]}
          {...props}
        />
        {error && <Text style={[styles.error, { color: colors.destructive }]}>{error}</Text>}
      </View>
    );
  }
);

Input.displayName = "Input";

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 8,
  },
  input: {
    height: 48,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 16,
  },
  error: {
    fontSize: 12,
    marginTop: 4,
  },
});
