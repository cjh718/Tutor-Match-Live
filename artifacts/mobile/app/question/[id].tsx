import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  RefreshControl,
  Platform,
  Pressable,
  Modal,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Feather } from "@expo/vector-icons";
import { useAuth } from "@/contexts/AuthContext";
import {
  useGetQuestion,
  getGetQuestionQueryKey,
  useGetBids,
  getGetBidsQueryKey,
  useUpdateBid,
  useCreateBid,
  customFetch,
} from "@workspace/api-client-react";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useColors } from "@/hooks/useColors";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Linking } from "react-native";
import { WebView } from "react-native-webview";

function formatSGT(dateStr: string | Date | null | undefined) {
  if (!dateStr) return "TBD";
  return new Date(dateStr).toLocaleString("en-SG", {
    timeZone: "Asia/Singapore",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function statusVariant(status: string) {
  if (status === "Open") return "blue";
  if (status === "BidReceived") return "blue";
  if (status === "Scheduled" || status === "Confirmed") return "success";
  if (status === "Matched" ) return "success";
  if (status === "Completed") return "outline";
  return "destructive";
}

function StarRating({ rating }: { rating: number | null | undefined }) {
  const colors = useColors();
  const stars = Math.round(rating ?? 0);
  return (
    <View style={{ flexDirection: "row", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Feather
          key={i}
          name="star"
          size={12}
          color={i <= stars ? colors.accent : colors.border}
        />
      ))}
    </View>
  );
}

function BidTimingInfo({ bid }: { bid: any }) {
  const colors = useColors();
  const now = new Date();
  const expiry = bid.windowExpiresAt ? new Date(bid.windowExpiresAt) : null;
  const nowValid = bid.offerNow && expiry && expiry > now;
  const minutesLeft = expiry
    ? Math.max(0, Math.ceil((expiry.getTime() - now.getTime()) / 60000))
    : 0;

  if (!bid.offerNow && !bid.specificTime) return null;

  return (
    <View style={{ gap: 6, marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border }}>
      <Text style={{ fontSize: 12, fontWeight: "600", color: colors.mutedForeground, marginBottom: 2 }}>
        AVAILABILITY
      </Text>
      {bid.offerNow && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="zap" size={14} color={nowValid ? "#22c55e" : colors.mutedForeground} />
          <Text style={{ fontSize: 13, color: nowValid ? "#22c55e" : colors.mutedForeground }}>
            {nowValid ? `Available NOW (${minutesLeft}m left)` : "NOW offer expired"}
          </Text>
        </View>
      )}
      {bid.specificTime && (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Feather name="calendar" size={14} color={colors.primary} />
          <Text style={{ fontSize: 13, color: colors.foreground }}>
            {formatSGT(bid.specificTime)}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function QuestionDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const questionId = parseInt(id, 10);
  const { user } = useAuth();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const isStudent = user?.role === "student";
  const isTutor = user?.role === "tutor";

  const {
    data: question,
    isLoading: qLoading,
    refetch,
  } = useGetQuestion(questionId, {
    query: {
      enabled: !!questionId,
      queryKey: getGetQuestionQueryKey(questionId),
    },
  });

  const isOwner = isStudent && question?.studentId === user?.userId;

  const {
    data: bids,
    isLoading: bLoading,
    refetch: refetchBids,
  } = useGetBids(
    { questionId },
    {
      query: {
        enabled: !!questionId,
        queryKey: getGetBidsQueryKey({ questionId }),
      },
    },
  );

  const updateBid = useUpdateBid();
  const createBid = useCreateBid();

  // Bid form state (tutor)
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidErrors, setBidErrors] = useState<Record<string, string>>({});

  // Scheduling options (tutor bid form)
  const [offerNow, setOfferNow] = useState(true);
  const [offerSpecific, setOfferSpecific] = useState(false);
  const [specificDate, setSpecificDate] = useState<Date>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return d;
  });
  const [showSpecificDatePicker, setShowSpecificDatePicker] = useState(false);
  const [showSpecificTimePicker, setShowSpecificTimePicker] = useState(false);
  const [showFileViewer, setShowFileViewer] = useState(false);
  const [fileUrl, setFileUrl] = useState("");

  const myBid = isTutor
    ? bids?.find((b) => b.tutorId === user?.userId)
    : undefined;

  const onSpecificDateChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowSpecificDatePicker(false);
    if (date) {
      const merged = new Date(date);
      merged.setHours(specificDate.getHours(), specificDate.getMinutes(), 0, 0);
      setSpecificDate(merged);
    }
  };

  const onSpecificTimeChange = (_: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === "android") setShowSpecificTimePicker(false);
    if (date) {
      const merged = new Date(specificDate);
      merged.setHours(date.getHours(), date.getMinutes(), 0, 0);
      setSpecificDate(merged);
    }
  };

  const formattedSpecificDate = specificDate.toLocaleDateString("en-SG", {
    timeZone: "Asia/Singapore",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const formattedSpecificTime = specificDate.toLocaleTimeString("en-SG", {
    timeZone: "Asia/Singapore",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const handleAcceptBid = (bid: any) => {
    const now = new Date();
    const expiry = bid.windowExpiresAt ? new Date(bid.windowExpiresAt) : null;
    const hasValidNow = bid.offerNow && expiry && expiry > now;
    const hasSpecific = !!bid.specificTime;

    const doConfirm = (selectedTime: "now" | "specific") => {
      const timeLabel =
        selectedTime === "now" ? "Now" : formatSGT(bid.specificTime);
      Alert.alert(
        "Accept this bid?",
        `Session time: ${timeLabel}\nAll other bids will be rejected.`,
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Accept",
            onPress: async () => {
              try {
                await updateBid.mutateAsync({
                  bidId: bid.bidId,
                  data: { status: "Accepted", selectedTime } as any,
                });
                await queryClient.invalidateQueries({
                  queryKey: getGetBidsQueryKey({ questionId }),
                });
                await queryClient.invalidateQueries({
                  queryKey: getGetQuestionQueryKey(questionId),
                });
                Alert.alert(
                  "Session Confirmed!",
                  `Your session is scheduled for ${timeLabel}. Check your Sessions tab.`,
                );
              } catch {
                Alert.alert("Error", "Failed to accept bid.");
              }
            },
          },
        ],
      );
    };

    if (hasValidNow && hasSpecific) {
      Alert.alert(
        "Choose Session Time",
        "The tutor offered two time options:",
        [
          { text: `⚡ Now`, onPress: () => doConfirm("now") },
          {
            text: `📅 ${formatSGT(bid.specificTime)}`,
            onPress: () => doConfirm("specific"),
          },
          { text: "Cancel", style: "cancel" },
        ],
      );
    } else if (hasValidNow) {
      doConfirm("now");
    } else if (hasSpecific) {
      doConfirm("specific");
    } else {
      Alert.alert(
        "No valid time",
        "The NOW window has expired and no specific time was offered.",
      );
    }
  };

  const handleWithdrawBid = async (bidId: number) => {
    Alert.alert(
      "Withdraw Bid",
      "Are you sure you want to withdraw your bid? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            try {
              await updateBid.mutateAsync({
                bidId,
                data: { status: "Withdrawn" as any },
              });
              await queryClient.invalidateQueries({
                queryKey: getGetBidsQueryKey({ questionId }),
              });
              Alert.alert("Success", "Your bid has been withdrawn");
            } catch {
              Alert.alert("Error", "Failed to withdraw bid");
            }
          },
        },
      ],
    );
  };

  const handleSubmitBid = async () => {
    const e: Record<string, string> = {};
    const price = parseFloat(bidPrice);
    if (!bidPrice || isNaN(price) || price <= 0)
      e.price = "Enter a valid price";
    if (!bidMessage.trim()) e.message = "Message is required";
    if (!offerNow && !offerSpecific)
      e.schedule = "Select at least one scheduling option";
    if (offerSpecific && specificDate <= new Date())
      e.schedule = "Specific time must be in the future";
    if (Object.keys(e).length > 0) {
      setBidErrors(e);
      return;
    }

    try {
      await createBid.mutateAsync({
        data: {
          questionId,
          price,
          message: bidMessage.trim(),
          offerNow,
          specificTime: offerSpecific ? specificDate.toISOString() : undefined,
        } as any,
      });
      await queryClient.invalidateQueries({
        queryKey: getGetBidsQueryKey({ questionId }),
      });
      setShowBidForm(false);
      setBidPrice("");
      setBidMessage("");
      setOfferNow(true);
      setOfferSpecific(false);
    } catch {
      Alert.alert("Error", "Failed to submit bid. Please try again.");
    }
  };

  if (qLoading) {
    return (
      <View
        style={[
          styles.container,
          { backgroundColor: colors.background, padding: 20 },
        ]}
      >
        <Skeleton height={120} style={{ marginBottom: 16 }} />
        <Skeleton height={200} />
      </View>
    );
  }

  if (!question) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle" title="Question not found" />
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 40 },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => {
            refetch();
            refetchBids();
          }}
          tintColor={colors.primary}
        />
      }
    >
      {/* Question card */}
      <Card style={styles.questionCard}>
        <View style={styles.qHeader}>
          <Badge
            label={
              question.status === "BidReceived"
                ? "Bids Received"
                : question.status === "Scheduled"
                  ? "Session Scheduled"
                  : question.status
            }
            variant={statusVariant(question.status)}
          />
          <Text style={[styles.subject, { color: colors.mutedForeground }]}>
            {question.subject}
          </Text>
        </View>
        <Text style={[styles.questionTitle, { color: colors.foreground }]}>
          {question.title}
        </Text>
        <Text style={[styles.description, { color: colors.mutedForeground }]}>
          {question.description}
        </Text>

        {/* ATTACHMENT */}
        {question.attachmentUrl && (
          <Pressable
            onPress={() => {
              let fullUrl = question.attachmentUrl;
              if (fullUrl.startsWith('/uploads/')) {
                const baseUrl = `https://${process.env.EXPO_PUBLIC_DOMAIN}`;
                fullUrl = `${baseUrl}${fullUrl}`;
              }
              if (Platform.OS === 'web') {
                Linking.openURL(fullUrl);
              } else {
                setFileUrl(fullUrl);
                setShowFileViewer(true);
              }
            }}
            style={styles.attachmentRow}
          >
            <Feather name="paperclip" size={14} color={colors.primary} />
            <Text style={[styles.attachmentText, { color: colors.primary }]}>
              View Attachment
            </Text>
            <Feather name="eye" size={14} color={colors.primary} />
          </Pressable>
        )}
        
        <View style={styles.qMeta}>
          {question.optionalBudget != null && (
            <View style={styles.metaItem}>
              <Feather
                name="dollar-sign"
                size={14}
                color={colors.mutedForeground}
              />
              <Text
                style={[styles.metaText, { color: colors.mutedForeground }]}
              >
                Budget: SGD {question.optionalBudget.toFixed(2)}
              </Text>
            </View>
          )}
          <View style={styles.metaItem}>
            <Feather name="user" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {question.student?.name ?? "Student"}
            </Text>
          </View>
        </View>
      </Card>

      {/* Student: edit/delete when open */}
      {isOwner &&
        (question.status === "Open" || question.status === "BidReceived") && (
          <View style={{ flexDirection: "row", gap: 12, marginBottom: 16 }}>
            <Button
              title="Edit Question"
              variant="outline"
              onPress={() => router.push(`/edit-question?id=${questionId}`)}
              style={{ flex: 1 }}
              icon={
                <Feather name="edit-2" size={15} color={colors.foreground} />
              }
            />
            <Button
              title="Delete"
              variant="destructive"
              onPress={() => {
                Alert.alert(
                  "Delete Question",
                  "Are you sure? This cannot be undone.",
                  [
                    { text: "Cancel", style: "cancel" },
                    {
                      text: "Delete",
                      style: "destructive",
                      onPress: async () => {
                        try {
                          await customFetch(`/api/questions/${questionId}`, {
                            method: "DELETE",
                          });
                          router.back();
                        } catch (error: any) {
                          Alert.alert(
                            "Error",
                            error?.message || "Failed to delete question",
                          );
                        }
                      },
                    },
                  ],
                );
              }}
              style={{ flex: 1 }}
              icon={<Feather name="trash-2" size={15} color="#fff" />}
            />
          </View>
        )}

      {/* Tutor: bid form or existing bid */}
      {isTutor &&
        (question.status === "Open" || question.status === "BidReceived") && (
          <View style={{ marginBottom: 8 }}>
            {myBid ? (
              <Card style={styles.myBidCard}>
                <View style={styles.myBidHeader}>
                  <Feather
                    name="check-circle"
                    size={16}
                    color={colors.success}
                  />
                  <Text style={[styles.myBidTitle, { color: colors.success }]}>
                    Your bid submitted
                  </Text>
                  <Badge
                    label={myBid.status}
                    variant={
                      myBid.status === "Accepted"
                        ? "success"
                        : myBid.status === "Rejected" ||
                            (myBid.status as any) === "Withdrawn"
                          ? "destructive"
                          : "default"
                    }
                  />
                </View>
                <Text
                  style={[styles.myBidPrice, { color: colors.foreground }]}
                >
                  SGD {myBid.price.toFixed(2)}
                </Text>
                <Text
                  style={[
                    styles.myBidMessage,
                    { color: colors.mutedForeground },
                  ]}
                >
                  {myBid.message}
                </Text>
                {/* Show tutor's own scheduling offer */}
                <BidTimingInfo bid={myBid} />
                {myBid.status === "Pending" && (
                  <Button
                    title="Withdraw Bid"
                    variant="outline"
                    size="sm"
                    onPress={() => handleWithdrawBid(myBid.bidId)}
                    style={{ marginTop: 12 }}
                  />
                )}
              </Card>
            ) : showBidForm ? (
              <Card style={styles.bidFormCard}>
                <Text
                  style={[
                    styles.sectionTitle,
                    { color: colors.foreground, marginBottom: 16 },
                  ]}
                >
                  Submit a Bid
                </Text>

                <Input
                  label="Your Price (SGD)"
                  placeholder="Enter your price"
                  value={bidPrice}
                  onChangeText={(t) => {
                    setBidPrice(t);
                    setBidErrors((e) => ({ ...e, price: "" }));
                  }}
                  keyboardType="decimal-pad"
                  error={bidErrors.price}
                />

                <Input
                  label="Message to Student"
                  placeholder="Why are you the right tutor for this?"
                  value={bidMessage}
                  onChangeText={(t) => {
                    setBidMessage(t);
                    setBidErrors((e) => ({ ...e, message: "" }));
                  }}
                  multiline
                  numberOfLines={3}
                  style={{ height: 80, paddingTop: 10 }}
                  error={bidErrors.message}
                />

                {/* Scheduling section */}
                <Text
                  style={[
                    styles.scheduleLabel,
                    { color: colors.foreground },
                  ]}
                >
                  Your Availability
                </Text>
                <Text
                  style={[
                    styles.scheduleSub,
                    { color: colors.mutedForeground },
                  ]}
                >
                  Select one or both options
                </Text>

                {/* NOW option */}
                <Pressable
                  style={[
                    styles.scheduleOption,
                    {
                      borderColor: offerNow
                        ? colors.primary
                        : colors.border,
                      backgroundColor: offerNow
                        ? colors.primary + "12"
                        : colors.card,
                    },
                  ]}
                  onPress={() => {
                    setOfferNow(!offerNow);
                    setBidErrors((e) => ({ ...e, schedule: "" }));
                  }}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Feather
                      name="zap"
                      size={18}
                      color={offerNow ? colors.primary : colors.mutedForeground}
                    />
                    <View>
                      <Text
                        style={[
                          styles.scheduleOptionTitle,
                          {
                            color: offerNow
                              ? colors.primary
                              : colors.foreground,
                          },
                        ]}
                      >
                        Available NOW
                      </Text>
                      <Text
                        style={[
                          styles.scheduleOptionSub,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        10-min window · cancel any time after
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: offerNow ? colors.primary : colors.border,
                        backgroundColor: offerNow
                          ? colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    {offerNow && (
                      <Feather name="check" size={12} color="#fff" />
                    )}
                  </View>
                </Pressable>

                {/* Specific date/time option */}
                <Pressable
                  style={[
                    styles.scheduleOption,
                    {
                      borderColor: offerSpecific
                        ? colors.primary
                        : colors.border,
                      backgroundColor: offerSpecific
                        ? colors.primary + "12"
                        : colors.card,
                    },
                  ]}
                  onPress={() => {
                    setOfferSpecific(!offerSpecific);
                    setBidErrors((e) => ({ ...e, schedule: "" }));
                  }}
                >
                  <View style={styles.scheduleOptionLeft}>
                    <Feather
                      name="calendar"
                      size={18}
                      color={
                        offerSpecific ? colors.primary : colors.mutedForeground
                      }
                    />
                    <View>
                      <Text
                        style={[
                          styles.scheduleOptionTitle,
                          {
                            color: offerSpecific
                              ? colors.primary
                              : colors.foreground,
                          },
                        ]}
                      >
                        Specific Date & Time
                      </Text>
                      <Text
                        style={[
                          styles.scheduleOptionSub,
                          { color: colors.mutedForeground },
                        ]}
                      >
                        {offerSpecific ? formatSGT(specificDate) : "Pick a date and time"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: offerSpecific
                          ? colors.primary
                          : colors.border,
                        backgroundColor: offerSpecific
                          ? colors.primary
                          : "transparent",
                      },
                    ]}
                  >
                    {offerSpecific && (
                      <Feather name="check" size={12} color="#fff" />
                    )}
                  </View>
                </Pressable>

                {/* Date/Time pickers — shown only when offerSpecific */}
                {offerSpecific && (
                  <View style={{ marginTop: 8, gap: 8 }}>
                    <Pressable
                      style={[
                        styles.pickerButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                      onPress={() => setShowSpecificDatePicker(true)}
                    >
                      <Feather
                        name="calendar"
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.pickerText,
                          { color: colors.foreground },
                        ]}
                      >
                        {formattedSpecificDate}
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={14}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                    {showSpecificDatePicker && (
                      <DateTimePicker
                        value={specificDate}
                        mode="date"
                        display={
                          Platform.OS === "ios" ? "inline" : "default"
                        }
                        minimumDate={new Date()}
                        onChange={onSpecificDateChange}
                        themeVariant="light"
                      />
                    )}
                    {Platform.OS === "ios" && showSpecificDatePicker && (
                      <Button
                        title="Done"
                        variant="outline"
                        size="sm"
                        onPress={() => setShowSpecificDatePicker(false)}
                      />
                    )}

                    <Pressable
                      style={[
                        styles.pickerButton,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                      onPress={() => setShowSpecificTimePicker(true)}
                    >
                      <Feather
                        name="clock"
                        size={16}
                        color={colors.primary}
                      />
                      <Text
                        style={[
                          styles.pickerText,
                          { color: colors.foreground },
                        ]}
                      >
                        {formattedSpecificTime} (SGT)
                      </Text>
                      <Feather
                        name="chevron-down"
                        size={14}
                        color={colors.mutedForeground}
                      />
                    </Pressable>
                    {showSpecificTimePicker && (
                      <DateTimePicker
                        value={specificDate}
                        mode="time"
                        display={
                          Platform.OS === "ios" ? "spinner" : "default"
                        }
                        is24Hour
                        onChange={onSpecificTimeChange}
                      />
                    )}
                    {Platform.OS === "ios" && showSpecificTimePicker && (
                      <Button
                        title="Done"
                        variant="outline"
                        size="sm"
                        onPress={() => setShowSpecificTimePicker(false)}
                      />
                    )}
                  </View>
                )}

                {bidErrors.schedule ? (
                  <Text style={{ color: colors.destructive, fontSize: 13, marginTop: 6 }}>
                    {bidErrors.schedule}
                  </Text>
                ) : null}

                <View style={[styles.formActions, { marginTop: 16 }]}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => setShowBidForm(false)}
                    style={{ flex: 1 }}
                  />
                  <Button
                    title="Submit Bid"
                    variant="primary"
                    onPress={handleSubmitBid}
                    loading={createBid.isPending}
                    style={{ flex: 1 }}
                  />
                </View>
              </Card>
            ) : (
              <Button
                title="Submit a Bid"
                variant="primary"
                onPress={() => setShowBidForm(true)}
                style={styles.bidBtn}
                icon={
                  <Feather
                    name="edit"
                    size={16}
                    color={colors.primaryForeground}
                  />
                }
              />
            )}
          </View>
        )}

      {/* Student: list of bids */}
      {isStudent && (
        <>
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.foreground, marginBottom: 12 },
            ]}
          >
            Bids ({bids?.length ?? 0})
          </Text>
          {bLoading ? (
            [1, 2].map((i) => (
              <Skeleton key={i} height={100} style={{ marginBottom: 12 }} />
            ))
          ) : bids?.length === 0 ? (
            <EmptyState
              icon="inbox"
              title="No bids yet"
              description="Tutors will start bidding soon."
            />
          ) : (
            bids?.map((bid) => (
              <Card key={bid.bidId} style={styles.bidCard}>
                <View style={styles.bidHeader}>
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[styles.bidTutor, { color: colors.foreground }]}
                    >
                      {bid.tutor?.name}
                    </Text>
                    <StarRating rating={bid.tutor?.rating} />
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <Text style={[styles.bidPrice, { color: colors.primary }]}>
                      SGD {bid.price.toFixed(2)}
                    </Text>
                    <Badge
                      label={bid.status}
                      variant={
                        bid.status === "Accepted"
                          ? "success"
                          : bid.status === "Rejected" ||
                              (bid.status as any) === "Withdrawn"
                            ? "destructive"
                            : "default"
                      }
                    />
                  </View>
                </View>
                {(bid as any).tutorProfile?.hourlyRate != null && (
                  <View style={styles.bidMeta}>
                    <Feather
                      name="dollar-sign"
                      size={12}
                      color={colors.mutedForeground}
                    />
                    <Text
                      style={[
                        styles.bidMetaText,
                        { color: colors.mutedForeground },
                      ]}
                    >
                      SGD {(bid as any).tutorProfile.hourlyRate}/hr
                    </Text>
                  </View>
                )}
                <Text
                  style={[styles.bidMessage, { color: colors.mutedForeground }]}
                >
                  {bid.message}
                </Text>
                <BidTimingInfo bid={bid} />
                {question.status !== "Scheduled" &&
                  bid.status === "Pending" && (
                    <Button
                      title="Accept this bid"
                      variant="primary"
                      size="sm"
                      onPress={() => handleAcceptBid(bid)}
                      loading={updateBid.isPending}
                      style={{ marginTop: 12, alignSelf: "flex-start" }}
                    />
                  )}
              </Card>
            ))
          )}
        </>
      )}

      {/* File Viewer Modal */}
      <Modal
        visible={showFileViewer}
        animationType="slide"
        onRequestClose={() => setShowFileViewer(false)}
      >
        <View style={{ flex: 1, backgroundColor: colors.background }}>
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            padding: 16,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}>
            <Text style={{ fontSize: 18, fontWeight: '600', color: colors.foreground }}>
              Attachment
            </Text>
            <Pressable onPress={() => setShowFileViewer(false)}>
              <Feather name="x" size={24} color={colors.foreground} />
            </Pressable>
          </View>
          <WebView 
            source={{ uri: fileUrl }}
            startInLoadingState={true}
            scalesPageToFit={true}
            style={{ flex: 1 }}
          />
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16 },
  questionCard: { padding: 16, marginBottom: 16 },
  qHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  subject: { fontSize: 13 },
  questionTitle: { fontSize: 20, fontWeight: "700", marginBottom: 10 },
  description: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  qMeta: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { fontSize: 13 },
  sectionTitle: { fontSize: 17, fontWeight: "600" },
  bidBtn: { marginBottom: 16 },
  myBidCard: { padding: 16, marginBottom: 16 },
  myBidHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  myBidTitle: { fontSize: 15, fontWeight: "600", flex: 1 },
  myBidPrice: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  myBidMessage: { fontSize: 14 },
  bidFormCard: { padding: 16, marginBottom: 16 },
  scheduleLabel: { fontSize: 15, fontWeight: "600", marginBottom: 4, marginTop: 8 },
  scheduleSub: { fontSize: 13, marginBottom: 10 },
  scheduleOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
  },
  scheduleOptionLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  scheduleOptionTitle: { fontSize: 14, fontWeight: "600" },
  scheduleOptionSub: { fontSize: 12, marginTop: 2 },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  pickerButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  pickerText: { flex: 1, fontSize: 14 },
  formActions: { flexDirection: "row", gap: 12 },
  bidCard: { padding: 16, marginBottom: 12 },
  bidHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  bidTutor: { fontSize: 15, fontWeight: "600", marginBottom: 4 },
  bidPrice: { fontSize: 17, fontWeight: "700" },
  bidMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  bidMetaText: { fontSize: 12 },
  bidMessage: { fontSize: 14, lineHeight: 20 },

  attachmentRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  attachmentText: {
    fontSize: 14,
    fontWeight: "500",
    textDecorationLine: "underline",
  },
  
});
