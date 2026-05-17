import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Markdown from 'react-native-markdown-display';
import type { ChatMessage } from '../hooks/useChatWebSocket';
import type { ThemeColors } from '../constants/colors';
import { Fonts } from '../constants/fonts';
import { ProgramProposalCard } from './ProgramProposalCard';
import type { ProgramProposalData } from './ProgramProposalCard';
import { ProgramEditCard } from './ProgramEditCard';
import type { ProgramEditData } from './ProgramEditCard';

export interface ChatMessageItemProps {
  item: ChatMessage;
  colors: ThemeColors;
  markdownStyles: any;
  respondedProposalIds: Set<string>;
  onReviewProposal: (data: ProgramProposalData, messageId: string) => void;
  onAcceptEdit: (messageId: string) => void;
  onDenyEdit: (messageId: string) => void;
  onReviewEdit: (data: ProgramEditData, messageId: string) => void;
}

export function ChatMessageItem({
  item,
  colors,
  markdownStyles,
  respondedProposalIds,
  onReviewProposal,
  onAcceptEdit,
  onDenyEdit,
  onReviewEdit,
}: ChatMessageItemProps) {
  if (item.messageType === 'segment_header' && item.segmentHeader) {
    return (
      <View style={styles.segmentHeaderRow}>
        <View style={[styles.segmentHeaderRule, { backgroundColor: colors.border }]} />
        <View style={styles.segmentHeaderTextWrap}>
          <Text style={[styles.segmentHeaderLabel, { color: colors.textSecondary }]}>
            {item.segmentHeader.label}
          </Text>
          {item.segmentHeader.subtitle ? (
            <Text style={[styles.segmentHeaderSubtitle, { color: colors.textSecondary }]}>
              {item.segmentHeader.subtitle}
            </Text>
          ) : null}
        </View>
        <View style={[styles.segmentHeaderRule, { backgroundColor: colors.border }]} />
      </View>
    );
  }

  if (item.messageType === 'tool_action') {
    return (
      <View style={styles.toolActionRow}>
        {item.toolDone ? (
          <Ionicons name="checkmark-circle" size={14} color={colors.success} />
        ) : (
          <ActivityIndicator size={12} color={colors.textSecondary} />
        )}
        <Text style={[styles.toolActionLabel, { color: colors.textSecondary }]}>
          {item.content}
        </Text>
      </View>
    );
  }

  if (item.messageType === 'program_proposal') {
    return (
      <ProgramProposalCard
        data={item.proposalData}
        onReview={() => onReviewProposal(item.proposalData, item.id)}
        disabled={respondedProposalIds.has(item.id)}
      />
    );
  }

  if (item.messageType === 'program_edit') {
    return (
      <ProgramEditCard
        data={item.proposalData}
        onAccept={() => onAcceptEdit(item.id)}
        onDeny={() => onDenyEdit(item.id)}
        onReviewChanges={() => onReviewEdit(item.proposalData, item.id)}
        disabled={respondedProposalIds.has(item.id)}
      />
    );
  }

  const isUser = item.role === 'user';
  return (
    <View
      style={[
        styles.messageBubble,
        isUser
          ? [styles.userBubble, { backgroundColor: colors.primary }]
          : [styles.gritBubble, { backgroundColor: colors.messageBubble }],
      ]}
    >
      {!isUser && <Text style={[styles.gritLabel, { color: colors.primary }]}>Grit</Text>}
      {isUser ? (
        <Text style={[styles.messageText, { color: colors.background }]}>{item.content}</Text>
      ) : (
        <Markdown style={markdownStyles}>{item.content}</Markdown>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  messageBubble: {
    maxWidth: '80%',
    borderRadius: 18,
    padding: 12,
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 4,
  },
  gritBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 4,
  },
  gritLabel: {
    fontSize: 11,
    fontFamily: Fonts.bodySemiBold,
    marginBottom: 3,
  },
  messageText: {
    fontSize: 15,
    fontFamily: Fonts.body,
    lineHeight: 21,
  },
  toolActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: 3,
    paddingHorizontal: 4,
    gap: 6,
    marginBottom: 2,
  },
  toolActionLabel: {
    fontSize: 12,
    fontFamily: Fonts.body,
  },
  segmentHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  segmentHeaderRule: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
  },
  segmentHeaderTextWrap: {
    alignItems: 'center',
    maxWidth: '70%',
  },
  segmentHeaderLabel: {
    fontSize: 12,
    fontFamily: Fonts.heading,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  segmentHeaderSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.body,
    marginTop: 2,
    textAlign: 'center',
  },
});
