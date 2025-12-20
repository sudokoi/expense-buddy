import React from "react";
import {
  YStack,
  Text,
  XStack,
  H4,
  Button,
  Card,
  useTheme,
  H6,
  Input,
  Dialog,
  Label,
  Select,
  Adapt,
  Sheet,
} from "tamagui";
import { Check, ChevronDown, Calendar } from "@tamagui/lucide-icons";
import { SectionList, Platform } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import DateTimePicker from "@react-native-community/datetimepicker";
import { useExpenses } from "../../context/ExpenseContext";
import { CATEGORIES } from "../../constants/categories";
import { Trash, Edit3 } from "@tamagui/lucide-icons";
import { format, parseISO } from "date-fns";
import { useNotifications } from "../../context/notification-context";
import type { ExpenseCategory } from "../../types/expense";
import { syncDownMore } from "../../services/sync-manager";

export default function HistoryScreen() {
  const { state, deleteExpense, editExpense, replaceAllExpenses } =
    useExpenses();
  const { addNotification } = useNotifications();
  const theme = useTheme();
  const [editingExpense, setEditingExpense] = React.useState<{
    id: string;
    amount: string;
    category: ExpenseCategory;
    note: string;
    date: string; // ISO date string
  } | null>(null);
  const [showDatePicker, setShowDatePicker] = React.useState(false);
  const [deletingExpenseId, setDeletingExpenseId] = React.useState<
    string | null
  >(null);
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);

  const groupedExpenses = React.useMemo(() => {
    const grouped: { title: string; data: typeof state.expenses }[] = [];
    const sorted = [...state.expenses].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sorted.forEach((expense) => {
      const dateKey = format(parseISO(expense.date), "dd/MM/yyyy");
      const existing = grouped.find((g) => g.title === dateKey);
      if (existing) {
        existing.data.push(expense);
      } else {
        grouped.push({ title: dateKey, data: [expense] });
      }
    });
    return grouped;
  }, [state.expenses]);

  const handleDelete = (id: string) => {
    setDeletingExpenseId(id);
  };

  const confirmDelete = () => {
    if (deletingExpenseId) {
      deleteExpense(deletingExpenseId);
      addNotification("Expense deleted", "success");
      setDeletingExpenseId(null);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !hasMore) return;

    setIsLoadingMore(true);
    try {
      const result = await syncDownMore(state.expenses, 7);

      if (result.success && result.expenses) {
        replaceAllExpenses(result.expenses);
        setHasMore(result.hasMore || false);
        addNotification(result.message, "success");
      } else {
        addNotification(result.error || result.message, "error");
      }
    } catch (error) {
      addNotification("Failed to load more expenses", "error");
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (state.expenses.length === 0) {
    return (
      <YStack
        flex={1}
        style={{ alignItems: "center", justifyContent: "center", padding: 16 }}
      >
        <Text
          style={{
            fontSize: 24,
            color: (theme.gray10?.val as string) || "gray",
          }}
        >
          No expenses yet.
        </Text>
        <Text
          style={{
            fontSize: 16,
            color: (theme.gray8?.val as string) || "gray",
            marginTop: 8,
          }}
        >
          Add one from the + tab.
        </Text>
      </YStack>
    );
  }

  return (
    <YStack
      flex={1}
      style={{
        backgroundColor: (theme.background?.val as string) || "white",
        paddingHorizontal: 16,
        paddingTop: 16,
      }}
    >
      <H4 style={{ marginBottom: 16 }}>Expense History</H4>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deletingExpenseId}
        onOpenChange={(open) => !open && setDeletingExpenseId(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            bordered
            elevate
            key="content"
            animation={[
              "quick",
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
          >
            <Dialog.Title>Delete Expense</Dialog.Title>
            <Dialog.Description>
              Are you sure you want to delete this expense? This action cannot
              be undone.
            </Dialog.Description>
            <XStack gap="$3" style={{ justifyContent: "flex-end" }}>
              <Dialog.Close asChild>
                <Button>Cancel</Button>
              </Dialog.Close>
              <Button theme="red" onPress={confirmDelete}>
                Delete
              </Button>
            </XStack>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog
        open={!!editingExpense}
        onOpenChange={(open) => {
          if (!open) {
            setEditingExpense(null);
            setShowDatePicker(false);
          }
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay
            key="overlay"
            animation="quick"
            opacity={0.5}
            enterStyle={{ opacity: 0 }}
            exitStyle={{ opacity: 0 }}
          />
          <Dialog.Content
            bordered
            elevate
            key="content"
            animation={[
              "quick",
              {
                opacity: {
                  overshootClamping: true,
                },
              },
            ]}
            enterStyle={{ x: 0, y: -20, opacity: 0, scale: 0.9 }}
            exitStyle={{ x: 0, y: 10, opacity: 0, scale: 0.95 }}
            gap="$4"
          >
            <Dialog.Title>Edit Expense</Dialog.Title>
            <Dialog.Description>Update the expense details</Dialog.Description>

            <KeyboardAwareScrollView bottomOffset={20}>
              <YStack gap="$3">
                <YStack gap="$2">
                  <Label htmlFor="date">Date</Label>
                  <Button
                    onPress={() => setShowDatePicker(true)}
                    icon={Calendar}
                  >
                    {editingExpense?.date
                      ? format(parseISO(editingExpense.date), "dd/MM/yyyy")
                      : "Select date"}
                  </Button>
                  {showDatePicker && (
                    <DateTimePicker
                      value={
                        editingExpense?.date
                          ? parseISO(editingExpense.date)
                          : new Date()
                      }
                      mode="date"
                      display={Platform.OS === "ios" ? "spinner" : "default"}
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === "ios");
                        if (selectedDate && event.type !== "dismissed") {
                          // Preserve the original time from the expense
                          const originalDate = editingExpense?.date
                            ? parseISO(editingExpense.date)
                            : new Date();
                          selectedDate.setHours(
                            originalDate.getHours(),
                            originalDate.getMinutes(),
                            originalDate.getSeconds(),
                            originalDate.getMilliseconds()
                          );
                          setEditingExpense((prev) =>
                            prev
                              ? {
                                  ...prev,
                                  date: selectedDate.toISOString(),
                                }
                              : null
                          );
                        }
                      }}
                    />
                  )}
                  {showDatePicker && Platform.OS === "ios" && (
                    <Button size="$3" onPress={() => setShowDatePicker(false)}>
                      Done
                    </Button>
                  )}
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="amount">Amount (₹)</Label>
                  <Input
                    id="amount"
                    value={editingExpense?.amount || ""}
                    onChangeText={(text) =>
                      setEditingExpense((prev) =>
                        prev ? { ...prev, amount: text } : null
                      )
                    }
                    placeholder="Enter amount"
                    keyboardType="numeric"
                  />
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="category">Category</Label>
                  <Select
                    id="category"
                    value={editingExpense?.category || ""}
                    onValueChange={(value) =>
                      setEditingExpense((prev) =>
                        prev
                          ? { ...prev, category: value as ExpenseCategory }
                          : null
                      )
                    }
                  >
                    <Select.Trigger iconAfter={ChevronDown}>
                      <Select.Value placeholder="Select category" />
                    </Select.Trigger>

                    <Adapt when="sm" platform="touch">
                      <Sheet
                        modal
                        dismissOnSnapToBottom
                        animationConfig={{
                          type: "spring",
                          damping: 20,
                          mass: 1.2,
                          stiffness: 250,
                        }}
                      >
                        <Sheet.Frame>
                          <Sheet.ScrollView>
                            <Adapt.Contents />
                          </Sheet.ScrollView>
                        </Sheet.Frame>
                        <Sheet.Overlay
                          animation="lazy"
                          enterStyle={{ opacity: 0 }}
                          exitStyle={{ opacity: 0 }}
                        />
                      </Sheet>
                    </Adapt>

                    <Select.Content zIndex={200000}>
                      <Select.Viewport>
                        <Select.Group>
                          {CATEGORIES.map((cat, idx) => (
                            <Select.Item
                              key={cat.value}
                              index={idx}
                              value={cat.value}
                            >
                              <Select.ItemText>{cat.label}</Select.ItemText>
                              <Select.ItemIndicator marginLeft="auto">
                                <Check size={16} />
                              </Select.ItemIndicator>
                            </Select.Item>
                          ))}
                        </Select.Group>
                      </Select.Viewport>
                    </Select.Content>
                  </Select>
                </YStack>

                <YStack gap="$2">
                  <Label htmlFor="note">Note</Label>
                  <Input
                    id="note"
                    value={editingExpense?.note || ""}
                    onChangeText={(text) =>
                      setEditingExpense((prev) =>
                        prev ? { ...prev, note: text } : null
                      )
                    }
                    placeholder="Enter note (optional)"
                  />
                </YStack>
              </YStack>

              <XStack
                gap="$3"
                style={{ justifyContent: "flex-end", marginTop: 16 }}
              >
                <Dialog.Close asChild>
                  <Button>Cancel</Button>
                </Dialog.Close>
                <Button
                  onPress={() => {
                    if (editingExpense) {
                      const expense = state.expenses.find(
                        (e) => e.id === editingExpense.id
                      );
                      if (expense) {
                        const amount = parseFloat(editingExpense.amount);
                        if (isNaN(amount) || amount <= 0) {
                          addNotification(
                            "Please enter a valid amount",
                            "error"
                          );
                          return;
                        }
                        editExpense(editingExpense.id, {
                          amount,
                          category: editingExpense.category,
                          date: editingExpense.date, // Use the edited date
                          note: editingExpense.note,
                        });
                        addNotification("Expense updated", "success");
                        setEditingExpense(null);
                        setShowDatePicker(false);
                      }
                    }
                  }}
                >
                  Save
                </Button>
              </XStack>
            </KeyboardAwareScrollView>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>

      <SectionList
        sections={groupedExpenses}
        keyExtractor={(item) => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <YStack
            style={{
              backgroundColor: (theme.background?.val as string) || "white",
              paddingVertical: 8,
            }}
          >
            <H6 style={{ color: (theme.gray11?.val as string) || "gray" }}>
              {title}
            </H6>
          </YStack>
        )}
        renderItem={({ item }) => {
          const categoryInfo = CATEGORIES.find(
            (cat) => item.category === cat.value
          );

          if (!categoryInfo) {
            return null;
          }

          const Icon = categoryInfo.icon;

          return (
            <Card
              bordered
              style={{
                marginBottom: 12,
                padding: 12,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
              }}
              animation="lazy"
              hoverStyle={{ scale: 1.01 }}
            >
              <XStack flex={1} style={{ gap: 12, alignItems: "center" }}>
                <YStack
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 16,
                    backgroundColor: categoryInfo.color,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Icon color="white" size={20} />
                </YStack>
                <YStack flex={1}>
                  <Text style={{ fontWeight: "bold", fontSize: 16 }}>
                    {item.note || categoryInfo.label}
                  </Text>
                  <Text
                    style={{
                      color: (theme.gray10?.val as string) || "gray",
                      fontSize: 12,
                    }}
                  >
                    {format(parseISO(item.date), "h:mm a")} •{" "}
                    {categoryInfo.label}
                  </Text>
                </YStack>
              </XStack>

              <XStack style={{ alignItems: "center", gap: 12 }}>
                <Text
                  style={{
                    fontWeight: "bold",
                    fontSize: 16,
                    color: (theme.red10?.val as string) || "red",
                  }}
                >
                  -₹{item.amount.toFixed(2)}
                </Text>
                <Button
                  size="$2"
                  icon={Edit3}
                  chromeless
                  onPress={() => {
                    setEditingExpense({
                      id: item.id,
                      amount: item.amount.toString(),
                      category: item.category,
                      note: item.note || "",
                      date: item.date,
                    });
                  }}
                  aria-label="Edit"
                />
                <Button
                  size="$2"
                  icon={Trash}
                  chromeless
                  onPress={() => handleDelete(item.id)}
                  aria-label="Delete"
                />
              </XStack>
            </Card>
          );
        }}
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={
          hasMore ? (
            <YStack style={{ padding: 16, alignItems: "center" }}>
              <Button
                size="$4"
                onPress={handleLoadMore}
                disabled={isLoadingMore}
              >
                {isLoadingMore ? "Loading..." : "Load More"}
              </Button>
            </YStack>
          ) : null
        }
      />
    </YStack>
  );
}
