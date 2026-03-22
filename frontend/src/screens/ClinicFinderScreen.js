/**
 * ClinicFinderScreen - Find nearby clinics and book appointments
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TextInput,
  Modal,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useChatAgent } from '../hooks/useChatAgent';
import ErrorBox from '../components/ErrorBox';

const ClinicFinderScreen = ({ navigation }) => {
  const {
    loading,
    error,
    agentResult,
    findNearbyClinics,
    bookAppointment,
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

  // Request location permission on mount
  useEffect(() => {
    requestLocationPermission();
  }, []);

  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const currentLocation = await Location.getCurrentPositionAsync({});
        setLocation(currentLocation.coords);
      } else {
        setError('Location permission denied. Please enable it in settings.');
      }
    } catch (err) {
      setError(`Error getting location: ${err.message}`);
    }
  };

  const handleCallClinic = async (phone) => {
    if (!phone || phone.trim() === '') {
      Alert.alert('No Phone Number', 'This clinic does not have a phone number listed.');
      return;
    }

    const phoneUrl = `tel:${phone.replace(/\D/g, '')}`;
    try {
      const canOpen = await Linking.canOpenURL(phoneUrl);
      if (canOpen) {
        await Linking.openURL(phoneUrl);
      } else {
        Alert.alert('Cannot Call', 'Unable to place a call on this device.');
      }
    } catch (error) {
      Alert.alert('Error', 'There was an error trying to call the clinic.');
    }
  };

  const formatDateTimeInput = (input) => {
    // Remove non-numeric characters except hyphens, colons, and T
    const cleaned = input.replace(/[^\d\-T:]/g, '');

    // Expected format: YYYY-MM-DDTHH:MM:SS
    if (cleaned.length <= 4) return cleaned; // YYYY
    if (cleaned.length <= 7) return cleaned.slice(0, 4) + '-' + cleaned.slice(4); // YYYY-MM
    if (cleaned.length <= 10) return cleaned.slice(0, 4) + '-' + cleaned.slice(4, 6) + '-' + cleaned.slice(6); // YYYY-MM-DD
    if (cleaned.length <= 13) return cleaned.slice(0, 10) + 'T' + cleaned.slice(10); // YYYY-MM-DDTHH
    if (cleaned.length <= 16) return cleaned.slice(0, 13) + ':' + cleaned.slice(13); // YYYY-MM-DDTHH:MM
    if (cleaned.length <= 19) return cleaned.slice(0, 16) + ':' + cleaned.slice(16); // YYYY-MM-DDTHH:MM:SS

    return cleaned.slice(0, 19);
  };

  const handleFindClinics = async () => {
    if (!location) {
      setError('Location not available. Please enable location services.');
      return;
    }

    const result = await findNearbyClinics(
      location.latitude,
      location.longitude,
      {
        clinicType: clinicType || undefined,
        radiusKm: parseFloat(radiusKm) || 10,
      }
    );

    if (result?.result?.success) {
      setClinics(result.result.clinics || []);
    }
  };

  const handleBookAppointment = async () => {
    if (!appointmentDate || !selectedClinic) {
      setError('Please select a date and clinic');
      return;
    }

    const result = await bookAppointment(
      selectedClinic.id,
      appointmentDate,
      {
        type: 'consultation',
        reason: appointmentReason || 'Mental health consultation',
      }
    );

    if (result?.result?.success) {
      setBookingModalVisible(false);
      setSelectedClinic(null);
      setAppointmentDate('');
      setAppointmentReason('');
    }
  };

  const renderClinicCard = (clinic) => (
    <TouchableOpacity
      key={clinic.id}
      style={styles.clinicCard}
      onPress={() => {
        setSelectedClinic(clinic);
        setBookingModalVisible(true);
      }}
    >
      <View style={styles.clinicHeader}>
        <Text style={styles.clinicName}>{clinic.name}</Text>
        <View style={styles.distanceBadge}>
          <Text style={styles.distanceText}>{clinic.distance_km} km</Text>
        </View>
      </View>

      <Text style={styles.clinicAddress}>{clinic.address}</Text>
      {clinic.city && (
        <Text style={styles.clinicCity}>📍 {clinic.city}</Text>
      )}

      <View style={styles.clinicDetails}>
        {clinic.phone && (
          <TouchableOpacity onPress={() => handleCallClinic(clinic.phone)}>
            <Text style={styles.clinicPhone}>📞 {clinic.phone}</Text>
          </TouchableOpacity>
        )}
        {clinic.has_emergency && (
          <View style={styles.emergencyBadge}>
            <Text style={styles.emergencyText}>🚨 Emergency</Text>
          </View>
        )}
        {clinic.has_ambulance && (
          <View style={styles.ambulanceBadge}>
            <Text style={styles.ambulanceText}>🚑 Ambulance</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={styles.bookButton}
        onPress={() => {
          setSelectedClinic(clinic);
          setBookingModalVisible(true);
        }}
      >
        <Text style={styles.bookButtonText}>Book Appointment</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Find Clinics</Text>
        <Text style={styles.headerSubtitle}>
          {location
            ? `Searching near ${location.latitude.toFixed(2)}°, ${location.longitude.toFixed(2)}°`
            : 'Enabling location...'}
        </Text>
      </View>

      {error && (
        <ErrorBox
          message={error}
          onDismiss={() => setError(null)}
        />
      )}

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Search Controls */}
        <View style={styles.searchBox}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Clinic Type:</Text>
            <View style={styles.filterOptions}>
              {['mental_health', 'general', 'emergency'].map(type => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.filterOption,
                    clinicType === type && styles.filterOptionActive,
                  ]}
                  onPress={() => setClinicType(type)}
                >
                  <Text
                    style={[
                      styles.filterOptionText,
                      clinicType === type && styles.filterOptionTextActive,
                    ]}
                  >
                    {type.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Search Radius (km):</Text>
            <TextInput
              style={styles.radiusInput}
              placeholder="10"
              placeholderTextColor="#999"
              value={radiusKm}
              onChangeText={setRadiusKm}
              keyboardType="decimal-pad"
              maxLength={4}
            />
          </View>

          <TouchableOpacity
            style={[styles.searchButton, loading && styles.searchButtonDisabled]}
            onPress={handleFindClinics}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Text style={styles.searchButtonText}>Search Clinics</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Clinics List */}
        {clinics.length > 0 && (
          <View style={styles.resultSection}>
            <Text style={styles.resultTitle}>
              Found {clinics.length} Clinics
            </Text>
            {clinics.map(renderClinicCard)}
          </View>
        )}

        {clinics.length === 0 && !loading && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🏥</Text>
            <Text style={styles.emptyTitle}>No Clinics Found Yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap "Search Clinics" to find nearby health clinics
            </Text>
          </View>
        )}

        {loading && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#7B68EE" />
            <Text style={styles.loadingText}>Searching for clinics...</Text>
          </View>
        )}
      </ScrollView>

      {/* Booking Modal */}
      <Modal
        visible={bookingModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setBookingModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Book Appointment</Text>
            {selectedClinic && (
              <Text style={styles.modalSubtitle}>{selectedClinic.name}</Text>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Appointment Date & Time:</Text>
              <Text style={styles.formHint}>Format: YYYY-MM-DDTHH:MM:SS (e.g., 2024-04-15T14:30:00)</Text>
              <TextInput
                style={styles.input}
                placeholder="2024-04-15T14:30:00"
                placeholderTextColor="#999"
                value={appointmentDate}
                onChangeText={(text) => setAppointmentDate(formatDateTimeInput(text))}
                maxLength={19}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.formLabel}>Reason for Visit:</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Tell us why you're visiting..."
                value={appointmentReason}
                onChangeText={setAppointmentReason}
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => setBookingModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.confirmButton, loading && styles.buttonDisabled]}
                onPress={handleBookAppointment}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.confirmButtonText}>Book Appointment</Text>
                )}
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
    backgroundColor: '#F8F9FA',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E8',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#999',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  searchBox: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  filterGroup: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1A1A1A',
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
    borderColor: '#DDD',
    backgroundColor: '#FFF',
  },
  filterOptionActive: {
    backgroundColor: '#7B68EE',
    borderColor: '#7B68EE',
  },
  filterOptionText: {
    fontSize: 12,
    color: '#666',
    textTransform: 'capitalize',
  },
  filterOptionTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  radiusInput: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A1A1A',
  },
  searchButton: {
    backgroundColor: '#7B68EE',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#CCC',
  },
  searchButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  resultSection: {
    marginBottom: 20,
  },
  resultTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 12,
  },
  clinicCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E8E8E8',
  },
  clinicHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  clinicName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A1A1A',
    flex: 1,
  },
  distanceBadge: {
    backgroundColor: '#E8F0FF',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    marginLeft: 8,
  },
  distanceText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#7B68EE',
  },
  clinicAddress: {
    fontSize: 13,
    color: '#666',
    marginBottom: 4,
  },
  clinicCity: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  clinicDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  clinicPhone: {
    fontSize: 12,
    color: '#7B68EE',
    textDecorationLine: 'underline',
  },
  emergencyBadge: {
    backgroundColor: '#FFE8E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  emergencyText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#D32F2F',
  },
  ambulanceBadge: {
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  ambulanceText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#388E3C',
  },
  bookButton: {
    backgroundColor: '#7B68EE',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  bookButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 60,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    marginTop: 12,
    color: '#7B68EE',
    fontSize: 14,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    marginTop: 'auto',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 16,
  },
  formLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1A1A1A',
    marginBottom: 8,
  },
  formHint: {
    fontSize: 12,
    color: '#999',
    marginBottom: 6,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderColor: '#DDD',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    color: '#1A1A1A',
  },
  textArea: {
    minHeight: 80,
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
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#7B68EE',
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFF',
  },
  buttonDisabled: {
    backgroundColor: '#CCC',
  },
});

export default ClinicFinderScreen;
