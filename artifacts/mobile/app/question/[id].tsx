import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  RefreshControl,
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
  useCreateSession,
} from "@workspace/api-client-react";
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

function statusVariant(status: string) {
  if (status === "Open") return "blue";
  if (status === "Matched") return "warning";
  if (status === "Scheduled") return "success";
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
  const createSession = useCreateSession();

  // Bid form state (tutor)
  const [showBidForm, setShowBidForm] = useState(false);
  const [bidPrice, setBidPrice] = useState("");
  const [bidMessage, setBidMessage] = useState("");
  const [bidDuration, setBidDuration] = useState("");
  const [bidErrors, setBidErrors] = useState<Record<string, string>>({});

  const myBid = isTutor
    ? bids?.find((b) => b.tutorId === user?.userId)
    : undefined;

  const handleAcceptBid = (bidId: number, tutorId: number) => {
    Alert.alert(
      "Accept this bid?",
      "All other bids will be rejected. You will then schedule a session time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Accept",
          onPress: async () => {
            try {
              await updateBid.mutateAsync({
                bidId,
                data: { status: "Accepted" },
              });
              await queryClient.invalidateQueries({
                queryKey: getGetBidsQueryKey({ questionId }),
              });
              await queryClient.invalidateQueries({
                queryKey: getGetQuestionQueryKey(questionId),
              });
              router.push(
                `/propose-time?questionId=${questionId}&tutorId=${tutorId}`,
              );
            } catch {
              Alert.alert("Error", "Failed to accept bid.");
            }
          },
        },
      ],
    );
  };

  const handleSubmitBid = async () => {
    const e: Record<string, string> = {};
    const price = parseFloat(bidPrice);
    const dur = parseInt(bidDuration, 10);
    if (!bidPrice || isNaN(price) || price <= 0)
      e.price = "Enter a valid price";
    if (!bidMessage.trim()) e.message = "Message is required";
    if (!bidDuration || isNaN(dur) || dur < 15) e.duration = "Min 15 minutes";
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
          estimatedDuration: dur,
        },
      });
      await queryClient.invalidateQueries({
        queryKey: getGetBidsQueryKey({ questionId }),
      });
      setShowBidForm(false);
      setBidPrice("");
      setBidMessage("");
      setBidDuration("");
    } catch {
      Alert.alert("Error", "Failed to submit bid.");
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
      <Card style={styles.questionCard}>
        <View style={styles.qHeader}>
          <Badge
            label={question.status}
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
        <View style={styles.qMeta}>
          <View style={styles.metaItem}>
            <Feather name="clock" size={14} color={colors.mutedForeground} />
            <Text style={[styles.metaText, { color: colors.mutedForeground }]}>
              {question.preferredDuration} min
            </Text>
          </View>
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

      {/* Student: edit button when Open and owner */}
      {isOwner && question.status === "Open" && (
        <Button
          title="Edit Question"
          variant="outline"
          onPress={() => router.push(`/edit-question?id=${questionId}`)}
          style={{ marginBottom: 16 }}
          icon={<Feather name="edit-2" size={15} color={colors.foreground} />}
        />
      )}

      {/* Tutor: bid form or existing bid */}
      {isTutor && question.status === "Open" && (
        <View style={{ marginBottom: 8 }}>
          {myBid ? (
            <Card style={styles.myBidCard}>
              <View style={styles.myBidHeader}>
                <Feather name="check-circle" size={16} color={colors.success} />
                <Text style={[styles.myBidTitle, { color: colors.success }]}>
                  Your bid submitted
                </Text>
                <Badge
                  label={myBid.status}
                  variant={
                    myBid.status === "Accepted"
                      ? "success"
                      : myBid.status === "Rejected"
                        ? "destructive"
                        : "default"
                  }
                />
              </View>
              <Text style={[styles.myBidPrice, { color: colors.foreground }]}>
                SGD {myBid.price.toFixed(2)} • {myBid.estimatedDuration} min
              </Text>
              <Text
                style={[styles.myBidMessage, { color: colors.mutedForeground }]}
              >
                {myBid.message}
              </Text>
            </Card>
          ) : showBidForm ? (
            <Card style={styles.bidFormCard}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Submit a Bid
              </Text>
              <Input
                label="Your Price (SGD)"
                placeholder="50"
                value={bidPrice}
                onChangeText={(t) => {
                  setBidPrice(t);
                  setBidErrors((e) => ({ ...e, price: "" }));
                }}
                keyboardType="decimal-pad"
                error={bidErrors.price}
              />
              <Input
                label="Estimated Duration (min)"
                placeholder="60"
                value={bidDuration}
                onChangeText={(t) => {
                  setBidDuration(t);
                  setBidErrors((e) => ({ ...e, duration: "" }));
                }}
                keyboardType="number-pad"
                error={bidErrors.duration}
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
              <View style={styles.formActions}>
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
                          : bid.status === "Rejected"
                            ? "destructive"
                            : "default"
                      }
                    />
                  </View>
                </View>
                <View style={styles.bidMeta}>
                  <Feather
                    name="clock"
                    size={12}
                    color={colors.mutedForeground}
                  />
                  <Text
                    style={[
                      styles.bidMetaText,
                      { color: colors.mutedForeground },
                    ]}
                  >
                    {bid.estimatedDuration} min
                  </Text>
                  {bid.tutorProfile?.hourlyRate != null && (
                    <>
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
                        SGD {bid.tutorProfile.hourlyRate}/hr
                      </Text>
                    </>
                  )}
                </View>
                <Text
                  style={[styles.bidMessage, { color: colors.mutedForeground }]}
                >
                  {bid.message}
                </Text>
                {question.status === "Open" && bid.status === "Pending" && (
                  <Button
                    title="Accept this bid"
                    variant="primary"
                    size="sm"
                    onPress={() => handleAcceptBid(bid.bidId, bid.tutorId)}
                    loading={updateBid.isPending}
                    style={{ marginTop: 12, alignSelf: "flex-start" }}
                  />
                )}
              </Card>
            ))
          )}
        </>
      )}
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
});
