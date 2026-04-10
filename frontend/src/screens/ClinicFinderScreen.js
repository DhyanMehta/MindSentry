import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Modal,
  Alert,
  Linking,
} from 'react-native';
import * as Location from 'expo-location';
import { Ionicons } from '@expo/vector-icons';

import { useChatAgent } from '../hooks/useChatAgent';
import { ErrorBox } from '../components/ErrorBox';
import { colors } from '../theme/colors';

const CLINIC_TYPES = [
  { key: 'mental_health', label: 'Mental health' },
  { key: 'general', label: 'General' },
  { key: 'emergency', label: 'Emergency' },
];

const formatDistance = (distanceKm) => {
  if (distanceKm == null || Number.isNaN(Number(distanceKm))) {
    return 'Distance unavailable';
  }
  return `${Number(distanceKm).toFixed(1)} km away`;
};

const formatDateTimeInput = (input) => {
  const cleaned = input.replace(/[^\d\-T:]/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)}-${cleaned.slice(4)}`;
  if (cleaned.length <= 10) return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 6)}-${cleaned.slice(6)}`;
  if (cleaned.length <= 13) return `${cleaned.slice(0, 10)}T${cleaned.slice(10)}`;
  if (cleaned.length <= 16) return `${cleaned.slice(0, 13)}:${cleaned.slice(13)}`;
  if (cleaned.length <= 19) return `${cleaned.slice(0, 16)}:${cleaned.slice(16)}`;
  return cleaned.slice(0, 19);
};

const ClinicFinderScreen = () => {
  const {
    loading,
    error,
    pendingApproval,
    reminderPrompt,
    findNearbyClinics,
    submitApproval,
    requestAppointment,
    requestReminder,
    setError,
  } = useChatAgent();

  const [location, setLocation] = useState(null);
  const [clinics, setClinics] = useState([]);
  const [selectedClinic, setSelectedClinic] = useState(null);
  const [bookingModalVisible, setBookingModalVisible] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [appointmentReason, setAppointmentReason] = useState('');
  const [radiusKm, setRadiusKm] = useState('10');
  const [clinicType, setClinicType] = useState('mental_health');
  const [isResolvingLocation, setIsResolvingLocation] = useState(true);

  useEffect(() => {
    const requestLocationPermission = async () => {
      setIsResolvingLocation(true);
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setError('Location permission denied. Please enable it in settings to search nearby clinics.');
          return;
        }

        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation.coords);
      } catch (err) {
        setError(`Unable to get your location: ${err.message}`);
      } finally {
        setIsResolvingLocation(false);
      }
    };

    requestLocationPermission();
  }, [setError]);

  useEffect(() => {
    if (!pendingApproval) return;

    Alert.alert(
      'Confirm Action',
      `Approve action: ${pendingApproval.tool_name || 'Continue'}?`,
      [
        {
          text: 'Deny',
          style: 'cancel',
          onPress: async () => {
            await submitApproval(false);
            setClinics([]);
          },
        },
        {
          text: 'Approve',
          onPress: async () => {
            const response = await submitApproval(true);
            const clinicItem = Array.isArray(response?.ui_payload)
              ? response.ui_payload.find((item) => item?.type === 'clinic_cards')
              : null;
            setClinics(clinicItem?.clinics || []);
          },
        },
      ]
    );
  }, [pendingApproval, submitApproval]);

  useEffect(() => {
    if (!reminderPrompt?.suggested_datetime) return;

    Alert.alert(
      'Create Reminder',
      'Do you want a reminder for this appointment request?',
      [
        { text: 'Not Now', style: 'cancel' },
        {
          text: 'Create Reminder',
          onPress: async () => {
            await requestReminder(
              reminderPrompt.title || 'Appointment reminder',
              reminderPrompt.suggested_datetime,
              reminderPrompt.context || 'Appointment follow-up'
            );
          },
        },
      ]
    );
  }, [reminderPrompt, requestReminder]);

  const locationLabel = useMemo(() => {
    if (!location) return 'Location unavailable';
    return `${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`;
  }, [location]);

  const handleFindClinics = async () => {
    if (!location) {
      setError('Location is not available. Please enable location services and try again.');
      return;
    }

    const result = await findNearbyClinics(location.latitude, location.longitude, {
      clinicType,
      radiusKm: parseFloat(radiusKm) || 10,
    });

    const clinicItem = Array.isArray(result?.ui_payload)
      ? result.ui_payload.find((item) => item?.type === 'clinic_cards')
      : null;
    setClinics(clinicItem?.clinics || []);
  };

  const handleCallClinic = async (phone) => {
    if (!phone?.trim()) {
      Alert.alert('No phone number', 'This clinic does not have a phone number listed.');
      return;
    }

    const phoneUrl = `tel:${phone.replace(/\D/g, '')}`;
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (!canOpen) {
        Alert.alert('Cannot call', 'This device cannot place phone calls.');
        return;
      }
      await Linking.openURL(phoneUrl);
    } catch {
      Alert.alert('Call failed', 'There was a problem trying to call this clinic.');
    }
  };

  const handleBookAppointment = async () => {
    if (!selectedClinic || !appointmentDate.trim()) {
      setError('Select a clinic and enter a preferred appointment time.');
      return;
    }

    const result = await requestAppointment(
      selectedClinic,
      appointmentDate,
      appointmentReason || 'Mental health consultation'
    );

    if (result) {
      setBookingModalVisible(false);
      setSelectedClinic(null);
      setAppointmentDate('');
      setAppointmentReason('');
      Alert.alert(
        'Request sent',
        result.requires_consent
          ? 'Please confirm the appointment request when prompted.'
          : (result.response || 'Your request has been sent.')
      );
    }
  };

  const openBooking = (clinic) => {
    setSelectedClinic(clinic);
    setBookingModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerEyebrow}>Care Navigation</Text>
        <Text style={styles.headerTitle}>Clinic Finder</Text>
        <Text style={styles.headerSubtitle}>
          {isResolvingLocation
            ? 'Getting your location so we can search nearby clinics.'
            : `Searching around ${locationLabel}`}
        </Text>
      </View>

      {error ? <ErrorBox message={error} onDismiss={() => setError(null)} style={styles.errorBox} /> : null}

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <View style={styles.heroBadge}>
            <Ionicons name="navigate-outline" size={14} color={colors.primary} />
            <Text style={styles.heroBadgeText}>Location-based search</Text>
          </View>
          <Text style={styles.heroTitle}>Find the right clinic faster</Text>
          <Text style={styles.heroText}>
            Search nearby clinics, review key details, and send an appointment request through ArogyaAI.
          </Text>
        </View>

        <View style={styles.searchBox}>
          <Text style={styles.sectionTitle}>Search Filters</Text>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Clinic type</Text>
            <View style={styles.filterOptions}>
              {CLINIC_TYPES.map((type) => {
                const active = clinicType === type.key;
                return (
                  <TouchableOpacity
                    key={type.key}
                    style={[styles.filterOption, active && styles.filterOptionActive]}
                    onPress={() => setClinicType(type.key)}
                  >
                    <Text style={[styles.filterOptionText, active && styles.filterOptionTextActive]}>
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Search radius (km)</Text>
            <TextInput
              style={styles.radiusInput}
              placeholder="10"
              placeholderTextColor={colors.textMuted}
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, (loading || isResolvingLocation) && styles.searchButtonDisabled]}
            onPress={handleFindClinics}
            disabled={loading || isResolvingLocation}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <>
                <Ionicons name="search-outline" size={18} color="#FFF" />
                <Text style={styles.searchButtonText}>Search Clinics</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {clinics.length > 0 ? (
          <View style={styles.resultSection}>
            <Text style={styles.sectionTitle}>{clinics.length} clinics found</Text>
            {clinics.map((clinic) => (
              <View key={clinic.clinic_id || clinic.id} style={styles.clinicCard}>
                <View style={styles.clinicHeader}>
                  <View style={styles.clinicTextCol}>
                    <Text style={styles.clinicName}>{clinic.name}</Text>
                    <Text style={styles.clinicAddress}>{clinic.address}</Text>
                  </View>
                  <View style={styles.distanceBadge}>
                    <Text style={styles.distanceText}>{formatDistance(clinic.distance_km)}</Text>
                  </View>
                </View>

                {clinic.city ? <Text style={styles.clinicMeta}>City: {clinic.city}</Text> : null}

                <View style={styles.metaRow}>
                  {clinic.phone ? (
                    <TouchableOpacity onPress={() => handleCallClinic(clinic.phone)} style={styles.metaPill}>
                      <Ionicons name="call-outline" size={13} color={colors.primary} />
                      <Text style={styles.metaPillText}>{clinic.phone}</Text>
                    </TouchableOpacity>
                  ) : null}
                  {clinic.has_emergency ? (
                    <View style={[styles.metaPill, styles.metaPillAlert]}>
                      <Text style={styles.metaPillAlertText}>Emergency</Text>
                    </View>
                  ) : null}
                  {clinic.has_ambulance ? (
                    <View style={[styles.metaPill, styles.metaPillSuccess]}>
                      <Text style={styles.metaPillSuccessText}>Ambulance</Text>
                    </View>
                  ) : null}
                </View>

                <TouchableOpacity style={styles.bookButton} onPress={() => openBooking(clinic)}>
                  <Text style={styles.bookButtonText}>Request Appointment</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        ) : loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Searching for clinics...</Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconWrap}>
              <Ionicons name="medical-outline" size={34} color={colors.primary} />
            </View>
            <Text style={styles.emptyTitle}>No clinics loaded yet</Text>
            <Text style={styles.emptySubtitle}>Search with your location to see nearby clinic options.</Text>
          </View>
        )}
      </ScrollView>

      <Modal
        visible={bookingModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Request Appointment</Text>
            {selectedClinic ? <Text style={styles.modalSubtitle}>{selectedClinic.name}</Text> : null}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Preferred date and time</Text>
              <Text style={styles.formHint}>Use format: YYYY-MM-DDTHH:MM:SS</Text>
              <TextInput
                style={styles.input}
                placeholder="2026-04-15T14:30:00"
                placeholderTextColor={colors.textMuted}
                value={appointmentDate}
                onChangeText={(text) => setAppointmentDate(formatDateTimeInput(text))}
                maxLength={19}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for visit</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Briefly describe what support you want."
                placeholderTextColor={colors.textMuted}
                value={appointmentReason}
                onChangeText={setAppointmentReason}
                multiline
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelButton} onPress={() => setBookingModalVisible(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmButton, !appointmentDate.trim() && styles.buttonDisabled]}
                onPress={handleBookAppointment}
                disabled={!appointmentDate.trim()}
              >
                <Text style={styles.confirmButtonText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 18,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerEyebrow: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
  },
  headerTitle: {
    marginTop: 4,
    fontSize: 26,
    fontWeight: '900',
    color: colors.textPrimary,
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  errorBox: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 40,
  },
  heroCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 20,
    marginBottom: 16,
  },
  heroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryTint,
    borderRadius: 18,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 14,
  },
  heroBadgeText: {
    color: colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  heroText: {
    marginTop: 8,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 12,
  },
  searchBox: {
    backgroundColor: colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.divider,
    padding: 18,
    marginBottom: 18,
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  filterOptions: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.card,
  },
  filterOptionActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  filterOptionTextActive: {
    color: '#FFF',
  },
  radiusInput: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  searchButton: {
    backgroundColor: colors.primary,
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  searchButtonDisabled: {
    opacity: 0.65,
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
  },
  resultSection: {
    marginBottom: 20,
  },
  clinicCard: {
    backgroundColor: colors.card,
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  clinicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  clinicTextCol: {
    flex: 1,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.textPrimary,
  },
  clinicAddress: {
    marginTop: 6,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  clinicMeta: {
    marginTop: 10,
    fontSize: 12,
    color: colors.textMuted,
  },
  distanceBadge: {
    backgroundColor: colors.primaryTint,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.primary,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
    marginBottom: 14,
  },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  metaPillText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
  },
  metaPillAlert: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  metaPillAlertText: {
    fontSize: 12,
    color: colors.danger,
    fontWeight: '700',
  },
  metaPillSuccess: {
    backgroundColor: '#ECFDF5',
    borderColor: '#A7F3D0',
  },
  metaPillSuccessText: {
    fontSize: 12,
    color: colors.success,
    fontWeight: '700',
  },
  bookButton: {
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 12,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '700',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primaryTint,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: colors.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.35)',
  },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 20,
    marginTop: 'auto',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.divider,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 84,
    textAlignVertical: 'top',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.divider,
    alignItems: 'center',
    backgroundColor: colors.card,
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ClinicFinderScreen;
