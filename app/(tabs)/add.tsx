import { useState, useMemo } from "react";
import {
  YStack,
  XStack,
  Text,
  Input,
  Button,
  TextArea,
  useTheme,
  Card,
  H4,
  Label,
} from "tamagui";
import { useRouter, Href } from "expo-router";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useExpenses } from "../../context/ExpenseContext";
import { CATEGORIES } from "../../constants/categories";
import { ExpenseCategory } from "../../types/expense";
import { Calendar, Check } from "@tamagui/lucide-icons";
import { Alert } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import {
  parseExpression,
  hasOperators,
  formatAmount,
} from "../../utils/expression-parser";

export default function AddExpenseScreen() {
  const router = useRouter();
  const theme = useTheme();
  const { addExpense } = useExpenses();

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState("");
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Compute preview when expression contains operators
  const expressionPreview = useMemo(() => {
    if (!amount.trim() || !hasOperators(amount)) {
      return null;
    }
    const result = parseExpression(amount);
    if (result.success && result.value !== undefined) {
      return formatAmount(result.value);
    }
    return null;
  }, [amount]);

  const handleSave = () => {
    if (!amount.trim()) {
      Alert.alert("Invalid Amount", "Please enter a valid amount");
      return;
    }

    // Parse the expression
    const result = parseExpression(amount);

    if (!result.success) {
      Alert.alert(
        "Invalid Expression",
        result.error || "Please enter a valid expression"
      );
      return;
    }

    addExpense({
      amount: result.value!,
      category,
      date: date.toISOString(),
      note,
    });

    // Reset and go back or to history
    setAmount("");
    setNote("");
    router.push("/(tabs)/history" as Href);
  };

  const onChangeDate = (_event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(false);
    setDate(currentDate);
  };

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: theme.background.val as string }}
      contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      bottomOffset={50}
    >
      <YStack
        space="$4"
        style={{ maxWidth: 600, alignSelf: "center", width: "100%" }}
      >
        <H4 style={{ textAlign: "center", marginBottom: 8 }}>
          Add New Expense
        </H4>

        {/* Amount Input */}
        <YStack space="$2">
          <Label>Amount</Label>
          <XStack style={{ alignItems: "center" }}>
            <Input
              flex={1}
              size="$5"
              placeholder="0.00 or 100+50"
              keyboardType="default"
              value={amount}
              onChangeText={setAmount}
              borderWidth={2}
              borderColor="$borderColor"
              focusStyle={{ borderColor: "$blue10" }}
            />
          </XStack>
          {expressionPreview && (
            <Text fontSize="$3" color="$gray10">
              = ₹{expressionPreview}
            </Text>
          )}
        </YStack>

        {/* Category Selection */}
        <YStack space="$2">
          <Label>Category</Label>
          <XStack style={{ flexWrap: "wrap", gap: 12 }}>
            {CATEGORIES.map((cat) => {
              const isSelected = category === cat.value;
              return (
                <Card
                  key={cat.value}
                  bordered
                  animation="bouncy"
                  scale={0.97}
                  hoverStyle={{ scale: 1 }}
                  pressStyle={{ scale: 0.95 }}
                  style={{
                    backgroundColor: isSelected
                      ? cat.color
                      : (theme.background.val as string),
                    borderColor: isSelected
                      ? cat.color
                      : (theme.borderColor.val as string),
                    padding: 12,
                    borderRadius: 16,
                    width: "30%",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  onPress={() => setCategory(cat.value)}
                >
                  <Text
                    style={{
                      fontWeight: isSelected ? "bold" : "normal",
                      color: isSelected ? "white" : (theme.color.val as string),
                    }}
                  >
                    {cat.label}
                  </Text>
                </Card>
              );
            })}
          </XStack>
        </YStack>

        {/* Date Picker */}
        <YStack space="$2">
          <Label>Date</Label>
          <Button
            icon={<Calendar size="$1" />}
            size="$4"
            onPress={() => setShowDatePicker(true)}
            chromeless
            borderWidth={1}
          >
            {date.toLocaleDateString()}
          </Button>
          {showDatePicker && (
            <DateTimePicker
              testID="dateTimePicker"
              value={date}
              mode="date"
              display="default"
              onChange={onChangeDate}
            />
          )}
        </YStack>

        {/* Note Input */}
        <YStack gap="$2">
          <Label>Note (Optional)</Label>
          <TextArea
            placeholder="What was this for?"
            value={note}
            onChangeText={setNote}
            numberOfLines={3}
          />
        </YStack>

        {/* Save Button */}
        <Button
          style={{ marginTop: 16 }}
          size="$5"
          themeInverse
          onPress={handleSave}
          icon={<Check size="$2" />}
          fontWeight="bold"
        >
          Save Expense
        </Button>
        <Text fontSize={40} color="$color" fontWeight="bold">
          ₹{expressionPreview || amount || "0"}
        </Text>
      </YStack>
    </KeyboardAwareScrollView>
  );
}
