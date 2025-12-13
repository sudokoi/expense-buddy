import { format, parseISO, startOfDay, subDays } from "date-fns";
import {
  YStack,
  H4,
  XStack,
  Card,
  Text,
  Button,
  SizableText,
  ScrollView,
  useTheme,
} from "tamagui";
import { useToastController } from "@tamagui/toast";
import { BarChart } from "react-native-gifted-charts";
import { useExpenses } from "../../context/ExpenseContext";
import { useRouter, Href } from "expo-router";
import { Dimensions } from "react-native";
import { CATEGORIES } from "../../constants/categories";
import React from "react";

export default function DashboardScreen() {
  const { state, clearSyncNotification } = useExpenses();
  const theme = useTheme();
  const router = useRouter();
  const screenWidth = Dimensions.get("window").width;
  const toast = useToastController();

  const totalExpenses = state.expenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );
  const recentExpenses = state.expenses.slice(0, 5);

  // Group by Date -> Category
  const chartData = React.useMemo(() => {
    const grouped: Record<string, Record<string, number>> = {};
    const last7Days: string[] = [];

    // Generate last 7 days keys
    for (let i = 6; i >= 0; i--) {
      const d = subDays(new Date(), i);
      last7Days.push(format(d, "yyyy-MM-dd"));
    }

    // Aggregate
    state.expenses.forEach((e) => {
      const dateKey = e.date.split("T")[0];
      if (!grouped[dateKey]) grouped[dateKey] = {};
      if (!grouped[dateKey][e.category]) grouped[dateKey][e.category] = 0;
      grouped[dateKey][e.category] += e.amount;
    });

    // Format for Chart - only include days with actual expenses
    return last7Days
      .map((dateKey) => {
        const dayExpenses = grouped[dateKey] || {};
        const stacks = Object.keys(dayExpenses).map((cat) => {
          const categoryConfig = CATEGORIES.find((c) => c.value === cat);
          return {
            value: dayExpenses[cat],
            color: categoryConfig?.color || "#888",
            marginBottom: 2,
          };
        });

        return {
          stacks: stacks,
          label: format(parseISO(dateKey), "dd/MM"),
          onPress: () => router.push(`/day/${dateKey}` as any),
          dateKey, // Keep for filtering
        };
      })
      .filter((item) => item.stacks.length > 0); // Only show days with data
  }, [state.expenses, theme]);

  const hasData = chartData.some((d) => d.stacks && d.stacks.length > 0);

  // Show toast when sync notification is available
  React.useEffect(() => {
    if (state.syncNotification) {
      toast.show(state.syncNotification.message, {
        message: `${state.syncNotification.newItemsCount} new, ${state.syncNotification.updatedItemsCount} updated`,
        duration: 4000,
      });
      // Clear notification after showing
      setTimeout(() => clearSyncNotification(), 500);
    }
  }, [state.syncNotification]);

  return (
    <ScrollView
      flex={1}
      style={{ backgroundColor: theme.background.val as string }}
      contentContainerStyle={{ padding: 20 } as any}
    >
      {/* Header */}
      <XStack
        style={{
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
        }}
      >
        <YStack>
          <H4>Dashboard</H4>
          <Text style={{ color: (theme.gray10?.val as string) || "gray" }}>
            Welcome back!
          </Text>
        </YStack>
        <Button
          size="$3"
          themeInverse
          onPress={() => router.push("/(tabs)/add" as any)}
        >
          + Add
        </Button>
      </XStack>

      {/* Summary Cards */}
      <XStack style={{ gap: 12, marginBottom: 20 }}>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          style={{ padding: 16, backgroundColor: theme.blue3.val as string }}
        >
          <Text
            style={{
              color: theme.blue11.val as string,
              fontWeight: "bold",
              textTransform: "uppercase",
              fontSize: 13,
            }}
          >
            Total Spent
          </Text>
          <H4 style={{ color: theme.blue12.val as string, marginTop: 8 }}>
            ₹{totalExpenses.toFixed(2)}
          </H4>
        </Card>
        <Card
          flex={1}
          bordered
          animation="bouncy"
          hoverStyle={{ scale: 1.02 }}
          style={{ padding: 16, backgroundColor: theme.green3.val as string }}
        >
          <Text
            style={{
              color: theme.green11.val as string,
              fontWeight: "bold",
              textTransform: "uppercase",
              fontSize: 13,
            }}
          >
            Entries
          </Text>
          <H4 style={{ color: theme.green12.val as string, marginTop: 8 }}>
            {state.expenses.length}
          </H4>
        </Card>
      </XStack>

      {/* Chart Section */}
      <YStack gap="$4" style={{ marginBottom: 20 }}>
        <H4 fontSize="$5">Last 7 Days</H4>
        {hasData ? (
          <YStack style={{ alignItems: "center", justifyContent: "center" }}>
            <BarChart
              stackData={chartData}
              barWidth={24}
              noOfSections={3}
              barBorderRadius={4}
              yAxisThickness={0}
              xAxisThickness={0}
              height={200}
              width={screenWidth - 60}
              isAnimated
              xAxisLabelTextStyle={{
                color: theme.color.val as string,
                fontSize: 10,
              }}
              yAxisTextStyle={{ color: theme.color.val as string }}
              spacing={20}
            />
          </YStack>
        ) : (
          <Card
            bordered
            style={{
              padding: 16,
              alignItems: "center",
              justifyContent: "center",
              height: 150,
            }}
          >
            <Text style={{ color: (theme.gray10?.val as string) || "gray" }}>
              No data to display yet.
            </Text>
          </Card>
        )}
      </YStack>

      {/* Recent Transactions List (Mini) */}
      <YStack space="$3">
        <XStack
          style={{ justifyContent: "space-between", alignItems: "center" }}
        >
          <H4 fontSize="$5">Recent Transactions</H4>
          <Button
            chromeless
            size="$2"
            onPress={() => router.push("/(tabs)/history" as any)}
          >
            See All
          </Button>
        </XStack>

        {recentExpenses.length === 0 && (
          <Text style={{ color: (theme.gray10?.val as string) || "gray" }}>
            No recent transactions.
          </Text>
        )}

        {recentExpenses.map((expense) => {
          const cat = CATEGORIES.find((c) => c.value === expense.category);
          return (
            <Card
              key={expense.id}
              bordered
              style={{
                padding: 12,
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <XStack style={{ gap: 12, alignItems: "center" }}>
                <YStack
                  style={{
                    backgroundColor:
                      cat?.color || (theme.gray8?.val as string) || "gray",
                    padding: 8,
                    borderRadius: 8,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {cat?.icon && (
                    // @ts-ignore
                    <cat.icon color="white" size={16} />
                  )}
                </YStack>
                <YStack>
                  <SizableText size="$4" fontWeight="bold">
                    {cat?.label}
                  </SizableText>
                  <Text
                    style={{
                      color: (theme.gray10?.val as string) || "gray",
                      fontSize: 12,
                    }}
                  >
                    {format(parseISO(expense.date), "dd/MM/yyyy")}
                  </Text>
                </YStack>
              </XStack>
              <H4
                style={{
                  fontWeight: "bold",
                  color: (theme.red10?.val as string) || "red",
                }}
              >
                -₹{expense.amount.toFixed(2)}
              </H4>
            </Card>
          );
        })}
      </YStack>
    </ScrollView>
  );
}
