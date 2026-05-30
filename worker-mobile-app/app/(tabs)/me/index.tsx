import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useWorkerProfile } from '@/features/profile/hooks/useWorkerProfile';
import { useWorkerStats } from '@/features/profile/hooks/useWorkerStats';
import { useMyCredentials } from '@/features/profile/hooks/useMyCredentials';
import { getInitials } from '@/shared/utils/getInitials';
import { Avatar } from '@/shared/components/ui';
import { ProfileField } from '@/features/profile/components/ProfileField';
import { SectionDivider } from '@/features/profile/components/SectionDivider';
import { StatTile } from '@/features/profile/components/StatTile';
import { CredentialCard } from '@/features/profile/components/CredentialCard';
import { ComplianceAlert } from '@/features/profile/components/ComplianceAlert';

const ROLE_LABELS: Record<string, string> = {
  home_support_worker: 'Home Support Worker',
  nurse: 'Nurse',
  owner: 'Owner',
  agency_admin: 'Agency Admin',
  manager: 'Manager',
  supervisor: 'Supervisor',
};

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  casual: 'Casual',
  contract: 'Contract',
};

const STATUS_TAG_STYLES: Record<string, { bg: string; label: string }> = {
  active:     { bg: 'bg-mint',   label: '• ACTIVE' },
  on_leave:   { bg: 'bg-yellow', label: 'ON LEAVE' },
  terminated: { bg: 'bg-rose',   label: 'TERMINATED' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-CA', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatHireDate(iso: string | null): string {
  if (!iso) return '—';
  const hired = new Date(iso);
  const now = new Date();
  const years = Math.floor((now.getTime() - hired.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
  const formatted = hired.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
  return years > 0 ? `${formatted} · ${years} yr${years !== 1 ? 's' : ''}` : formatted;
}

function ChipRow({ items, color }: { items: string[]; color?: string }) {
  return (
    <View className="flex-row flex-wrap justify-end gap-1">
      {items.map((item) => (
        <View
          key={item}
          className={`rounded-full border border-ink/20 px-2 py-0.5 ${color ?? 'bg-paper'}`}
        >
          <Text className="font-mono text-[9px] text-ink">{item}</Text>
        </View>
      ))}
    </View>
  );
}

function StatusTag({ status }: { status: string }) {
  const cfg = STATUS_TAG_STYLES[status] ?? STATUS_TAG_STYLES.active;
  return (
    <View className={`rounded-sm px-2 py-0.5 ${cfg.bg}`}>
      <Text className="font-mono text-[9px] uppercase tracking-wider text-ink">{cfg.label}</Text>
    </View>
  );
}

export default function MeScreen() {
  const { data: profile, isLoading: profileLoading } = useWorkerProfile();
  const { data: stats } = useWorkerStats();
  const { data: credentials = [] } = useMyCredentials();

  if (profileLoading || !profile) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-cream">
        <ActivityIndicator color="#FF5A1F" />
      </SafeAreaView>
    );
  }

  const initials = getInitials(profile.first_name, profile.last_name);
  const fullAddress = [profile.street, profile.city, profile.province, profile.postal_code]
    .filter(Boolean)
    .join(', ');

  return (
    <SafeAreaView className="flex-1 bg-cream">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 48 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Page header ───────────────────────────────────────────────── */}
        <View className="px-5 pb-3.5 pt-[18px]">
          {/* Kicker row + gear */}
          <View className="mb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-2">
              <View className="h-px w-3.5 bg-ink" />
              <Text className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-soft">
                My Profile
              </Text>
            </View>
            <Pressable onPress={() => router.push('/settings')} hitSlop={12}>
              <Ionicons name="settings-outline" size={18} color="#4A453E" />
            </Pressable>
          </View>
          {/* Heading */}
          <Text className="font-serif text-[32px] leading-[0.98] text-ink">
            My <Text className="font-serif-italic">profile.</Text>
          </Text>
        </View>

        {/* ── Identity header ───────────────────────────────────────────── */}
        <View className="flex-row items-center gap-3.5 px-5 pb-1.5">
          <Avatar initials={initials} size="xl" className="bg-orange" />
          <View className="flex-1">
            <Text className="font-serif-medium text-[20px] leading-tight text-ink">
              {profile.first_name} {profile.last_name}
            </Text>
            <Text className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-ink-soft">
              {ROLE_LABELS[profile.role] ?? profile.role}
            </Text>
            <View className="mt-2 flex-row items-center gap-1.5">
              <StatusTag status={profile.employment_status} />
              {profile.employment_type && (
                <View className="rounded-sm border border-ink/30 px-2 py-0.5">
                  <Text className="font-mono text-[9px] uppercase tracking-wider text-ink-soft">
                    {EMPLOYMENT_TYPE_LABELS[profile.employment_type] ?? profile.employment_type}
                  </Text>
                </View>
              )}
            </View>
          </View>
          <Pressable
            onPress={() => router.push('/profile/edit')}
            className="h-9 w-9 items-center justify-center border border-ink/25 bg-paper"
            hitSlop={8}
          >
            <Ionicons name="pencil-outline" size={15} color="#4A453E" />
          </Pressable>
        </View>

        {/* ── Compliance alert (conditional) ────────────────────────────── */}
        {credentials.length > 0 && <ComplianceAlert credentials={credentials} />}

        {/* ── Personal & Contact ─────────────────────────────────────────── */}
        <SectionDivider label="Personal & Contact" />
        <View className="px-5">
          <ProfileField label="Email" value={profile.email} mono />
          <ProfileField label="Phone" value={profile.phone_number} mono />
          <ProfileField label="Address" value={fullAddress || null} />
          <ProfileField label="Date of birth" value={formatDate(profile.date_of_birth)} mono />
          <ProfileField label="Gender" value={profile.gender} />
          {profile.languages && profile.languages.length > 0 && (
            <ProfileField label="Languages">
              <ChipRow items={profile.languages} color="bg-lavender" />
            </ProfileField>
          )}
        </View>

        {/* ── Emergency contact card ────────────────────────────────────── */}
        {(profile.emergency_contact_name || profile.emergency_contact_phone) && (
          <View className="mx-5 mt-3 border border-ink bg-paper p-3.5">
            <Text className="font-mono text-[8.5px] uppercase tracking-[0.12em] text-ink-soft">
              Emergency Contact
            </Text>
            <View className="mt-1.5 flex-row items-end justify-between">
              <View>
                <Text className="font-serif text-base leading-tight text-ink">
                  {profile.emergency_contact_name ?? '—'}
                </Text>
                {profile.emergency_contact_relationship && (
                  <Text className="mt-0.5 font-mono text-[9.5px] uppercase text-ink-soft">
                    {profile.emergency_contact_relationship}
                  </Text>
                )}
              </View>
              <Text className="font-mono text-xs font-semibold text-ink">
                {profile.emergency_contact_phone ?? '—'}
              </Text>
            </View>
          </View>
        )}

        {/* ── Employment ────────────────────────────────────────────────── */}
        <SectionDivider label="Employment" />
        <View className="px-5">
          <ProfileField label="Hire date" value={formatHireDate(profile.hire_date)} mono />
        </View>

        {/* ── Availability & Preferences ────────────────────────────────── */}
        <SectionDivider label="Availability & Preferences" />
        <View className="px-5">
          <ProfileField
            label="Max hours / week"
            value={profile.max_hours_per_week ? `${profile.max_hours_per_week} h` : null}
            mono
          />
          <ProfileField
            label="Transportation"
            value={profile.has_vehicle === true ? 'Own vehicle' : profile.has_vehicle === false ? 'No vehicle' : null}
          />
          <ProfileField label="Pet tolerance" value={profile.pet_tolerance} />
          {profile.preferred_client_types && profile.preferred_client_types.length > 0 && (
            <ProfileField label="Preferred client types">
              <ChipRow items={profile.preferred_client_types} />
            </ProfileField>
          )}
        </View>

        {/* ── Compensation & Hours ──────────────────────────────────────── */}
        <SectionDivider label="Compensation & Hours" />
        <View className="flex-row gap-2 px-5 py-1.5">
          <StatTile
            kicker="Pay Rate"
            value={profile.pay_rate ? `$${parseFloat(profile.pay_rate).toFixed(2)}` : '—'}
            unit="/h"
          />
          <StatTile kicker="Hours MTD" value={stats ? String(stats.hours_mtd) : '—'} />
          <StatTile
            kicker="Overtime MTD"
            value={stats ? String(stats.overtime_mtd) : '—'}
            unit="h"
            accent
          />
        </View>
        <View className="px-5">
          {profile.pay_rate && (
            <ProfileField label="Pay rate" value={`$${parseFloat(profile.pay_rate).toFixed(2)} / hour`} mono />
          )}
          <ProfileField label="Hours — month to date" value={stats ? `${stats.hours_mtd} h` : '—'} mono />
          <ProfileField label="Hours — year to date" value={stats ? `${stats.hours_ytd} h` : '—'} mono />
          <ProfileField label="Overtime — MTD" value={stats ? `${stats.overtime_mtd} h` : '—'} mono />
          <ProfileField label="Overtime — YTD" value={stats ? `${stats.overtime_ytd} h` : '—'} mono />
        </View>

        {/* ── Compliance Documents ──────────────────────────────────────── */}
        <SectionDivider label="Compliance Documents" />
        <View className="gap-2 px-5 pb-1.5">
          {credentials.length === 0 ? (
            <Text className="py-4 text-center font-mono text-xs text-muted">
              No credentials on file.
            </Text>
          ) : (
            credentials.map((c) => <CredentialCard key={c.id} credential={c} />)
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
