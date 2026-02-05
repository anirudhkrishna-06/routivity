import React, { useState } from 'react';
import {
    StyleSheet,
    Text,
    View,
    SectionList,
    TouchableOpacity,
    ActivityIndicator,
    Image,
    Platform,
    SafeAreaView,
    Dimensions
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';

const { width } = Dimensions.get('window');
// Using the key found in backend/app/core/config.py
const GOOGLE_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

export default function TripPlusResultsScreen({ route, navigation }) {
    const { tripData, firebaseTripId } = route.params || {};
    const [saving, setSaving] = useState(false);

    if (!tripData || !tripData.itinerary) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>No trip data found!</Text>
                <TouchableOpacity style={styles.primaryButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.buttonText}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const { itinerary } = tripData;
    const rawDays = itinerary.days || [];
    const summary = itinerary.summary || {};

    // Transform Data for SectionList
    const sections = rawDays.map((day, index) => ({
        dayIndex: index + 1,
        date: day.date,
        city: day.city,
        accommodation: day.accommodation,
        data: day.events || []
    }));

    const handleSaveAndExit = async () => {
        try {
            setSaving(true);
            if (firebaseTripId) {
                const tripRef = doc(db, 'trip_plus', firebaseTripId);
                await updateDoc(tripRef, {
                    status: 'confirmed',
                    confirmedAt: new Date().toISOString()
                });
            }
            navigation.reset({
                index: 0,
                routes: [{ name: 'Home' }, { name: 'TripDashboard', params: { tripId: firebaseTripId, isTripPlus: true } }],
            });
        } catch (error) {
            console.error("Error confirming trip:", error);
            alert("Error confirming trip. It is saved in drafts.");
        } finally {
            setSaving(false);
        }
    };

    const getPhotoUrl = (photoRef) => {
        if (!photoRef) return null;
        return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photoreference=${photoRef}&key=${GOOGLE_API_KEY}`;
    };

    const formatTime = (timeStr) => {
        if (!timeStr) return '';
        const [hours, minutes] = timeStr.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes));
        return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    };

    const renderItem = ({ item, index, section }) => {
        const isLast = index === section.data.length - 1;
        const photoUrl = item.photos && item.photos.length > 0
            ? getPhotoUrl(item.photos[0].photo_reference)
            : null;

        return (
            <View style={styles.timelineItem}>
                {/* Timeline Left */}
                <View style={styles.timelineColumn}>
                    <View style={styles.timelineDot(item.type)} />
                    {!isLast && <View style={styles.timelineLine} />}
                </View>

                {/* Content Right */}
                <View style={styles.eventCardContainer}>
                    <Text style={styles.eventTime}>{formatTime(item.time)}</Text>

                    <View style={[styles.eventCard, item.type === 'travel' && styles.travelCard]}>
                        {photoUrl && item.type === 'attraction' && (
                            <Image
                                source={{ uri: photoUrl }}
                                style={styles.eventImage}
                                resizeMode="cover"
                            />
                        )}

                        <View style={styles.eventContent}>
                            <View style={styles.eventHeader}>
                                <Text style={styles.eventTitle}>{item.title}</Text>
                                {item.rating && (
                                    <View style={styles.ratingBadge}>
                                        <MaterialIcons name="star" size={12} color="#FFD700" />
                                        <Text style={styles.ratingText}>{item.rating}</Text>
                                    </View>
                                )}
                            </View>

                            {item.address && (
                                <Text style={styles.eventAddress} numberOfLines={2}>
                                    {item.address}
                                </Text>
                            )}

                            {item.type === 'travel' && (
                                <View style={styles.travelInfo}>
                                    <MaterialIcons name="directions-car" size={16} color="#666" />
                                    <Text style={styles.travelText}>
                                        {item.duration_mins} mins • From {item.origin}
                                    </Text>
                                </View>
                            )}

                            {item.type === 'meal' && (
                                <View style={styles.tagContainer}>
                                    <View style={styles.tag}>
                                        <MaterialIcons name="restaurant" size={12} color="#FF9500" />
                                        <Text style={styles.tagText}>Meal</Text>
                                    </View>
                                </View>
                            )}
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    const renderSectionHeader = ({ section }) => (
        <View style={styles.daySection}>
            <View style={styles.dayHeader}>
                <View style={styles.dayBadge}>
                    <Text style={styles.dayBadgeText}>DAY {section.dayIndex}</Text>
                </View>
                <View>
                    <Text style={styles.dayDate}>{new Date(section.date).toDateString()}</Text>
                    <Text style={styles.dayCity}>{section.city}</Text>
                </View>
            </View>

            {section.accommodation && (
                <View style={styles.accommodationCard}>
                    {section.accommodation.photos && section.accommodation.photos.length > 0 && (
                        <Image
                            source={{ uri: getPhotoUrl(section.accommodation.photos[0].photo_reference) }}
                            style={styles.accommodationImage}
                        />
                    )}
                    <View style={styles.accommodationContent}>
                        <View style={styles.accommodationLabelRow}>
                            <MaterialIcons name="hotel" size={16} color="#4A90E2" />
                            <Text style={styles.accommodationLabel}>NIGHT STAY</Text>
                        </View>
                        <Text style={styles.accommodationName}>{section.accommodation.name}</Text>
                        <Text style={styles.accommodationAddress}>{section.accommodation.vicinity}</Text>
                        {section.accommodation.rating && (
                            <View style={styles.ratingRow}>
                                {[...Array(Math.round(section.accommodation.rating))].map((_, i) => (
                                    <MaterialIcons key={i} name="star" size={14} color="#FFD700" />
                                ))}
                                <Text style={styles.ratingText}>({section.accommodation.user_ratings_total})</Text>
                            </View>
                        )}
                    </View>
                </View>
            )}

            <View style={{ height: 10 }} />
        </View>
    );

    const renderListHeader = () => (
        <View style={styles.header}>
            <View style={styles.headerRow}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <MaterialIcons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Your Itinerary</Text>
                <View style={{ width: 24 }} />
            </View>

            {/* Summary Card */}
            <View style={styles.summaryCard}>
                <View style={styles.summaryRow}>
                    <View style={styles.summaryItem}>
                        <MaterialIcons name="calendar-today" size={20} color="#4A90E2" style={{ marginBottom: 4 }} />
                        <Text style={styles.summaryValue}>{summary.total_days} Days</Text>
                    </View>
                    <View style={styles.divider} />
                    <View style={styles.summaryItem}>
                        <MaterialIcons name="place" size={20} color="#4A90E2" style={{ marginBottom: 4 }} />
                        <Text style={styles.summaryValue}>{summary.total_events} Spots</Text>
                    </View>
                </View>
            </View>
        </View>
    );

    return (
        <SafeAreaView style={styles.container}>
            <SectionList
                sections={sections}
                keyExtractor={(item, index) => index.toString()}
                renderItem={renderItem}
                renderSectionHeader={renderSectionHeader}
                ListHeaderComponent={renderListHeader}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                stickySectionHeadersEnabled={false}
                ListFooterComponent={<View style={{ height: 100 }} />}
            />

            <View style={styles.footer}>
                <TouchableOpacity
                    style={styles.confirmButton}
                    onPress={handleSaveAndExit}
                    disabled={saving}
                >
                    {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.confirmButtonText}>Confirm Trip</Text>}
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FA' },
    centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: {
        backgroundColor: '#F8F9FA',
        marginBottom: 10
    },
    headerRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#FFF',
        paddingTop: Platform.OS === 'android' ? 40 : 15,
        borderBottomWidth: 1, borderBottomColor: '#EEE'
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#1A1A1A' },
    errorText: { marginBottom: 20, color: '#666' },

    summaryCard: {
        backgroundColor: '#FFF', margin: 20, borderRadius: 16, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-around' },
    summaryItem: { alignItems: 'center' },
    summaryValue: { fontWeight: '700', color: '#333', fontSize: 16 },
    divider: { width: 1, backgroundColor: '#EEE', height: '100%' },

    scrollContent: { paddingBottom: 20 },

    daySection: {
        paddingTop: 10,
        backgroundColor: '#F8F9FA'
    },
    dayHeader: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 15
    },
    dayBadge: {
        backgroundColor: '#1A1A1A', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, marginRight: 12
    },
    dayBadgeText: { color: '#FFF', fontWeight: '800', fontSize: 12 },
    dayDate: { color: '#666', fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5 },
    dayCity: { color: '#1A1A1A', fontSize: 20, fontWeight: '700' },

    accommodationCard: {
        marginHorizontal: 20, marginBottom: 10, backgroundColor: '#FFF', borderRadius: 16,
        overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3,
        borderWidth: 1, borderColor: '#E8F4FD'
    },
    accommodationImage: { width: '100%', height: 140 },
    accommodationContent: { padding: 15 },
    accommodationLabelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    accommodationLabel: { color: '#4A90E2', fontWeight: '700', fontSize: 11, marginLeft: 6 },
    accommodationName: { fontSize: 18, fontWeight: '700', color: '#333', marginBottom: 4 },
    accommodationAddress: { color: '#666', fontSize: 13, marginBottom: 8 },
    ratingRow: { flexDirection: 'row', alignItems: 'center' },

    timelineItem: { flexDirection: 'row', marginBottom: 0, paddingHorizontal: 20 },
    timelineColumn: { alignItems: 'center', width: 24, marginRight: 12 },
    timelineDot: (type) => ({
        width: 12, height: 12, borderRadius: 6,
        backgroundColor: type === 'travel' ? '#9013fe' : (type === 'meal' ? '#FF9500' : '#FF3B30'),
        borderWidth: 2, borderColor: '#FFF', zIndex: 1,
        marginTop: 6
    }),
    timelineLine: { width: 2, backgroundColor: '#E0E0E0', flex: 1, marginVertical: -2 },

    eventCardContainer: { flex: 1, paddingBottom: 24 },
    eventCard: {
        backgroundColor: '#FFF', borderRadius: 12, padding: 0,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 6, elevation: 2,
        overflow: 'hidden', borderWidth: 1, borderColor: '#F0F0F0'
    },
    travelCard: { backgroundColor: '#F9F9FF', borderColor: 'transparent', padding: 12 },
    eventImage: { width: '100%', height: 120 },
    eventContent: { padding: 12 },
    eventHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
    eventTitle: { fontSize: 16, fontWeight: '600', color: '#333', flex: 1, marginRight: 8 },
    eventTime: { fontSize: 12, color: '#999', fontWeight: '600', marginBottom: 6 },
    ratingBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF9C4', paddingHorizontal: 4, borderRadius: 4, height: 18 },
    ratingText: { fontSize: 10, fontWeight: '700', marginLeft: 2, color: '#F57F17' },
    eventAddress: { fontSize: 12, color: '#666', lineHeight: 16 },

    travelInfo: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
    travelText: { fontSize: 13, color: '#666', marginLeft: 6 },

    tagContainer: { flexDirection: 'row', marginTop: 8 },
    tag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFF3E0', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    tagText: { fontSize: 10, color: '#EF6C00', marginLeft: 4, fontWeight: '600' },

    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0,
        backgroundColor: '#FFF', padding: 20, borderTopWidth: 1, borderTopColor: '#EEE',
        paddingBottom: Platform.OS === 'ios' ? 30 : 20
    },
    confirmButton: {
        backgroundColor: '#1A1A1A', height: 50, borderRadius: 25,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5
    },
    confirmButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' }
});
