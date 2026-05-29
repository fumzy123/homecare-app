import { View, Text } from 'react-native';
import type { Credential, CredentialStatus } from '../types';
import { computeCredentialStatus } from '../types';

const CATEGORY_LABELS: Record<string, string> = {
  safety: 'Safety',
  health: 'Health',
  emergency_response: 'Emergency Response',
  transportation: 'Transportation',
  eligibility: 'Eligibility',
  qualification: 'Qualification',
};

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
    const expiry = new Date(expiry_date);
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
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

function formatDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

interface CredentialCardProps {
  credential: Credential;
}

export function CredentialCard({ credential }: CredentialCardProps) {
  const { name, category, issuer, issue_date, expiry_date, is_required, file_url } = credential;
  const status = computeCredentialStatus(expiry_date);
  const needsAction = status === 'expired' || status === 'expiring';

  return (
    <View className="border border-ink bg-paper p-3">
      <View className="flex-row gap-3">
        <StatusIcon status={status} />

        <View className="min-w-0 flex-1">
          {/* Title row */}
          <View className="flex-row items-start justify-between gap-2">
            <View className="shrink flex-row flex-wrap items-center gap-1">
              <Text className="text-[12.5px] font-semibold leading-snug text-ink">{name}</Text>
              {is_required && (
                <Text className="font-mono text-[8px] text-orange">REQ</Text>
              )}
            </View>
            <StatusChip status={status} expiry_date={expiry_date} />
          </View>

          {/* Meta: category · issuer */}
          {(category || issuer) && (
            <Text className="mt-1 font-mono text-[9px] uppercase tracking-wider text-ink-soft">
              {[category ? CATEGORY_LABELS[category] : null, issuer]
                .filter(Boolean)
                .join(' · ')
                .toUpperCase()}
            </Text>
          )}

          {/* Dates */}
          <Text className="mt-0.5 font-mono text-[9.5px] text-ink-soft">
            {issue_date ? `ISSUED ${formatDate(issue_date)}` : ''}
            {issue_date && expiry_date ? ' → ' : ''}
            {expiry_date ? (
              <Text style={{ color: needsAction ? '#FF5A1F' : undefined, fontWeight: needsAction ? '700' : '400' }}>
                {`EXPIRES ${formatDate(expiry_date)}`}
              </Text>
            ) : issue_date ? (
              <Text> · NO EXPIRY</Text>
            ) : (
              'NO EXPIRY'
            )}
          </Text>

          {/* Document status */}
          <View className="mt-2">
            {file_url ? (
              <Text className="font-mono text-[9.5px] text-ink">▪ DOCUMENT ON FILE</Text>
            ) : (
              <Text className="font-mono text-[9.5px] text-orange">↤ UPLOAD DOCUMENT</Text>
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
