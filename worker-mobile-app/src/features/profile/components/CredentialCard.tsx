import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import type { Credential, CredentialStatus } from '../types';
import { computeCredentialStatus, DOCUMENT_TYPE_LABELS } from '../types';
import { useOpenDocumentPreview } from '../hooks/useOpenDocumentPreview';

function StatusChip({ status, expiry_date }: { status: CredentialStatus; expiry_date: string | null }) {
  if (status === 'valid') {
    return (
      <View className="rounded-sm bg-mint px-2 py-0.5">
        <Text className="font-mono text-[8.5px] uppercase tracking-wider text-ink">VALID</Text>
      </View>
    );
  }
  if (status === 'expiring' && expiry_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysLeft = Math.ceil((new Date(expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    return (
      <View className="rounded-sm bg-yellow px-2 py-0.5">
        <Text className="font-mono text-[8.5px] uppercase tracking-wider text-ink">
          EXPIRES {daysLeft}D
        </Text>
      </View>
    );
  }
  return (
    <View className="rounded-sm bg-orange px-2 py-0.5">
      <Text className="font-mono text-[8.5px] uppercase tracking-wider text-white">EXPIRED</Text>
    </View>
  );
}

function StatusIcon({ status }: { status: CredentialStatus }) {
  const configs = {
    valid:    { bg: 'bg-mint',   text: '✓', color: 'text-ink' },
    expiring: { bg: 'bg-yellow', text: '!', color: 'text-ink' },
    expired:  { bg: 'bg-orange', text: '✕', color: 'text-white' },
  };
  const c = configs[status];
  return (
    <View className={`h-[26px] w-[26px] shrink-0 items-center justify-center border border-ink ${c.bg}`}>
      <Text className={`font-mono-bold text-xs font-bold ${c.color}`}>{c.text}</Text>
    </View>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

interface CredentialCardProps {
  credential: Credential;
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const { document_type, expiry_date, file_url } = credential;
  const name = DOCUMENT_TYPE_LABELS[document_type];
  const status = computeCredentialStatus(expiry_date);
  const needsAction = status === 'expired' || status === 'expiring';
  const hasFile = !!file_url;

  const { openPreview, isOpening } = useOpenDocumentPreview();

  const cardContent = (
    <View className="border border-ink bg-paper p-3" style={{ opacity: isOpening ? 0.7 : 1 }}>
      <View className="flex-row gap-3">
        <StatusIcon status={status} />

        <View className="min-w-0 flex-1">
          {/* Title row */}
          <View className="flex-row items-start justify-between gap-2">
            <Text className="shrink text-[12.5px] font-semibold leading-snug text-ink">{name}</Text>
            <StatusChip status={status} expiry_date={expiry_date} />
          </View>

          {/* Expiry */}
          <Text className="mt-0.5 font-mono text-[9.5px] text-ink-soft">
            {expiry_date ? (
              <Text style={{ color: needsAction ? '#FF5A1F' : undefined, fontWeight: needsAction ? '700' : '400' }}>
                {`EXPIRES ${formatDate(expiry_date)}`}
              </Text>
            ) : (
              'NO EXPIRY'
            )}
          </Text>

          {/* Document status / view affordance */}
          <View className="mt-2 flex-row items-center gap-1.5">
            {hasFile ? (
              isOpening ? (
                <>
                  <ActivityIndicator size="small" color="#4A453E" style={{ transform: [{ scale: 0.7 }] }} />
                  <Text className="font-mono text-[9.5px] text-ink-soft">OPENING…</Text>
                </>
              ) : (
                <Text className="font-mono text-[9.5px] text-ink">▪ DOCUMENT ON FILE  · VIEW →</Text>
              )
            ) : (
              <Text className="font-mono text-[9.5px] text-orange">↤ UPLOAD DOCUMENT</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );

  if (!hasFile) return cardContent;

  return (
    <Pressable
      onPress={() => openPreview(file_url)}
      disabled={isOpening}
      accessibilityRole="button"
      accessibilityLabel={`View ${name}`}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      {cardContent}
    </Pressable>
  );
}
