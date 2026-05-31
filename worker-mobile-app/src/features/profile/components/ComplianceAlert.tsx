import { View, Text } from 'react-native';
import type { Credential } from '@/features/profile/types';
import { computeCredentialStatus, DOCUMENT_TYPE_LABELS } from '@/features/profile/types';

interface ComplianceAlertProps {
  credentials: Credential[];
  className?: string;
}

export function ComplianceAlert({ credentials, className }: ComplianceAlertProps) {
  const expired = credentials.filter((c) => computeCredentialStatus(c.expiry_date) === 'expired');
  const expiring = credentials.filter((c) => computeCredentialStatus(c.expiry_date) === 'expiring');

  if (expired.length === 0 && expiring.length === 0) return null;

  const parts: string[] = [];
  if (expired.length > 0) parts.push(`${expired.length} credential${expired.length > 1 ? 's' : ''} expired`);
  if (expiring.length > 0) parts.push(`${expiring.length} expiring soon`);

  const flagged = [...expired, ...expiring];
  const detailLine = flagged
    .map((c) => {
      const s = computeCredentialStatus(c.expiry_date);
      if (s === 'expired') return `${DOCUMENT_TYPE_LABELS[c.document_type].toUpperCase()} · EXPIRED`;
      if (c.expiry_date) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = Math.ceil((new Date(c.expiry_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return `${DOCUMENT_TYPE_LABELS[c.document_type].toUpperCase()} · ${days} DAYS`;
      }
      return DOCUMENT_TYPE_LABELS[c.document_type].toUpperCase();
    })
    .join('   —   ');

  return (
    <View className={className ?? 'mx-5 mt-3.5 border border-ink bg-orange-soft p-3.5'}>
      <Text className="font-mono text-[9px] font-bold uppercase tracking-widest text-orange">
        ⚠ ACTION NEEDED
      </Text>
      <Text className="mt-1 font-serif text-base leading-tight text-ink">
        {parts.join(', ')}
      </Text>
      <Text className="mt-1.5 font-mono text-[9.5px] leading-relaxed text-ink-soft">
        {detailLine}
      </Text>
    </View>
  );
}
